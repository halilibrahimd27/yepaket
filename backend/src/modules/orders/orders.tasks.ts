import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from './idempotency.service';
import { OrdersService } from './orders.service';

/**
 * Zamanlanmış bakım işleri.
 *
 * Bunlar olmadan sistem sessizce bozulur: ödemesi tamamlanmayan siparişler
 * stoğu süresiz tutar, süresi geçmiş paketler keşifte görünmeye devam eder
 * ve idempotency tablosu sınırsız büyür.
 */
@Injectable()
export class OrdersTasks {
  private readonly logger = new Logger(OrdersTasks.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
  ) {}

  /** Ödeme onayı gelmeyen rezervasyonları geri verir. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'expire-reservations' })
  async expireReservations(): Promise<void> {
    const released = await this.orders.expireStaleReservations();
    if (released > 0) {
      this.logger.log(`${released} süresi dolmuş rezervasyon geri verildi`);
    }
  }

  /**
   * Teslim aralığı geçmiş paketleri kapatır ve teslim alınmamış siparişleri
   * işaretler. Gelmeyen müşteri (`NO_SHOW`) işletme raporlaması için önemli.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'expire-bags' })
  async expireBags(): Promise<void> {
    const now = new Date();

    const expiredBags = await this.prisma.bag.updateMany({
      where: { status: { in: ['PUBLISHED', 'SOLD_OUT'] }, pickupEndsAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });

    const noShows = await this.prisma.order.updateMany({
      where: { status: 'PICKUP_PENDING', pickupEndsAt: { lt: now } },
      data: { status: 'NO_SHOW' },
    });

    if (expiredBags.count > 0 || noShows.count > 0) {
      this.logger.log(
        `${expiredBags.count} paket süresi doldu, ${noShows.count} sipariş teslim alınmadı`,
      );
    }
  }

  /** Süresi dolmuş idempotency kayıtlarını temizler. */
  @Cron(CronExpression.EVERY_HOUR, { name: 'purge-idempotency' })
  async purgeIdempotency(): Promise<void> {
    const purged = await this.idempotency.purgeExpired();
    if (purged > 0) {
      this.logger.log(`${purged} idempotency kaydı temizlendi`);
    }
  }

  /** Süresi geçmiş yenileme oturumlarını siler. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'purge-sessions' })
  async purgeSessions(): Promise<void> {
    const purged = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (purged.count > 0) {
      this.logger.log(`${purged.count} süresi dolmuş oturum silindi`);
    }
  }
}
