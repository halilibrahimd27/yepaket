import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

/**
 * Firebase Cloud Messaging ile push gönderimi.
 *
 * SDK yerine doğrudan HTTP v1 API kullanılıyor: `firebase-admin` paketi
 * yalnızca bu iş için ~50 MB bağımlılık getiriyor ve konteyner boyutunu
 * gereksiz büyütüyor. Gereken tek şey bir OAuth2 erişim jetonu üretmek.
 *
 * Kimlik bilgisi yoksa servis sessizce devre dışı kalır ve bunu bir kez
 * kaydeder — geliştirme ortamında her bildirimde hata üretmesi gürültüden
 * başka bir şey değil.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly serviceAccount: ServiceAccount | null;
  private token: CachedToken | null = null;
  private disabledWarningLogged = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.serviceAccount = this.loadServiceAccount();
  }

  private loadServiceAccount(): ServiceAccount | null {
    const raw = this.config.get('FCM_SERVICE_ACCOUNT_JSON', { infer: true });
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as ServiceAccount;
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        this.logger.error('FCM servis hesabı eksik alan içeriyor.');
        return null;
      }
      // Ortam değişkeninde satır sonları kaçışlı gelir.
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      return parsed;
    } catch {
      this.logger.error('FCM_SERVICE_ACCOUNT_JSON çözümlenemedi.');
      return null;
    }
  }

  get enabled(): boolean {
    return this.serviceAccount !== null;
  }

  /** Servis hesabıyla imzalanmış JWT'den OAuth2 erişim jetonu alır. */
  private async accessToken(): Promise<string | null> {
    if (!this.serviceAccount) return null;

    // Jeton bir saat geçerli; 5 dakika pay bırakılır.
    if (this.token && this.token.expiresAt > Date.now() + 300_000) {
      return this.token.value;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      iss: this.serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');

    const unsigned = `${encode(header)}.${encode(claims)}`;
    const signature = createSign('RSA-SHA256')
      .update(unsigned)
      .sign(this.serviceAccount.private_key, 'base64url');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    });

    if (!response.ok) {
      this.logger.error(`FCM jetonu alınamadı: ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };

    return this.token.value;
  }

  /**
   * Kullanıcının tüm cihazlarına bildirim gönderir.
   *
   * Geçersiz jetonlar veritabanından silinir: uygulaması kaldırılmış bir
   * cihaza sonsuza kadar göndermeye çalışmak hem boşuna hem de FCM
   * kotasını tüketir.
   */
  async sendToUser(
    userId: string,
    message: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ sent: number; failed: number }> {
    if (!this.serviceAccount) {
      if (!this.disabledWarningLogged) {
        this.logger.warn(
          'FCM yapılandırılmadı; push gönderimi devre dışı. Bildirimler yalnızca uygulama içinde görünür.',
        );
        this.disabledWarningLogged = true;
      }
      return { sent: 0, failed: 0 };
    }

    const devices = await this.prisma.device.findMany({
      where: { userId, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });

    if (devices.length === 0) return { sent: 0, failed: 0 };

    const token = await this.accessToken();
    if (!token) return { sent: 0, failed: devices.length };

    const endpoint = `https://fcm.googleapis.com/v1/projects/${this.serviceAccount.project_id}/messages:send`;

    let sent = 0;
    const staleDeviceIds: string[] = [];

    for (const device of devices) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: device.pushToken,
            notification: { title: message.title, body: message.body },
            data: message.data ?? {},
            android: { priority: 'HIGH' },
            apns: {
              payload: { aps: { sound: 'default', badge: 1 } },
            },
          },
        }),
      }).catch(() => null);

      if (response?.ok) {
        sent += 1;
        continue;
      }

      // 404/400 → jeton artık geçerli değil.
      if (response && (response.status === 404 || response.status === 400)) {
        staleDeviceIds.push(device.id);
      }
    }

    if (staleDeviceIds.length > 0) {
      await this.prisma.device.updateMany({
        where: { id: { in: staleDeviceIds } },
        data: { pushToken: null },
      });
      this.logger.log(`${staleDeviceIds.length} geçersiz push jetonu temizlendi`);
    }

    return { sent, failed: devices.length - sent };
  }

  /** Birden çok kullanıcıya aynı bildirimi gönderir (favori duyurusu gibi). */
  async sendToUsers(
    userIds: string[],
    message: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      const result = await this.sendToUser(userId, message);
      sent += result.sent;
      failed += result.failed;
    }

    return { sent, failed };
  }
}
