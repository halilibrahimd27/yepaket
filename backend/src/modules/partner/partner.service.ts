import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { presentBag, presentStore } from '../catalog/catalog.presenter';
import { MailService } from '../mail/mail.service';
import { StoreAccessService } from './store-access.service';
import type {
  CreateBagDto,
  CreateBagTemplateDto,
  PartnerApplicationDto,
  UpdateBagDto,
  UpdateStoreDto,
} from './dto/partner.dto';

const ISTANBUL = 'Europe/Istanbul';

/**
 * İşletme (MyStore) paneli işlemleri.
 *
 * Her metot mağaza sahipliğini `StoreAccessService` üzerinden doğrular;
 * hiçbir uç yalnızca role güvenmez.
 */
@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StoreAccessService,
    private readonly mail: MailService,
  ) {}

  // -------------------------------------------------------------------------
  // Genel bakış
  // -------------------------------------------------------------------------

  /**
   * Panel özeti. Tüm sayılar tek sorguda toplanır; panel her açılışta
   * yarım düzine ayrı istek atmak zorunda kalmasın.
   */
  async dashboard(user: AuthenticatedUser, storeId?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId)
      : await this.access.defaultStore(user);

    const dayStart = DateTime.now().setZone(ISTANBUL).startOf('day').toUTC().toJSDate();
    const weekStart = DateTime.now()
      .setZone(ISTANBUL)
      .minus({ days: 6 })
      .startOf('day')
      .toUTC()
      .toJSDate();

    const [today, pending, active, activeBags, newCustomers, dailyRaw] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          storeId: store.id,
          status: { in: ['PAID', 'PICKUP_PENDING', 'COLLECTED'] },
          createdAt: { gte: dayStart },
        },
        _sum: { totalMinor: true, quantity: true },
        _count: true,
      }),
      this.prisma.order.count({
        where: { storeId: store.id, status: 'PICKUP_PENDING' },
      }),
      this.prisma.order.count({
        where: {
          storeId: store.id,
          status: 'PICKUP_PENDING',
          pickupStartsAt: { lte: new Date(Date.now() + 3_600_000) },
        },
      }),
      this.prisma.bag.findMany({
        where: {
          storeId: store.id,
          status: 'PUBLISHED',
          pickupEndsAt: { gt: new Date() },
        },
        include: { store: true },
        orderBy: { pickupStartsAt: 'asc' },
      }),
      // İlk kez bu işletmeden sipariş veren kullanıcı sayısı.
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*)::bigint AS count FROM (
          SELECT user_id FROM orders
          WHERE store_id = ${store.id}::uuid
          GROUP BY user_id
          HAVING min(created_at) >= ${dayStart}
        ) AS first_time
      `,
      this.prisma.$queryRaw<{ day: Date; bags: bigint; revenue: bigint }[]>`
        SELECT date_trunc('day', o.created_at AT TIME ZONE 'Europe/Istanbul') AS day,
               COALESCE(SUM(o.quantity), 0)::bigint AS bags,
               COALESCE(SUM(o.total_minor), 0)::bigint AS revenue
        FROM orders o
        WHERE o.store_id = ${store.id}::uuid
          AND o.created_at >= ${weekStart}
          AND o.status IN ('PAID','PICKUP_PENDING','COLLECTED')
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const rescuedTotal = await this.prisma.order.aggregate({
      where: { storeId: store.id, status: 'COLLECTED' },
      _sum: { quantity: true },
    });

    return {
      store: presentStore(store),
      today: {
        revenue: { amountMinor: today._sum.totalMinor ?? 0, currency: 'TRY' },
        orderCount: today._count,
        rescuedBags: today._sum.quantity ?? 0,
        newCustomers: Number(newCustomers[0]?.count ?? 0),
      },
      pendingPickups: pending,
      pickupsWithinHour: active,
      activeBags: activeBags.map((bag) => presentBag(bag)),
      dailySeries: dailyRaw.map((row) => ({
        date: row.day,
        rescuedBags: Number(row.bags),
        revenue: { amountMinor: Number(row.revenue), currency: 'TRY' },
      })),
      lifetime: {
        rescuedBags: rescuedTotal._sum.quantity ?? 0,
        rating: { overall: store.ratingAverage, count: store.ratingCount },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Paketler
  // -------------------------------------------------------------------------

  async listBags(user: AuthenticatedUser, storeId?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId)
      : await this.access.defaultStore(user);

    const bags = await this.prisma.bag.findMany({
      where: { storeId: store.id },
      include: { store: true, _count: { select: { orders: true } } },
      orderBy: { pickupStartsAt: 'desc' },
      take: 100,
    });

    return bags.map((bag) => ({
      ...presentBag(bag),
      soldQuantity: bag.totalQuantity - bag.availableQuantity,
      orderCount: bag._count.orders,
    }));
  }

  async createBag(user: AuthenticatedUser, dto: CreateBagDto, storeId?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId, 'MANAGER')
      : await this.access.defaultStore(user);

    const startsAt = new Date(dto.pickupStartsAt);
    const endsAt = new Date(dto.pickupEndsAt);

    // Doğrulama burada da yapılır çünkü veritabanı kısıtı ihlal edildiğinde
    // kullanıcıya anlamlı bir mesaj değil, ham hata dönerdi.
    if (endsAt <= startsAt) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Teslim bitişi başlangıçtan sonra olmalıdır.',
      );
    }

    if (endsAt.getTime() <= Date.now()) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Teslim aralığı geçmişte olamaz.',
      );
    }

    if (dto.salePriceMinor > dto.originalValueMinor) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Satış fiyatı normal değerden yüksek olamaz.',
      );
    }

    const bag = await this.prisma.bag.create({
      data: {
        storeId: store.id,
        title: dto.title,
        category: dto.category,
        description: dto.description,
        imageUrls: dto.imageUrls ?? [],
        originalValueMinor: dto.originalValueMinor,
        salePriceMinor: dto.salePriceMinor,
        totalQuantity: dto.quantity,
        availableQuantity: dto.quantity,
        pickupStartsAt: startsAt,
        pickupEndsAt: endsAt,
        status: 'PUBLISHED',
      },
      include: { store: true },
    });

    await this.prisma.outboxEvent.create({
      data: {
        type: 'bag.available',
        payload: { bagId: bag.id, storeId: store.id },
      },
    });

    this.logger.log(`Paket yayınlandı: ${bag.title} (${store.name})`);
    return presentBag(bag);
  }

  async updateBag(user: AuthenticatedUser, bagId: string, dto: UpdateBagDto) {
    const bag = await this.access.requireOwnBag(user, bagId);

    // Satılmış adedin altına inecek bir stok güncellemesi kabul edilemez:
    // müşteri zaten o paketleri satın aldı.
    let availableQuantity: number | undefined;
    if (dto.quantity !== undefined) {
      const sold = bag.totalQuantity - bag.availableQuantity;
      if (dto.quantity < sold) {
        throw AppError.unprocessable(
          ErrorCode.VALIDATION_FAILED,
          `Bu paketten ${sold} adet satıldı; toplam adet bunun altına indirilemez.`,
        );
      }
      availableQuantity = dto.quantity - sold;
    }

    const updated = await this.prisma.bag.update({
      where: { id: bagId },
      data: {
        title: dto.title,
        description: dto.description,
        salePriceMinor: dto.salePriceMinor,
        totalQuantity: dto.quantity,
        availableQuantity,
        pickupStartsAt: dto.pickupStartsAt ? new Date(dto.pickupStartsAt) : undefined,
        pickupEndsAt: dto.pickupEndsAt ? new Date(dto.pickupEndsAt) : undefined,
        status:
          availableQuantity !== undefined
            ? availableQuantity > 0
              ? 'PUBLISHED'
              : 'SOLD_OUT'
            : undefined,
      },
      include: { store: true },
    });

    return presentBag(updated);
  }

  /** Paketi yayından kaldırır veya geri alır. */
  async toggleBag(user: AuthenticatedUser, bagId: string, published: boolean) {
    const bag = await this.access.requireOwnBag(user, bagId);

    if (published && bag.availableQuantity === 0) {
      throw AppError.unprocessable(
        ErrorCode.BAG_SOLD_OUT,
        'Stoğu tükenmiş paket yayına alınamaz. Önce adet güncelleyin.',
      );
    }

    const updated = await this.prisma.bag.update({
      where: { id: bagId },
      data: { status: published ? 'PUBLISHED' : 'PAUSED' },
      include: { store: true },
    });

    if (published) {
      await this.prisma.outboxEvent.create({
        data: { type: 'bag.available', payload: { bagId, storeId: bag.storeId } },
      });
    }

    return presentBag(updated);
  }

  /**
   * Paket iptali. Sipariş almış paket silinemez — geçmiş bozulur;
   * onun yerine yayından kaldırılır.
   */
  async deleteBag(user: AuthenticatedUser, bagId: string) {
    // Yalnızca sahiplik doğrulaması için çağrılır.
    await this.access.requireOwnBag(user, bagId);

    const orderCount = await this.prisma.order.count({ where: { bagId } });

    if (orderCount > 0) {
      await this.prisma.bag.update({ where: { id: bagId }, data: { status: 'CANCELLED' } });
      return { deleted: false, cancelled: true, orderCount };
    }

    await this.prisma.bag.delete({ where: { id: bagId } });
    return { deleted: true, cancelled: false, orderCount: 0 };
  }

  // -------------------------------------------------------------------------
  // Şablonlar (tekrar eden yayın)
  // -------------------------------------------------------------------------

  async listTemplates(user: AuthenticatedUser, storeId?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId)
      : await this.access.defaultStore(user);

    const templates = await this.prisma.bagTemplate.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });

    return templates.map((template) => ({
      id: template.id,
      title: template.title,
      category: template.category.toLowerCase(),
      description: template.description,
      originalValue: { amountMinor: template.originalValueMinor, currency: template.currency },
      salePrice: { amountMinor: template.salePriceMinor, currency: template.currency },
      defaultQuantity: template.defaultQuantity,
      pickupStart: this.minutesToLabel(template.pickupStartMinute),
      pickupEnd: this.minutesToLabel(template.pickupEndMinute),
      publishMode: template.publishMode.toLowerCase(),
      weekdays: template.weekdays,
      isActive: template.isActive,
    }));
  }

  private minutesToLabel(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  private labelToMinutes(label: string): number {
    const [hours, minutes] = label.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async createTemplate(user: AuthenticatedUser, dto: CreateBagTemplateDto, storeId?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId, 'MANAGER')
      : await this.access.defaultStore(user);

    const start = this.labelToMinutes(dto.pickupStart);
    const end = this.labelToMinutes(dto.pickupEnd);

    if (end <= start) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Teslim bitişi başlangıçtan sonra olmalıdır.',
      );
    }

    if (dto.salePriceMinor > dto.originalValueMinor) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Satış fiyatı normal değerden yüksek olamaz.',
      );
    }

    const template = await this.prisma.bagTemplate.create({
      data: {
        storeId: store.id,
        title: dto.title,
        category: dto.category,
        description: dto.description,
        imageUrls: [],
        originalValueMinor: dto.originalValueMinor,
        salePriceMinor: dto.salePriceMinor,
        defaultQuantity: dto.defaultQuantity,
        pickupStartMinute: start,
        pickupEndMinute: end,
        publishMode: dto.publishMode,
        weekdays: dto.weekdays ?? [],
      },
    });

    return { id: template.id, title: template.title, isActive: template.isActive };
  }

  async toggleTemplate(user: AuthenticatedUser, templateId: string, isActive: boolean) {
    const template = await this.prisma.bagTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw AppError.notFound('Şablon');

    await this.access.requireStore(user, template.storeId, 'MANAGER');

    const updated = await this.prisma.bagTemplate.update({
      where: { id: templateId },
      data: { isActive },
    });

    return { id: updated.id, isActive: updated.isActive };
  }

  // -------------------------------------------------------------------------
  // Siparişler
  // -------------------------------------------------------------------------

  async listOrders(
    user: AuthenticatedUser,
    filters: { storeId?: string; status?: string; date?: string } = {},
  ) {
    const store = filters.storeId
      ? await this.access.requireStore(user, filters.storeId)
      : await this.access.defaultStore(user);

    const dayFilter = filters.date
      ? {
          gte: DateTime.fromISO(filters.date, { zone: ISTANBUL }).startOf('day').toUTC().toJSDate(),
          lt: DateTime.fromISO(filters.date, { zone: ISTANBUL }).endOf('day').toUTC().toJSDate(),
        }
      : undefined;

    const statuses = filters.status
      ? (filters.status.split(',').map((item) => item.trim().toUpperCase()) as never[])
      : undefined;

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: store.id,
        status: statuses ? { in: statuses } : { not: 'PAYMENT_PENDING' },
        createdAt: dayFilter,
      },
      include: { bag: true, user: { select: { name: true } } },
      orderBy: { pickupStartsAt: 'asc' },
      take: 200,
    });

    return orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status.toLowerCase(),
      // İşletme müşterinin tam adını görmez: teslimde eşleştirme için
      // baş harf yeterli, fazlası gereksiz kişisel veri paylaşımıdır.
      customerName: this.maskName(order.user.name),
      bagTitle: order.bag.title,
      quantity: order.quantity,
      total: { amountMinor: order.totalMinor, currency: order.currency },
      net: { amountMinor: order.netMinor, currency: order.currency },
      pickupWindow: { startsAt: order.pickupStartsAt, endsAt: order.pickupEndsAt },
      pickupCode: order.status === 'PICKUP_PENDING' ? order.pickupCode : null,
      createdAt: order.createdAt,
      collectedAt: order.collectedAt,
    }));
  }

  /** "Eylül Kaya" -> "Eylül K." */
  private maskName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  /**
   * İşletme tarafından teslim onayı.
   *
   * Müşteri uygulamayı açamadığında (şarj bitti, internet yok) personel
   * teslim kodunu girerek siparişi tamamlayabilir.
   */
  async confirmPickupByCode(user: AuthenticatedUser, orderId: string, pickupCode: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);

    await this.access.requireStore(user, order.storeId, 'STAFF');

    if (order.status === 'COLLECTED') {
      return { status: 'collected', alreadyCollected: true };
    }

    if (order.status !== 'PICKUP_PENDING') {
      throw AppError.unprocessable(
        ErrorCode.ORDER_NOT_READY_FOR_PICKUP,
        'Sipariş teslim alınabilir durumda değil.',
      );
    }

    if (order.pickupCode !== pickupCode) {
      throw AppError.unprocessable(
        ErrorCode.PICKUP_NONCE_INVALID,
        'Teslim kodu hatalı.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'COLLECTED',
          collectedAt: new Date(),
          pickupNonceHash: null,
          pickupNonceExpiresAt: null,
        },
      });

      await tx.store.update({
        where: { id: order.storeId },
        data: { rescuedBagCount: { increment: order.quantity } },
      });

      await tx.outboxEvent.create({
        data: {
          type: 'order.status.updated',
          payload: { orderId, status: 'collected', userId: order.userId },
        },
      });
    });

    return { status: 'collected', alreadyCollected: false };
  }

  // -------------------------------------------------------------------------
  // Mağaza profili
  // -------------------------------------------------------------------------

  async myStores(user: AuthenticatedUser) {
    const stores = await this.access.storesFor(user);
    return stores.map((store) => presentStore(store));
  }

  async updateStore(user: AuthenticatedUser, dto: UpdateStoreDto, storeId?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId, 'MANAGER')
      : await this.access.defaultStore(user);

    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: dto.name,
        description: dto.description,
        phone: dto.phone,
        addressLine: dto.addressLine,
        district: dto.district,
        city: dto.city,
        latitude: dto.latitude,
        longitude: dto.longitude,
        openingTime: dto.openingTime,
        closingTime: dto.closingTime,
        logoUrl: dto.logoUrl,
        coverUrl: dto.coverUrl,
      },
    });

    return presentStore(updated);
  }

  // -------------------------------------------------------------------------
  // Başvuru (herkese açık)
  // -------------------------------------------------------------------------

  async submitApplication(dto: PartnerApplicationDto) {
    const application = await this.prisma.partnerApplication.create({
      data: {
        businessName: dto.businessName,
        businessType: dto.businessType,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        city: dto.city,
        district: dto.district,
        note: dto.note,
      },
    });

    await this.mail.sendPartnerApplicationReceived(dto.email, dto.businessName);

    this.logger.log(`İşletme başvurusu: ${dto.businessName} (${dto.city})`);

    return { id: application.id, status: application.status.toLowerCase() };
  }
}
