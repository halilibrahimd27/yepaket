import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Çevresel etki katsayıları.
 *
 * Bunlar tahmindir ve öyle sunulmalıdır. Kurtarılan bir gıda paketi başına
 * önlenen sera gazı ve su ayak izi, ürün karışımına göre büyük ölçüde
 * değişir; sektörde yaygın kullanılan ortalamalar alınmıştır.
 *
 * Katsayıları değiştirmek geçmiş rakamları da değiştirir; pazarlama
 * iletişiminde kullanılacaksa kaynak belirtilmelidir.
 */
const CO2E_KG_PER_BAG = 2.7;
const WATER_LITERS_PER_BAG = 810;

export interface ImpactView {
  savedBags: number;
  moneySaved: { amountMinor: number; currency: string };
  co2eKg: number;
  waterLiters: number;
}

@Injectable()
export class ImpactService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kullanıcının kişisel etkisi.
   *
   * Yalnızca teslim alınmış siparişler sayılır: iptal edilen veya teslim
   * alınmayan bir sipariş gıdayı kurtarmamıştır.
   */
  async forUser(userId: string): Promise<ImpactView> {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: 'COLLECTED' },
      select: {
        quantity: true,
        totalMinor: true,
        currency: true,
        bag: { select: { originalValueMinor: true } },
      },
    });

    const savedBags = orders.reduce((sum, order) => sum + order.quantity, 0);

    // Tasarruf = normal değerin toplamı − ödenen tutar.
    const savedMinor = orders.reduce(
      (sum, order) => sum + (order.bag.originalValueMinor * order.quantity - order.totalMinor),
      0,
    );

    return {
      savedBags,
      moneySaved: { amountMinor: savedMinor, currency: orders[0]?.currency ?? 'TRY' },
      co2eKg: Number((savedBags * CO2E_KG_PER_BAG).toFixed(1)),
      waterLiters: savedBags * WATER_LITERS_PER_BAG,
    };
  }

  /** Topluluk toplamı (tanıtım sayfasındaki rakamlar). */
  async forCommunity(): Promise<ImpactView & { activeStores: number }> {
    const [aggregate, activeStores] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: 'COLLECTED' },
        _sum: { quantity: true, totalMinor: true },
      }),
      this.prisma.store.count({ where: { status: 'APPROVED' } }),
    ]);

    const savedBags = aggregate._sum.quantity ?? 0;

    // Topluluk tasarrufu için paket başına ortalama indirim kullanılır;
    // her siparişin normal değerini ayrı ayrı toplamak büyük veri
    // kümesinde pahalı olurdu.
    const originalValues = await this.prisma.$queryRaw<[{ saved: bigint | null }]>`
      SELECT COALESCE(SUM(b.original_value_minor * o.quantity - o.total_minor), 0)::bigint AS saved
      FROM orders o
      JOIN bags b ON b.id = o.bag_id
      WHERE o.status = 'COLLECTED'::"OrderStatus"
    `;

    return {
      savedBags,
      moneySaved: {
        amountMinor: Number(originalValues[0].saved ?? 0),
        currency: 'TRY',
      },
      co2eKg: Number((savedBags * CO2E_KG_PER_BAG).toFixed(1)),
      waterLiters: savedBags * WATER_LITERS_PER_BAG,
      activeStores,
    };
  }
}
