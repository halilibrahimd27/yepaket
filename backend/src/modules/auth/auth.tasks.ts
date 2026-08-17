import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../database/prisma.service';
import { PasswordResetService } from './password-reset.service';

/**
 * Kimlik verilerinin bakımı.
 *
 * Süresi geçmiş jetonlar ve oturumlar silinmezse tablolar sınırsız büyür ve
 * `sessions` üzerindeki sorgular zamanla yavaşlar.
 */
@Injectable()
export class AuthTasks {
  private readonly logger = new Logger(AuthTasks.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'auth-cleanup' })
  async cleanup(): Promise<void> {
    const tokens = await this.passwordReset.purgeExpired();

    // İptal edilmiş oturumlar 90 gün saklanır: bu süre içinde bir güvenlik
    // incelemesi yapılabilir, sonrasında kayıt değerini yitirir.
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.session.deleteMany({
      where: {
        OR: [
          { revokedAt: { lt: cutoff } },
          { expiresAt: { lt: cutoff } },
        ],
      },
    });

    // Süresi dolmuş idempotency kayıtları da burada temizlenir; aynı bakım
    // penceresinde yapmak veritabanına ayrı bir yük bindirmez.
    const idempotency = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (tokens || sessions.count || idempotency.count) {
      this.logger.log(
        `Bakım: ${tokens} sıfırlama jetonu, ${sessions.count} oturum, ` +
          `${idempotency.count} idempotency kaydı silindi.`,
      );
    }
  }
}
