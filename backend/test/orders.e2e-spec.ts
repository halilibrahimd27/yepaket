import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Sipariş, ödeme ve teslim akışı.
 *
 * Buradaki testler paranın ve stoğun doğruluğunu korur. Sessizce bozulursa
 * sonuçları geri alınamaz: aşırı satış, çift tahsilat veya teslim
 * doğrulamasının atlanması.
 */
describe('Sipariş (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let storeId: string;

  const device = { deviceId: 'e2e-siparis', platform: 'IOS' as const };
  const createdBagIds: string[] = [];

  const api = () => request(app.getHttpServer() as App);

  /**
   * Her testten sonra ödemesi tamamlanmamış rezervasyonları temizler.
   *
   * Sunucu bir kullanıcının aynı anda 3'ten fazla bekleyen rezervasyonuna
   * izin vermiyor (stok kilitleme suistimalini engellemek için). Testler
   * arka arkaya sipariş açtığı için bu sınıra takılırlardı; her test kendi
   * temiz durumundan başlamalı.
   */
  afterEach(async () => {
    await prisma.order.updateMany({
      where: { userId, status: 'PAYMENT_PENDING' },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
  });
  const key = () => `e2e-${Math.random().toString(36).slice(2)}`;

  /** Teslim aralığı istenen zamanda olan taze bir paket üretir. */
  async function makeBag(options: {
    quantity: number;
    startsInMinutes: number;
    endsInMinutes: number;
    priceMinor?: number;
  }): Promise<string> {
    const bag = await prisma.bag.create({
      data: {
        storeId,
        title: `Test Paketi ${Math.random().toString(36).slice(2, 7)}`,
        category: 'BAKERY',
        imageUrls: [],
        // Normal değer satış fiyatının altına düşemez (bags_price_not_above_value).
        originalValueMinor: Math.max(40_000, (options.priceMinor ?? 10_000) * 3),
        salePriceMinor: options.priceMinor ?? 10_000,
        totalQuantity: options.quantity,
        availableQuantity: options.quantity,
        pickupStartsAt: new Date(Date.now() + options.startsInMinutes * 60_000),
        pickupEndsAt: new Date(Date.now() + options.endsInMinutes * 60_000),
        status: 'PUBLISHED',
      },
    });

    createdBagIds.push(bag.id);
    return bag.id;
  }

  /** Sipariş oluşturup ödemesini tamamlar; teslime hazır hâle getirir. */
  async function paidOrder(bagId: string, quantity = 1) {
    const created = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ bagId, quantity })
      .expect(201);

    const orderId = created.body.data.id as string;

    await api()
      .post(`/v1/orders/${orderId}/payment-callback`)
      .send({ status: 'success' })
      .expect(200);

    return orderId;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const login = await api()
      .post('/v1/auth/login')
      .send({ email: 'demo@yepaket.app', password: 'demo1234', device })
      .expect(200);

    token = login.body.data.access_token;
    userId = login.body.data.user.id;

    const store = await prisma.store.findFirstOrThrow({ where: { status: 'APPROVED' } });
    storeId = store.id;
  });

  afterAll(async () => {
    // Silme sırası yabancı anahtarlara uymalı: iade -> ödeme -> sipariş -> paket.
    const orders = await prisma.order.findMany({
      where: { bagId: { in: createdBagIds } },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);

    const payments = await prisma.payment.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    });

    await prisma.refund.deleteMany({
      where: { paymentId: { in: payments.map((payment) => payment.id) } },
    });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.bag.deleteMany({ where: { id: { in: createdBagIds } } });
    await app.close();
  });

  it('Idempotency-Key olmadan sipariş oluşturulamaz', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: 180, endsInMinutes: 240 });

    const response = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ bagId, quantity: 1 })
      .expect(422);

    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('aynı anahtarla tekrar gönderilen istek ikinci sipariş oluşturmaz', async () => {
    const bagId = await makeBag({ quantity: 5, startsInMinutes: 180, endsInMinutes: 240 });
    const idempotencyKey = key();

    const first = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bagId, quantity: 1 })
      .expect(201);

    const second = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bagId, quantity: 1 })
      .expect(201);

    expect(second.body.data.order_no).toBe(first.body.data.order_no);

    const bag = await prisma.bag.findUniqueOrThrow({ where: { id: bagId } });
    expect(bag.availableQuantity).toBe(4);
  });

  it('aynı anahtar farklı gövdeyle kullanılamaz', async () => {
    const bagId = await makeBag({ quantity: 5, startsInMinutes: 180, endsInMinutes: 240 });
    const idempotencyKey = key();

    await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bagId, quantity: 1 })
      .expect(201);

    const conflict = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ bagId, quantity: 2 })
      .expect(409);

    expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('eşzamanlı siparişlerde stok aşırı satılmaz', async () => {
    const bagId = await makeBag({ quantity: 3, startsInMinutes: 180, endsInMinutes: 240 });

    // On istemci aynı anda son üç adede saldırıyor.
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        api()
          .post('/v1/orders')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key())
          .send({ bagId, quantity: 1 }),
      ),
    );

    const accepted = attempts.filter((response) => response.status === 201);
    const rejected = attempts.filter((response) => response.status !== 201);

    expect(accepted).toHaveLength(3);
    expect(rejected).toHaveLength(7);
    expect(
      rejected.every((response) =>
        ['BAG_SOLD_OUT', 'INSUFFICIENT_STOCK'].includes(response.body.error.code),
      ),
    ).toBe(true);

    const bag = await prisma.bag.findUniqueOrThrow({ where: { id: bagId } });
    expect(bag.availableQuantity).toBe(0);
    expect(bag.status).toBe('SOLD_OUT');
  });

  it('stoktan fazla adet istenemez', async () => {
    const bagId = await makeBag({ quantity: 2, startsInMinutes: 180, endsInMinutes: 240 });

    const response = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ bagId, quantity: 5 })
      .expect(409);

    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(response.body.error.details.available_quantity).toBe(2);
  });

  it('komisyon ve net tutar sipariş anında dondurulur', async () => {
    const bagId = await makeBag({
      quantity: 2,
      startsInMinutes: 180,
      endsInMinutes: 240,
      priceMinor: 10_000,
    });

    const created = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ bagId, quantity: 2 })
      .expect(201);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: created.body.data.id as string },
      include: { store: true },
    });

    expect(order.totalMinor).toBe(20_000);
    expect(order.commissionMinor).toBe(
      Math.round((20_000 * order.store.commissionRateBps) / 10_000),
    );
    expect(order.netMinor).toBe(order.totalMinor - order.commissionMinor);
  });

  it('ödeme tamamlanmadan teslim kodu verilmez', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: -5, endsInMinutes: 60 });

    const created = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ bagId, quantity: 1 })
      .expect(201);

    const response = await api()
      .post(`/v1/orders/${created.body.data.id}/pickup-nonce`)
      .set('Authorization', `Bearer ${token}`)
      .expect(422);

    expect(response.body.error.code).toBe('ORDER_NOT_READY_FOR_PICKUP');
  });

  it('teslim aralığı açılmadan teslim kodu verilmez', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: 180, endsInMinutes: 240 });
    const orderId = await paidOrder(bagId);

    const response = await api()
      .post(`/v1/orders/${orderId}/pickup-nonce`)
      .set('Authorization', `Bearer ${token}`)
      .expect(422);

    expect(response.body.error.code).toBe('PICKUP_WINDOW_CLOSED');
  });

  it('geçersiz nonce ile teslim onaylanamaz', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: -5, endsInMinutes: 60 });
    const orderId = await paidOrder(bagId);

    const response = await api()
      .post(`/v1/orders/${orderId}/pickup`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ pickupNonce: 'uydurma-bir-deger-12345' })
      .expect(422);

    expect(response.body.error.code).toBe('PICKUP_NONCE_INVALID');
  });

  it('geçerli nonce ile teslim tamamlanır ve nonce tükenir', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: -5, endsInMinutes: 60 });
    const orderId = await paidOrder(bagId);

    const nonceResponse = await api()
      .post(`/v1/orders/${orderId}/pickup-nonce`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const nonce = nonceResponse.body.data.nonce as string;

    const collected = await api()
      .post(`/v1/orders/${orderId}/pickup`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ pickupNonce: nonce })
      .expect(200);

    expect(collected.body.data.status).toBe('collected');

    // Nonce tek kullanımlıktır: veritabanında temizlenmiş olmalı.
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.pickupNonceHash).toBeNull();
    expect(order.collectedAt).not.toBeNull();
  });

  it('başkasının siparişi görüntülenemez ve varlığı sızdırılmaz', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: 180, endsInMinutes: 240 });
    const orderId = await paidOrder(bagId);

    const otherLogin = await api()
      .post('/v1/auth/login')
      .send({
        email: 'demo@modafirini.com',
        password: 'demo1234',
        device: { deviceId: 'e2e-baskasi', platform: 'ANDROID' },
      })
      .expect(200);

    const response = await api()
      .get(`/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherLogin.body.data.access_token}`)
      .expect(404);

    // "Yetkiniz yok" demek siparişin var olduğunu doğrulardı.
    expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('iptal stoğu geri verir ve paketi yeniden yayına alır', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: 240, endsInMinutes: 300 });
    const orderId = await paidOrder(bagId);

    const soldOut = await prisma.bag.findUniqueOrThrow({ where: { id: bagId } });
    expect(soldOut.availableQuantity).toBe(0);
    expect(soldOut.status).toBe('SOLD_OUT');

    const cancelled = await api()
      .post(`/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ reason: 'planlarım değişti' })
      .expect(200);

    expect(['cancelled', 'refunded']).toContain(cancelled.body.data.status);

    const restored = await prisma.bag.findUniqueOrThrow({ where: { id: bagId } });
    expect(restored.availableQuantity).toBe(1);
    expect(restored.status).toBe('PUBLISHED');
  });

  it('teslim saatine az kalan sipariş iptal edilemez', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: 30, endsInMinutes: 90 });
    const orderId = await paidOrder(bagId);

    const response = await api()
      .post(`/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({})
      .expect(422);

    expect(response.body.error.code).toBe('CANCEL_WINDOW_CLOSED');
  });

  it('teslim alınmış sipariş iptal edilemez', async () => {
    const bagId = await makeBag({ quantity: 1, startsInMinutes: -5, endsInMinutes: 60 });
    const orderId = await paidOrder(bagId);

    const nonceResponse = await api()
      .post(`/v1/orders/${orderId}/pickup-nonce`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await api()
      .post(`/v1/orders/${orderId}/pickup`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ pickupNonce: nonceResponse.body.data.nonce })
      .expect(200);

    const response = await api()
      .post(`/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({})
      .expect(422);

    expect(response.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
  });

  it('ödeme başarısız olursa rezervasyon hemen geri verilir', async () => {
    // Sahte sağlayıcı 666,00 TL tutarında ödemeyi reddeder.
    const bagId = await makeBag({
      quantity: 1,
      startsInMinutes: 180,
      endsInMinutes: 240,
      priceMinor: 66_600,
    });

    const response = await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ bagId, quantity: 1 })
      .expect(422);

    expect(response.body.error.code).toBe('PAYMENT_FAILED');

    const bag = await prisma.bag.findUniqueOrThrow({ where: { id: bagId } });
    expect(bag.availableQuantity).toBe(1);
    expect(bag.status).toBe('PUBLISHED');
  });

  it('stok değişimi outbox olayına yazılır', async () => {
    const bagId = await makeBag({ quantity: 2, startsInMinutes: 180, endsInMinutes: 240 });

    await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key())
      .send({ bagId, quantity: 1 })
      .expect(201);

    const events = await prisma.outboxEvent.findMany({
      where: { type: 'bag.stock.updated' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const matching = events.find(
      (event) => (event.payload as { bagId?: string }).bagId === bagId,
    );
    expect(matching).toBeDefined();
  });

  it('kullanıcı kendi siparişlerini listeler', async () => {
    const response = await api()
      .get('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const orders = response.body.data as { id: string }[];
    expect(Array.isArray(orders)).toBe(true);

    const owned = await prisma.order.count({ where: { userId } });
    expect(orders.length).toBeLessThanOrEqual(owned);
  });
});
