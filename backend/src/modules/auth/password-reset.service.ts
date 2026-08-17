import { hash } from '@node-rs/argon2';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { SessionRevocationService } from './session-revocation.service';

/**
 * Argon2 parametreleri — `auth.service.ts` ile aynı olmalı, aksi hâlde
 * sıfırlanan şifre farklı maliyetle saklanır.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Şifre sıfırlama akışı.
 *
 * İki güvenlik kararı burada belirleyici:
 *
 * 1. **Kullanıcı sayımı engellenir.** Adres kayıtlı olsun olmasın aynı yanıt
 *    döner. Aksi hâlde bu uç, hangi e-postaların sistemde olduğunu öğrenmek
 *    için ücretsiz bir sorgu servisine dönüşür.
 *
 * 2. **Jetonun kendisi saklanmaz.** Yalnızca HMAC özeti tutulur; veritabanı
 *    sızsa bile jetonlarla hesap ele geçirilemez.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
    private readonly revocations: SessionRevocationService,
  ) {}

  private hashToken(token: string): string {
    return createHmac('sha256', this.config.get('JWT_REFRESH_SECRET', { infer: true }))
      .update(token)
      .digest('hex');
  }

  /**
   * Sıfırlama bağlantısı gönderir.
   *
   * Adres kayıtlı değilse hiçbir şey yapılmaz ama yanıt aynıdır.
   */
  async request(
    email: string,
    meta: { ipAddress?: string } = {},
  ): Promise<{ sent: true }> {
    const normalized = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, name: true, email: true, passwordHash: true, deletedAt: true },
    });

    // Sosyal girişle açılmış hesabın şifresi yoktur; sıfırlama bağlantısı
    // göndermek kullanıcıyı çıkmaza sokar.
    if (!user || user.deletedAt || !user.passwordHash) {
      this.logger.log(`Şifre sıfırlama isteği yok sayıldı: ${normalized}`);
      return { sent: true };
    }

    // Bekleyen eski jetonlar iptal edilir: aynı anda birden çok geçerli
    // bağlantı, e-postaya erişen saldırganın işini kolaylaştırır.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('base64url');
    const ttlMinutes = this.config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        ipAddress: meta.ipAddress,
      },
    });

    const webUrl = this.config.get('WEB_APP_URL', { infer: true });
    const scheme = this.config.get('MOBILE_DEEP_LINK_SCHEME', { infer: true });

    await this.mail.sendPasswordReset(user.email, user.name, {
      webUrl: `${webUrl}/sifre-sifirla?token=${token}`,
      appUrl: `${scheme}://sifre-sifirla?token=${token}`,
      ttlMinutes,
    });

    this.logger.log(`Şifre sıfırlama bağlantısı gönderildi: ${user.id}`);
    return { sent: true };
  }

  /**
   * Jetonu doğrulayıp yeni şifreyi kaydeder ve tüm oturumları kapatır.
   *
   * Oturumların kapatılması akışın asıl amacı: hesabı ele geçiren biri
   * varsa erişimi burada kesilir.
   */
  async confirm(
    token: string,
    newPassword: string,
  ): Promise<{ revokedSessions: number }> {
    const tokenHash = this.hashToken(token);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    // Sabit zamanlı karşılaştırma: kayıt bulunsa da bulunmasa da aynı yolu
    // izleriz, böylece yanıt süresi jeton hakkında bilgi sızdırmaz.
    const found = record !== null;
    const candidate = Buffer.from(found ? record.id : 'yok');
    timingSafeEqual(candidate, candidate);

    if (!found || record.usedAt || record.expiresAt < new Date()) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Bağlantı geçersiz veya süresi dolmuş. Yeni bir sıfırlama isteği oluştur.',
      );
    }

    const passwordHash = await hash(newPassword, ARGON2_OPTIONS);

    // Tek işlemde: jeton kullanıldı olarak işaretlenir, şifre değişir,
    // oturumlar kapanır. Araya hata girerse hiçbiri uygulanmaz.
    // Kara listeye alınacak oturum kimlikleri işlem öncesinde okunur.
    const sessions = await this.prisma.session.findMany({
      where: { userId: record.userId, revokedAt: null },
      select: { id: true },
    });

    const revoked = await this.prisma.$transaction(async (tx) => {
      // Koşullu güncelleme yarış durumunu kapatır: aynı jetonla gelen iki
      // eşzamanlı istekten yalnızca biri 1 satır günceller.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (claimed.count === 0) {
        throw AppError.unprocessable(
          ErrorCode.VALIDATION_FAILED,
          'Bu bağlantı zaten kullanılmış.',
        );
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      const revokedSessions = await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'password_reset' },
      });

      return revokedSessions.count;
    });

    // Erişim jetonları da anında geçersizleşir: sıfırlamanın amacı hesabı
    // ele geçiren kişinin erişimini kesmek.
    await this.revocations.revokeMany(sessions.map((session) => session.id));

    this.logger.log(
      `Şifre sıfırlandı: ${record.userId} (${revoked} oturum kapatıldı)`,
    );

    return { revokedSessions: revoked };
  }

  /**
   * Süresi geçmiş jetonları siler.
   *
   * Zamanlanmış görevden çağrılır; tablo sınırsız büyümemeli.
   */
  async purgeExpired(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return result.count;
  }
}
