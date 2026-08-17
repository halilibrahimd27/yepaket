import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { Prisma, type Order, type OrderStatus } from '../../generated/prisma/client';
import { PaymentProvider } from '../payments/payment-provider';
import { presentBag, type BagView } from '../catalog/catalog.presenter';

export interface OrderView {
  id: string;
  orderNo: string;
  status: string;
  quantity: number;
  total: { amountMinor: number; currency: string };
  pickupWindow: { startsAt: Date; endsAt: Date };
  pickupCode: string;
  /** Teslim aralığı açıldı mı — istemci kaydırıcıyı buna göre etkinleştirir. */
  pickupAvailable: boolean;
  bag: BagView;
  createdAt: Date;
  collectedAt: Date | null;
  cancelledAt: Date | null;
  payment?: {
    status: string;
    redirectUrl?: string;
    htmlContent?: string;
    failureMessage?: string;
  };
}

/**
 * Sipariş akışı.
 *
 * Tasarımın merkezinde tek bir soru var: aynı paketin son adedi için iki
 * kişi aynı anda ödeme yaparsa ne olur? Cevap uygulama katmanında değil,
 * veritabanında verilir — `SELECT ... FOR UPDATE` ile satır kilitlenir.
 */
/**
 * Bir kullanıcının aynı anda bekletebileceği ödeme sayısı.
 *
 * Rezervasyon stoğu kilitlediği için bu sayı doğrudan işletmenin satış
 * kaybına dönüşür.
 */
const MAX_PENDING_RESERVATIONS = 3;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly payments: PaymentProvider,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** İnsan tarafından okunabilir sipariş numarası: YP-000123. */
  private async nextOrderNo(tx: Prisma.TransactionClient): Promise<string> {
    const [{ value }] = await tx.$queryRaw<[{ value: bigint }]>`
      SELECT nextval('order_no_seq') AS value
    `;
    return `YP-${String(value).padStart(6, '0')}`;
  }

  private pickupCode(): string {
    // Okunması kolay olsun diye 6 haneli sayısal kod; güvenlik nonce ile
    // sağlanır, bu kod yalnızca personelin siparişi bulmasına yarar.
    return String(randomInt(100_000, 1_000_000));
  }

  present(
    order: Order & { bag: Parameters<typeof presentBag>[0] },
    extra: OrderView['payment'] = undefined,
  ): OrderView {
    const now = Date.now();
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status.toLowerCase(),
      quantity: order.quantity,
      total: { amountMinor: order.totalMinor, currency: order.currency },
      pickupWindow: { startsAt: order.pickupStartsAt, endsAt: order.pickupEndsAt },
      pickupCode: order.pickupCode,
      pickupAvailable:
        order.status === 'PICKUP_PENDING' &&
        now >= order.pickupStartsAt.getTime() &&
        now <= order.pickupEndsAt.getTime(),
      bag: presentBag(order.bag),
      createdAt: order.createdAt,
      collectedAt: order.collectedAt,
      cancelledAt: order.cancelledAt,
      payment: extra,
    };
  }

  /**
   * Sipariş oluşturur ve ödemeyi başlatır.
   *
   * Stok, ödeme onayı beklenmeden düşülür (rezervasyon): aksi hâlde ödeme
   * sayfasındayken paket başkasına satılabilirdi. Ödeme tamamlanmazsa
   * zamanlanmış iş rezervasyonu geri verir.
   */
  async create(
    userId: string,
    input: { bagId: string; quantity: number },
    context: { ipAddress: string },
  ): Promise<OrderView> {
    const reservationTtl =
      this.config.get('ORDER_RESERVATION_TTL_MINUTES', { infer: true }) * 60_000;

    // Aynı anda bekleyen rezervasyon sayısı sınırlıdır.
    //
    // Hız sınırı dakikadaki istek sayısını kısıtlar ama biriken rezervasyonu
    // engellemez: dakikada 10 sipariş açıp ödemeyi hiç tamamlamayan bir hesap,
    // 15 dakika içinde 150 paketi satılamaz hâle getirebilirdi. Gerçek bir
    // kullanıcının aynı anda ödemesi biten 3'ten fazla siparişi olmaz.
    const pending = await this.prisma.order.count({
      where: {
        userId,
        status: 'PAYMENT_PENDING',
        reservationExpiresAt: { gt: new Date() },
      },
    });

    if (pending >= MAX_PENDING_RESERVATIONS) {
      throw AppError.unprocessable(
        ErrorCode.TOO_MANY_PENDING_ORDERS,
        'Ödemesi tamamlanmamış siparişlerin var. Önce onları tamamla veya iptal et.',
      );
    }

    const { order, bag } = await this.prisma.$transaction(async (tx) => {
      // Satır kilidi: aynı paketi hedefleyen diğer transaction'lar burada
      // bekler. Kilit alındıktan SONRA stok okunur; okunan değer güncel
      // olmak zorundadır.
      const locked = await tx.$queryRaw<
        { id: string; available_quantity: number; status: string }[]
      >`
        SELECT id, available_quantity, status
        FROM bags
        WHERE id = ${input.bagId}::uuid
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw AppError.notFound('Paket', ErrorCode.BAG_NOT_FOUND);
      }

      const bagRow = locked[0];

      const bag = await tx.bag.findUniqueOrThrow({
        where: { id: input.bagId },
        include: { store: true },
      });

      // Tükenmişlik ayrı bir koddur: istemci "tükendi" ile "satışta değil"
      // durumlarını farklı gösterir ve tükenen paket için bildirim önerir.
      if (bagRow.status === 'SOLD_OUT' || bagRow.available_quantity === 0) {
        throw AppError.conflict(ErrorCode.BAG_SOLD_OUT, 'Bu paket tükendi.', {
          availableQuantity: 0,
        });
      }

      if (bagRow.status !== 'PUBLISHED') {
        throw AppError.unprocessable(
          ErrorCode.BAG_NOT_AVAILABLE,
          'Bu paket şu anda satışta değil.',
        );
      }

      if (bag.pickupEndsAt.getTime() <= Date.now()) {
        throw AppError.unprocessable(
          ErrorCode.BAG_NOT_AVAILABLE,
          'Bu paketin teslim aralığı sona ermiş.',
        );
      }

      if (bag.store.status !== 'APPROVED') {
        throw AppError.unprocessable(
          ErrorCode.STORE_NOT_APPROVED,
          'İşletme şu anda sipariş kabul etmiyor.',
        );
      }

      if (bagRow.available_quantity < input.quantity) {
        throw AppError.conflict(
          bagRow.available_quantity === 0
            ? ErrorCode.BAG_SOLD_OUT
            : ErrorCode.INSUFFICIENT_STOCK,
          bagRow.available_quantity === 0
            ? 'Bu paket tükendi.'
            : `Bu paketten yalnızca ${bagRow.available_quantity} adet kaldı.`,
          { availableQuantity: bagRow.available_quantity },
        );
      }

      const remaining = bagRow.available_quantity - input.quantity;

      await tx.bag.update({
        where: { id: bag.id },
        data: {
          availableQuantity: remaining,
          // Stok bitince paket otomatik olarak tükendi durumuna geçer;
          // keşif sorgusu zaten stoğu sıfır olanı listelemez ama durum
          // alanının doğru olması partner panelinde önemlidir.
          status: remaining === 0 ? 'SOLD_OUT' : undefined,
        },
      });

      const totalMinor = bag.salePriceMinor * input.quantity;
      // Komisyon oranı sipariş anında dondurulur: sonradan yapılan oran
      // değişikliği geçmiş hakedişi değiştirmemelidir.
      const commissionMinor = Math.round((totalMinor * bag.store.commissionRateBps) / 10_000);

      const order = await tx.order.create({
        data: {
          orderNo: await this.nextOrderNo(tx),
          userId,
          storeId: bag.storeId,
          bagId: bag.id,
          quantity: input.quantity,
          unitPriceMinor: bag.salePriceMinor,
          totalMinor,
          commissionMinor,
          netMinor: totalMinor - commissionMinor,
          currency: bag.currency,
          status: 'PAYMENT_PENDING',
          pickupStartsAt: bag.pickupStartsAt,
          pickupEndsAt: bag.pickupEndsAt,
          pickupCode: this.pickupCode(),
          reservationExpiresAt: new Date(Date.now() + reservationTtl),
        },
      });

      // Olay, sipariş ile aynı transaction'da yazılır: "veritabanı yazıldı
      // ama olay yayınlanmadı" durumu oluşamaz.
      await tx.outboxEvent.create({
        data: {
          type: 'bag.stock.updated',
          payload: { bagId: bag.id, availableQuantity: remaining, storeId: bag.storeId },
        },
      });

      return { order, bag };
    });

    // Ödeme başlatma transaction'ın DIŞINDA: dış servis çağrısı sırasında
    // satır kilidini tutmak, yoğunlukta tüm siparişleri bloke ederdi.
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const apiUrl = this.config.get('API_PUBLIC_URL', { infer: true });

    const initialized = await this.payments.initialize({
      orderId: order.id,
      conversationId: order.orderNo,
      amountMinor: order.totalMinor,
      currency: order.currency,
      buyer: {
        id: user.id,
        name: user.name,
        surname: '',
        email: user.email,
        ipAddress: context.ipAddress,
        phone: user.phone ?? undefined,
      },
      basket: [
        {
          id: bag.id,
          name: bag.title,
          category: bag.category,
          priceMinor: order.totalMinor,
        },
      ],
      callbackUrl: `${apiUrl}/v1/orders/${order.id}/payment-callback`,
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: this.payments.name,
        providerPaymentId: initialized.providerPaymentId,
        status: initialized.status === 'failed' ? 'FAILED' : 'PENDING',
        amountMinor: order.totalMinor,
        currency: order.currency,
        failureCode: initialized.failureCode,
        failureMessage: initialized.failureMessage,
      },
    });

    if (initialized.status === 'failed') {
      // Ödeme başlatılamadıysa rezervasyon hemen geri verilir; kullanıcıyı
      // 15 dakika bekletmenin anlamı yok.
      await this.releaseReservation(order.id, 'payment_initialization_failed');
      throw AppError.unprocessable(
        ErrorCode.PAYMENT_FAILED,
        initialized.failureMessage ?? 'Ödeme başlatılamadı.',
      );
    }

    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { bag: { include: { store: true } } },
    });

    return this.present(fresh, {
      status: 'requires_action',
      redirectUrl: initialized.redirectUrl,
      htmlContent: initialized.htmlContent,
    });
  }

  /**
   * Ödeme sağlayıcısının dönüşünü işler ve siparişi teslime hazır duruma
   * getirir. Aynı çağrı birden çok kez gelebilir (kullanıcı yenileme yapar,
   * sağlayıcı webhook'u tekrarlar) — bu yüzden idempotenttir.
   */
  async completePayment(
    orderId: string,
    providerPayload: Record<string, unknown>,
  ): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bag: { include: { store: true } }, payments: true },
    });

    if (!order) throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);

    // Zaten tamamlanmışsa tekrar işleme sokma.
    if (order.status !== 'PAYMENT_PENDING') {
      return this.present(order, { status: 'already_processed' });
    }

    const payment = order.payments.find((item) => item.status === 'PENDING');
    if (!payment?.providerPaymentId) {
      throw AppError.unprocessable(ErrorCode.PAYMENT_FAILED, 'Bekleyen ödeme bulunamadı.');
    }

    const result = await this.payments.complete({
      providerPaymentId: payment.providerPaymentId,
      conversationId: order.orderNo,
      providerPayload,
    });

    if (result.status === 'failed') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          providerStatus: result.providerStatus,
          failureCode: result.failureCode,
          failureMessage: result.failureMessage,
        },
      });

      await this.releaseReservation(order.id, 'payment_failed');

      throw AppError.unprocessable(
        ErrorCode.PAYMENT_FAILED,
        result.failureMessage ?? 'Ödeme tamamlanamadı.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CAPTURED',
          providerPaymentId: result.providerPaymentId,
          providerStatus: result.providerStatus,
          cardLastFour: result.cardLastFour,
          cardBrand: result.cardBrand,
          capturedAt: new Date(),
        },
      });

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PICKUP_PENDING',
          paidAt: new Date(),
          // Ödeme alındı; rezervasyonun süresi dolup iptal edilmemeli.
          reservationExpiresAt: null,
        },
        include: { bag: { include: { store: true } } },
      });

      await tx.outboxEvent.create({
        data: {
          type: 'order.status.updated',
          payload: { orderId: order.id, status: 'pickup_pending', userId: order.userId },
        },
      });

      await tx.outboxEvent.create({
        data: {
          type: 'partner.order.created',
          payload: { orderId: order.id, storeId: order.storeId, orderNo: order.orderNo },
        },
      });

      return updated;
    });

    return this.present(updated, { status: 'captured' });
  }

  /** Rezervasyonu geri verir ve stoğu iade eder. */
  private async releaseReservation(orderId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== 'PAYMENT_PENDING') return;

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });

      // Stok geri verilirken paket tekrar yayına alınır: tükendi diye
      // işaretlenmişse yeniden satılabilir olmalıdır.
      await tx.bag.update({
        where: { id: order.bagId },
        data: {
          availableQuantity: { increment: order.quantity },
          status: 'PUBLISHED',
        },
      });

      await tx.outboxEvent.create({
        data: {
          type: 'bag.available',
          payload: { bagId: order.bagId, storeId: order.storeId },
        },
      });
    });

    this.logger.log(`Rezervasyon geri verildi: ${orderId} (${reason})`);
  }

  /**
   * Süresi dolan rezervasyonları temizler. Zamanlanmış iş çağırır.
   * Ödemesi tamamlanmamış sipariş stoğu süresiz tutamaz.
   */
  async expireStaleReservations(): Promise<number> {
    const stale = await this.prisma.order.findMany({
      where: {
        status: 'PAYMENT_PENDING',
        reservationExpiresAt: { lt: new Date() },
      },
      select: { id: true },
      take: 200,
    });

    for (const order of stale) {
      await this.releaseReservation(order.id, 'reservation_expired');
    }

    return stale.length;
  }

  async listForUser(userId: string, status?: OrderStatus[]): Promise<OrderView[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: status ? { in: status } : undefined },
      include: { bag: { include: { store: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return orders.map((order) => this.present(order));
  }

  async byId(orderId: string, userId: string): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { bag: { include: { store: true } } },
    });

    // Başkasının siparişi "bulunamadı" döner: sipariş kimliğinin varlığı
    // sızdırılmaz.
    if (!order || order.userId !== userId) {
      throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);
    }

    return this.present(order);
  }

  /**
   * Teslim için tek kullanımlık nonce üretir.
   *
   * Nonce yalnızca teslim aralığı içindeyken ve sunucu saatine göre
   * verilir; istemcinin saatine güvenilmez.
   */
  async issuePickupNonce(orderId: string, userId: string): Promise<{ nonce: string; expiresAt: Date }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order || order.userId !== userId) {
      throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);
    }

    if (order.status === 'COLLECTED') {
      throw AppError.conflict(
        ErrorCode.ORDER_ALREADY_COLLECTED,
        'Bu sipariş zaten teslim alınmış.',
      );
    }

    if (order.status !== 'PICKUP_PENDING') {
      throw AppError.unprocessable(
        ErrorCode.ORDER_NOT_READY_FOR_PICKUP,
        'Sipariş teslim alınabilir durumda değil.',
      );
    }

    const now = Date.now();
    if (now < order.pickupStartsAt.getTime() || now > order.pickupEndsAt.getTime()) {
      throw AppError.unprocessable(
        ErrorCode.PICKUP_WINDOW_CLOSED,
        'Teslim alma yalnızca belirtilen zaman aralığında yapılabilir.',
        { startsAt: order.pickupStartsAt, endsAt: order.pickupEndsAt },
      );
    }

    const nonce = randomBytes(24).toString('base64url');
    const ttl = this.config.get('PICKUP_NONCE_TTL_MINUTES', { infer: true }) * 60_000;
    const expiresAt = new Date(now + ttl);

    await this.prisma.order.update({
      where: { id: orderId },
      data: { pickupNonceHash: this.hashToken(nonce), pickupNonceExpiresAt: expiresAt },
    });

    return { nonce, expiresAt };
  }

  /**
   * Teslim onayı.
   *
   * Kaydırma hareketi tek başına yeterli değildir: sunucu nonce'ı, sipariş
   * sahipliğini ve zaman aralığını kendi saatine göre doğrular.
   */
  async confirmPickup(orderId: string, userId: string, nonce: string): Promise<OrderView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { bag: { include: { store: true } } },
      });

      if (!order || order.userId !== userId) {
        throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);
      }

      if (order.status === 'COLLECTED') {
        // Idempotent: aynı onay tekrar gelirse hata değil, mevcut durum döner.
        return order;
      }

      if (order.status !== 'PICKUP_PENDING') {
        throw AppError.unprocessable(
          ErrorCode.ORDER_NOT_READY_FOR_PICKUP,
          'Sipariş teslim alınabilir durumda değil.',
        );
      }

      const now = Date.now();
      if (now < order.pickupStartsAt.getTime() || now > order.pickupEndsAt.getTime()) {
        throw AppError.unprocessable(
          ErrorCode.PICKUP_WINDOW_CLOSED,
          'Teslim alma yalnızca belirtilen zaman aralığında yapılabilir.',
        );
      }

      const hash = this.hashToken(nonce);
      const nonceValid =
        order.pickupNonceHash === hash &&
        order.pickupNonceExpiresAt !== null &&
        order.pickupNonceExpiresAt.getTime() > now;

      if (!nonceValid) {
        throw AppError.unprocessable(
          ErrorCode.PICKUP_NONCE_INVALID,
          'Teslim doğrulaması geçersiz veya süresi dolmuş. Lütfen ekranı yenileyin.',
        );
      }

      const collected = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'COLLECTED',
          collectedAt: new Date(),
          // Nonce tek kullanımlıktır: tüketildikten sonra geçersiz kalır.
          pickupNonceHash: null,
          pickupNonceExpiresAt: null,
          sharedTokenHash: null,
          sharedTokenExpiresAt: null,
        },
        include: { bag: { include: { store: true } } },
      });

      await tx.store.update({
        where: { id: order.storeId },
        data: { rescuedBagCount: { increment: order.quantity } },
      });

      await tx.outboxEvent.create({
        data: {
          type: 'order.status.updated',
          payload: { orderId, status: 'collected', userId },
        },
      });

      return collected;
    });

    return this.present(updated);
  }

  /**
   * Kullanıcı iptali.
   *
   * Ücretsiz iptal penceresi teslim aralığına kalan süreye göre belirlenir;
   * pencere kapandıktan sonra iptal edilemez (işletme ürünü ayırmıştır).
   */
  async cancel(orderId: string, userId: string, reason?: string): Promise<OrderView> {
    const freeCancelWindow =
      this.config.get('FREE_CANCEL_WINDOW_MINUTES', { infer: true }) * 60_000;

    const { order, payment } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { bag: { include: { store: true } }, payments: true },
      });

      if (!order || order.userId !== userId) {
        throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);
      }

      if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
        return { order, payment: null };
      }

      if (order.status === 'COLLECTED') {
        throw AppError.unprocessable(
          ErrorCode.ORDER_NOT_CANCELLABLE,
          'Teslim alınmış sipariş iptal edilemez.',
        );
      }

      if (order.pickupStartsAt.getTime() - Date.now() < freeCancelWindow) {
        throw AppError.unprocessable(
          ErrorCode.CANCEL_WINDOW_CLOSED,
          'Teslim saatine az kaldığı için sipariş iptal edilemiyor. Destek ile iletişime geçebilirsiniz.',
        );
      }

      const cancelled = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason ?? 'user_requested',
        },
        include: { bag: { include: { store: true } } },
      });

      await tx.bag.update({
        where: { id: order.bagId },
        data: { availableQuantity: { increment: order.quantity }, status: 'PUBLISHED' },
      });

      await tx.outboxEvent.create({
        data: { type: 'bag.available', payload: { bagId: order.bagId, storeId: order.storeId } },
      });
      await tx.outboxEvent.create({
        data: {
          type: 'order.status.updated',
          payload: { orderId, status: 'cancelled', userId },
        },
      });

      const captured = order.payments.find((item) => item.status === 'CAPTURED');
      return { order: cancelled, payment: captured ?? null };
    });

    // İade dış servis çağrısıdır; transaction dışında yapılır.
    if (payment?.providerPaymentId) {
      const refund = await this.payments.refund({
        providerPaymentId: payment.providerPaymentId,
        conversationId: order.orderNo,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        ipAddress: '127.0.0.1',
        reason: reason ?? 'user_requested',
      });

      await this.prisma.refund.create({
        data: {
          paymentId: payment.id,
          amountMinor: payment.amountMinor,
          reason: reason ?? 'user_requested',
          status: refund.status === 'succeeded' ? 'SUCCEEDED' : 'FAILED',
          providerRefundId: refund.providerRefundId,
        },
      });

      if (refund.status === 'succeeded') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED', refundedAmountMinor: payment.amountMinor },
        });
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'REFUNDED' },
        });
      } else {
        // İade başarısızsa sipariş iptal kalır ama kayıt tutulur:
        // mutabakatta elle işlenmesi gerekir.
        this.logger.error(
          `İade başarısız, elle işlem gerekli: sipariş ${order.orderNo} (${refund.failureMessage})`,
        );
      }
    }

    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { bag: { include: { store: true } } },
    });

    return this.present(fresh);
  }

  /**
   * Sipariş değerlendirmesi.
   *
   * Yalnızca teslim alınmış sipariş puanlanabilir: teslim almadan puan
   * vermek, hiç yaşanmamış bir deneyimi değerlendirmek olurdu. Her sipariş
   * bir kez puanlanır ve mağaza ortalaması aynı transaction'da güncellenir.
   */
  async rateOrder(
    orderId: string,
    userId: string,
    input: {
      overall: number;
      foodQuality?: number;
      pickupExperience?: number;
      tags?: string[];
      comment?: string;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { rating: true },
    });

    if (!order || order.userId !== userId) {
      throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);
    }

    if (order.status !== 'COLLECTED') {
      throw AppError.unprocessable(
        ErrorCode.ORDER_NOT_READY_FOR_PICKUP,
        'Yalnızca teslim alınmış sipariş değerlendirilebilir.',
      );
    }

    if (order.rating) {
      throw AppError.conflict(
        ErrorCode.VALIDATION_FAILED,
        'Bu sipariş zaten değerlendirilmiş.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: {
          orderId,
          userId,
          storeId: order.storeId,
          overall: input.overall,
          foodQuality: input.foodQuality,
          pickupExperience: input.pickupExperience,
          tags: input.tags ?? [],
          comment: input.comment,
        },
      });

      // Ortalamayı yeniden hesaplamak yerine artımlı güncellemek, puan
      // sayısı büyüdüğünde tüm satırları taramaktan kaçınır.
      const store = await tx.store.findUniqueOrThrow({
        where: { id: order.storeId },
        select: { ratingAverage: true, ratingCount: true },
      });

      const nextCount = store.ratingCount + 1;
      const nextAverage =
        (store.ratingAverage * store.ratingCount + input.overall) / nextCount;

      await tx.store.update({
        where: { id: order.storeId },
        data: {
          ratingCount: nextCount,
          // Kısıt 0-5 arası ister; kayan nokta birikimi sınırı aşmasın.
          ratingAverage: Math.min(5, Math.max(0, Number(nextAverage.toFixed(2)))),
        },
      });

      return {
        id: rating.id,
        overall: rating.overall,
        createdAt: rating.createdAt,
      };
    });
  }

  /**
   * "Arkadaşıma teslim aldır" bağlantısı.
   * Ayrı ve süreli bir jeton üretir; asıl pickup nonce'ı paylaşılmaz.
   */
  async sharePickup(orderId: string, userId: string): Promise<{ token: string; expiresAt: Date }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order || order.userId !== userId) {
      throw AppError.notFound('Sipariş', ErrorCode.ORDER_NOT_FOUND);
    }

    if (order.status !== 'PICKUP_PENDING') {
      throw AppError.unprocessable(
        ErrorCode.ORDER_NOT_READY_FOR_PICKUP,
        'Yalnızca teslim bekleyen sipariş paylaşılabilir.',
      );
    }

    const token = randomBytes(24).toString('base64url');
    const ttl = this.config.get('SHARED_PICKUP_TTL_MINUTES', { infer: true }) * 60_000;
    const expiresAt = new Date(Date.now() + ttl);

    await this.prisma.order.update({
      where: { id: orderId },
      data: { sharedTokenHash: this.hashToken(token), sharedTokenExpiresAt: expiresAt },
    });

    return { token, expiresAt };
  }
}
