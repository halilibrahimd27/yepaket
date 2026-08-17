import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { PrismaService } from '../../database/prisma.service';

const ISTANBUL = 'Europe/Istanbul';

/**
 * Tekrar eden paket yayınlayıcı.
 *
 * İşletme "her gün 20:00–20:30, 8 adet" dediğinde her sabah elle paket
 * açmak zorunda kalmamalı. Bu iş aktif şablonlardan o günün paketini üretir.
 *
 * İdempotent: aynı şablon ve aynı teslim aralığı için ikinci paket
 * oluşturulmaz, böylece iş birden çok kez çalışsa da kopya doğmaz.
 */
@Injectable()
export class BagPublisherTasks {
  private readonly logger = new Logger(BagPublisherTasks.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Her sabah 06:00'da (yerel saat) o günün paketlerini açar.
   * Sabah seçildi: işletme gün içinde stok/fiyat düzeltmesi yapabilsin.
   */
  @Cron('0 6 * * *', { name: 'publish-scheduled-bags', timeZone: ISTANBUL })
  async publishDailyBags(): Promise<void> {
    const created = await this.publishForDate(DateTime.now().setZone(ISTANBUL));
    if (created > 0) {
      this.logger.log(`${created} paket şablondan otomatik yayınlandı`);
    }
  }

  /** Verilen gün için şablonlardan paket üretir. Test edilebilir olsun diye ayrı. */
  async publishForDate(day: DateTime): Promise<number> {
    // Luxon: 1 = Pazartesi … 7 = Pazar (şemadaki `weekdays` ile aynı).
    const weekday = day.weekday;

    const templates = await this.prisma.bagTemplate.findMany({
      where: {
        isActive: true,
        publishMode: { in: ['DAILY', 'WEEKLY'] },
        store: { status: 'APPROVED' },
      },
      include: { store: { select: { id: true, status: true } } },
    });

    let created = 0;

    for (const template of templates) {
      if (template.publishMode === 'WEEKLY' && !template.weekdays.includes(weekday)) {
        continue;
      }

      const pickupStartsAt = day
        .startOf('day')
        .plus({ minutes: template.pickupStartMinute })
        .toUTC()
        .toJSDate();

      const pickupEndsAt = day
        .startOf('day')
        .plus({ minutes: template.pickupEndMinute })
        .toUTC()
        .toJSDate();

      // Teslim aralığı çoktan geçmişse bugün için üretmenin anlamı yok.
      if (pickupEndsAt.getTime() <= Date.now()) continue;

      const existing = await this.prisma.bag.findFirst({
        where: { templateId: template.id, pickupStartsAt },
        select: { id: true },
      });

      if (existing) continue;

      const bag = await this.prisma.bag.create({
        data: {
          storeId: template.storeId,
          templateId: template.id,
          title: template.title,
          category: template.category,
          description: template.description,
          imageUrls: template.imageUrls,
          originalValueMinor: template.originalValueMinor,
          salePriceMinor: template.salePriceMinor,
          currency: template.currency,
          totalQuantity: template.defaultQuantity,
          availableQuantity: template.defaultQuantity,
          pickupStartsAt,
          pickupEndsAt,
          status: 'PUBLISHED',
        },
      });

      await this.prisma.outboxEvent.create({
        data: {
          type: 'bag.available',
          payload: { bagId: bag.id, storeId: template.storeId },
        },
      });

      created += 1;
    }

    return created;
  }
}
