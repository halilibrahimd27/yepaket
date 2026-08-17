import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env';
import { RedisService } from '../../redis/redis.service';

const KEY_PREFIX = 'revoked_session:';

/**
 * İptal edilmiş oturumların kara listesi.
 *
 * **Neden gerekli:** Erişim jetonu imzalı bir JWT; doğrulaması veritabanına
 * gitmez, bu yüzden hızlıdır. Ama bu aynı zamanda şu anlama gelir: oturum
 * iptal edildiğinde (çıkış, "tüm cihazlardan çık", şifre değişimi, şifre
 * sıfırlama, jeton hırsızlığı tespiti) elde bulunan erişim jetonu süresi
 * dolana kadar geçerli kalır. Hesabı ele geçiren birine karşı 15 dakikalık
 * bir pencere açık kalırdı — ki bu, iptal işleminin tam olarak engellemesi
 * gereken şey.
 *
 * **Çözüm:** İptal edilen oturum kimliği Redis'e, erişim jetonunun kalan
 * ömrü kadar TTL ile yazılır. Guard her istekte bu anahtara bakar. Jeton
 * zaten süresi dolduğunda kayıt kendiliğinden silinir; liste büyümez.
 *
 * **Redis erişilemezse:** İstek reddedilmez, hata kaydı düşülür. Aksi hâlde
 * Redis kesintisi tüm kimlikli trafiği durdururdu. Açık kalan pencere yine
 * jetonun kendi ömrüyle (varsayılan 15 dakika) sınırlıdır.
 */
@Injectable()
export class SessionRevocationService {
  private readonly logger = new Logger(SessionRevocationService.name);

  /**
   * Kara liste kaydının ömrü (saniye).
   *
   * Erişim jetonu TTL'inden kısa olamaz; kısa olursa jeton hâlâ geçerliyken
   * kayıt silinir ve iptal edilmiş oturum yeniden çalışır hâle gelir.
   */
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<Env, true>,
  ) {
    const accessTtl = config.get('JWT_ACCESS_TTL', { infer: true });
    // Küçük bir pay eklenir: sunucu saatleri arasındaki kayma jetonun
    // kaydın silinmesinden sonra da geçerli kalmasına yol açmasın.
    this.ttlSeconds = parseDuration(accessTtl) + 60;
  }

  /** Tek bir oturumu kara listeye alır. */
  async revoke(sessionId: string): Promise<void> {
    await this.revokeMany([sessionId]);
  }

  /** Birden çok oturumu tek turda kara listeye alır. */
  async revokeMany(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;

    try {
      const pipeline = this.redis.client.pipeline();
      for (const id of sessionIds) {
        pipeline.set(`${KEY_PREFIX}${id}`, '1', 'EX', this.ttlSeconds);
      }
      await pipeline.exec();
    } catch (error) {
      // Yutulur ama sessiz değil: bu hata, iptal edilmiş bir jetonun kısa
      // süre geçerli kalabileceği anlamına gelir ve görülmesi gerekir.
      this.logger.error(
        `Oturum kara listesi yazılamadı (${sessionIds.length} oturum): ` +
          (error as Error).message,
      );
    }
  }

  /** Oturum iptal edilmiş mi? Redis erişilemezse `false` döner. */
  async isRevoked(sessionId: string): Promise<boolean> {
    try {
      return (await this.redis.client.exists(`${KEY_PREFIX}${sessionId}`)) === 1;
    } catch (error) {
      this.logger.error(
        `Oturum kara listesi okunamadı: ${(error as Error).message}`,
      );
      return false;
    }
  }
}

/**
 * "15m", "2h", "30s", "1d" biçimindeki süreyi saniyeye çevirir.
 *
 * `JWT_ACCESS_TTL` bu biçimde tutuluyor (jsonwebtoken sözdizimi). Birim
 * tanınmazsa güvenli tarafta kalınır: 15 dakika.
 */
function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!match) return 15 * 60;

  const amount = Number(match[1]);
  switch (match[2]?.toLowerCase()) {
    case 's':
      return amount;
    case 'h':
      return amount * 3600;
    case 'd':
      return amount * 86_400;
    case 'm':
    default:
      return amount * 60;
  }
}
