import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Redis pub/sub kanalı; WebSocket ağ geçidi bunu dinler. */
export const REALTIME_CHANNEL = 'yepaket:events';

interface OrderEventPayload {
  orderId?: string;
  userId?: string;
  storeId?: string;
  bagId?: string;
  status?: string;
  orderNo?: string;
  availableQuantity?: number;
}

/**
 * Outbox yayıncısı.
 *
 * Olaylar iş transaction'ının içinde veritabanına yazılır; buradaki süreç
 * onları Redis'e taşır. Böylece "veritabanı yazıldı ama olay yayınlanmadı"
 * ya da tersi bir durum oluşmaz — olay ile veri aynı transaction'da
 * kesinleşir.
 *
 * Aynı anda birden çok API örneği çalışsa bile olaylar tek kez yayınlanır:
 * satırlar `FOR UPDATE SKIP LOCKED` ile alınır.
 */
@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS, { name: 'publish-outbox' })
  async publishPending(): Promise<void> {
    // Önceki tur bitmediyse üst üste binme; uzun süren bir yayın turu
    // aynı olayları iki kez işlemesin.
    if (this.running) return;
    this.running = true;

    try {
      const events = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string; type: string; payload: OrderEventPayload }[]
        >`
          SELECT id, type, payload
          FROM outbox_events
          WHERE published_at IS NULL AND attempts < 5
          ORDER BY created_at
          LIMIT 100
          FOR UPDATE SKIP LOCKED
        `;

        if (rows.length > 0) {
          await tx.outboxEvent.updateMany({
            where: { id: { in: rows.map((row) => row.id) } },
            data: { publishedAt: new Date(), attempts: { increment: 1 } },
          });
        }

        return rows;
      });

      for (const event of events) {
        await this.dispatch(event.type, event.payload);
      }

      if (events.length > 0) {
        this.logger.debug(`${events.length} olay yayınlandı`);
      }
    } catch (error) {
      this.logger.error(`Outbox yayını başarısız: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async dispatch(type: string, payload: OrderEventPayload): Promise<void> {
    await this.redis.publisher.publish(REALTIME_CHANNEL, JSON.stringify({ type, payload }));

    // Bazı olaylar kalıcı bildirim de üretir; anlık bağlantısı olmayan
    // kullanıcı bildirimi sonradan görebilmeli.
    switch (type) {
      case 'order.status.updated':
        if (payload.userId && payload.orderId) {
          await this.notifications.notifyOrderStatus(
            payload.userId,
            payload.orderId,
            payload.status ?? 'updated',
          );
        }
        break;

      case 'bag.available':
        if (payload.storeId) {
          await this.notifications.notifyFavoriteStoreHasBags(payload.storeId, payload.bagId);
        }
        break;

      default:
        break;
    }
  }

  /** Yayınlanamamış eski olayları tekrar dener. */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'retry-outbox' })
  async retryFailed(): Promise<void> {
    const stuck = await this.prisma.outboxEvent.count({
      where: { publishedAt: null, attempts: { gte: 5 } },
    });

    if (stuck > 0) {
      // Elle müdahale gerekiyor: sessizce yutmak, kullanıcının bildirim
      // alamamasına ve kimsenin fark etmemesine yol açardı.
      this.logger.error(`${stuck} olay 5 denemeden sonra yayınlanamadı`);
    }
  }
}
