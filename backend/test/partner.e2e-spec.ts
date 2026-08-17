import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';

/**
 * İşletme paneli, yönetici moderasyonu ve hakediş.
 *
 * Buradaki testlerin koruduğu şey çok kiracılı (multi-tenant) sınır: bir
 * işletme sahibinin başka bir işletmenin verisine erişememesi. Bu sessizce
 * bozulursa rakip işletmeler birbirinin siparişlerini görebilir.
 */
describe('Partner & Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let partnerToken: string;
  let adminToken: string;
  let consumerToken: string;
  let ownStoreId: string;
  let foreignStoreId: string;

  const device = { deviceId: 'e2e-partner', platform: 'WEB' as const };
  const createdBagIds: string[] = [];
  const createdApplicationIds: string[] = [];

  const api = () => request(app.getHttpServer() as App);
  const iso = (hoursFromNow: number) =>
    new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const login = async (email: string, deviceId: string) => {
      const response = await api()
        .post('/v1/auth/login')
        .send({ email, password: 'demo1234', device: { ...device, deviceId } })
        .expect(200);
      return response.body.data.access_token as string;
    };

    partnerToken = await login('demo@modafirini.com', 'e2e-partner');
    adminToken = await login('admin@yepaket.app', 'e2e-admin');
    consumerToken = await login('demo@yepaket.app', 'e2e-consumer');

    const own = await prisma.store.findFirstOrThrow({ where: { slug: 'moda-firini' } });
    const foreign = await prisma.store.findFirstOrThrow({
      where: { slug: { not: 'moda-firini' }, status: 'APPROVED' },
    });
    ownStoreId = own.id;
    foreignStoreId = foreign.id;
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
    await prisma.partnerApplication.deleteMany({
      where: { id: { in: createdApplicationIds } },
    });
    await app.close();
  });

  // --- Yetkilendirme --------------------------------------------------------

  it('tüketici partner uçlarına erişemez', async () => {
    const response = await api()
      .get('/v1/partner/dashboard')
      .set('Authorization', `Bearer ${consumerToken}`)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('partner admin uçlarına erişemez', async () => {
    const response = await api()
      .get('/v1/admin/overview')
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('partner başka bir işletmenin siparişlerini göremez', async () => {
    const response = await api()
      .get('/v1/partner/orders')
      .query({ storeId: foreignStoreId })
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(404);

    // "Yetkiniz yok" demek o işletmenin var olduğunu doğrulardı.
    expect(response.body.error.code).toBe('STORE_NOT_FOUND');
  });

  it('partner başka bir işletmenin paketini düzenleyemez', async () => {
    const foreignBag = await prisma.bag.findFirst({ where: { storeId: foreignStoreId } });
    if (!foreignBag) return;

    await api()
      .patch(`/v1/partner/bags/${foreignBag.id}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ quantity: 99 })
      .expect(404);
  });

  // --- Paket yönetimi -------------------------------------------------------

  it('paket oluşturur ve keşifte görünür', async () => {
    const created = await api()
      .post('/v1/partner/bags')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        title: 'E2E Test Paketi',
        category: 'bakery',
        originalValueMinor: 40_000,
        salePriceMinor: 12_000,
        quantity: 4,
        pickupStartsAt: iso(3),
        pickupEndsAt: iso(4),
      })
      .expect(201);

    createdBagIds.push(created.body.data.id);

    expect(created.body.data.available_quantity).toBe(4);
    expect(created.body.data.discount_percent).toBe(70);

    // Tüketici tarafında da görünmeli.
    const discovery = await api().get('/v1/bags/nearby').query({ q: 'E2E Test' }).expect(200);
    const found = (discovery.body.data as { id: string }[]).some(
      (bag) => bag.id === created.body.data.id,
    );
    expect(found).toBe(true);
  });

  it('satış fiyatı normal değeri aşamaz', async () => {
    const response = await api()
      .post('/v1/partner/bags')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        title: 'Hatalı Paket',
        category: 'bakery',
        originalValueMinor: 10_000,
        salePriceMinor: 50_000,
        quantity: 1,
        pickupStartsAt: iso(3),
        pickupEndsAt: iso(4),
      })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('geçmişte kalan teslim aralığıyla paket açılamaz', async () => {
    await api()
      .post('/v1/partner/bags')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        title: 'Geçmiş Paket',
        category: 'bakery',
        originalValueMinor: 40_000,
        salePriceMinor: 12_000,
        quantity: 1,
        pickupStartsAt: iso(-4),
        pickupEndsAt: iso(-3),
      })
      .expect(422);
  });

  it('satılmış adedin altına stok düşürülemez', async () => {
    const created = await api()
      .post('/v1/partner/bags')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        title: 'Stok Testi',
        category: 'bakery',
        originalValueMinor: 40_000,
        salePriceMinor: 10_000,
        quantity: 5,
        pickupStartsAt: iso(5),
        pickupEndsAt: iso(6),
      })
      .expect(201);

    const bagId = created.body.data.id as string;
    createdBagIds.push(bagId);

    // İki adet sat.
    await api()
      .post('/v1/orders')
      .set('Authorization', `Bearer ${consumerToken}`)
      .set('Idempotency-Key', `e2e-${Math.random()}`)
      .send({ bagId, quantity: 2 })
      .expect(201);

    const response = await api()
      .patch(`/v1/partner/bags/${bagId}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ quantity: 1 })
      .expect(422);

    expect(response.body.error.message).toMatch(/2 adet satıldı/);
  });

  it('sipariş almış paket silinmez, iptal edilir', async () => {
    const bagId = createdBagIds[createdBagIds.length - 1];

    const response = await api()
      .delete(`/v1/partner/bags/${bagId}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200);

    expect(response.body.data.deleted).toBe(false);
    expect(response.body.data.cancelled).toBe(true);
  });

  // --- Başvuru ve onay ------------------------------------------------------

  it('başvuru alınır ve yönetici onayında işletme oluşur', async () => {
    const email = `basvuru_${Date.now()}@example.com`;

    const application = await api()
      .post('/v1/partners/applications')
      .send({
        businessName: 'E2E Test Fırını',
        businessType: 'Fırın / Pastane',
        contactName: 'Test Yetkili',
        phone: '05551112233',
        email,
        city: 'İstanbul',
        district: 'Kadıköy',
      })
      .expect(201);

    const applicationId = application.body.data.id as string;
    createdApplicationIds.push(applicationId);
    expect(application.body.data.status).toBe('new');

    // Konum olmadan onay reddedilmeli.
    await api()
      .post(`/v1/admin/applications/${applicationId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(422);

    const approved = await api()
      .post(`/v1/admin/applications/${applicationId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'approved',
        location: { latitude: 40.99, longitude: 29.03, addressLine: 'Test Cad. No:1' },
      })
      .expect(200);

    expect(approved.body.data.status).toBe('approved');
    expect(approved.body.data.store_id).toBeDefined();

    // Temizlik için işletmeyi de sil.
    await prisma.store.delete({ where: { id: approved.body.data.store_id as string } });
  });

  // --- Hakediş --------------------------------------------------------------

  it('hakediş özeti aritmetik olarak tutarlıdır', async () => {
    const response = await api()
      .get('/v1/partner/payouts/summary')
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200);

    const data = response.body.data as {
      gross: { amount_minor: number };
      commission: { amount_minor: number };
      refund: { amount_minor: number };
      net: { amount_minor: number };
    };

    // net = brüt − komisyon − iade. Bu eşitlik bozulursa işletmeye yanlış
    // tutar ödenir.
    expect(data.net.amount_minor).toBe(
      data.gross.amount_minor - data.commission.amount_minor - data.refund.amount_minor,
    );
  });

  it('hakediş bilgileri eksikken payoutReady false döner', async () => {
    const store = await prisma.store.findUniqueOrThrow({ where: { id: ownStoreId } });

    const response = await api()
      .get('/v1/partner/payouts/summary')
      .set('Authorization', `Bearer ${partnerToken}`)
      .expect(200);

    expect(response.body.data.payout_ready).toBe(store.payoutReady);
  });

  it('yönetici IBAN girince işletme hakedişe hazır olur ve IBAN maskeli döner', async () => {
    const response = await api()
      .patch(`/v1/admin/stores/${ownStoreId}/payout-details`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        legalName: 'Test Gıda Ltd. Şti.',
        taxNumber: '1234567890',
        taxOffice: 'Kadıköy',
        iban: 'TR330006100519786457841326',
        ibanHolder: 'Test Gıda Ltd. Şti.',
      })
      .expect(200);

    expect(response.body.data.payout_ready).toBe(true);
    // Tam IBAN yanıtla dönmemeli.
    expect(response.body.data.iban_masked).toBe('****1326');
    expect(JSON.stringify(response.body)).not.toContain('TR330006100519786457841326');
  });

  it('geçersiz IBAN reddedilir', async () => {
    await api()
      .patch(`/v1/admin/stores/${ownStoreId}/payout-details`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ iban: 'GB29NWBK60161331926819' })
      .expect(400);
  });

  // --- Denetim kaydı --------------------------------------------------------

  it('yönetici işlemleri denetim kaydına yazılır', async () => {
    await api()
      .patch(`/v1/admin/stores/${ownStoreId}/commission`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionRateBps: 1300 })
      .expect(200);

    const response = await api()
      .get('/v1/admin/audit-log')
      .query({ entity: 'Store' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const logs = response.body.data as { action: string; entity_id: string }[];
    const found = logs.some(
      (log) => log.action === 'store.commission.changed' && log.entity_id === ownStoreId,
    );
    expect(found).toBe(true);

    // Eski orana geri dön.
    await api()
      .patch(`/v1/admin/stores/${ownStoreId}/commission`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionRateBps: 1200 })
      .expect(200);
  });

  it('komisyon değişikliği geçmiş siparişleri etkilemez', async () => {
    const before = await prisma.order.findFirst({
      where: { storeId: ownStoreId, status: 'COLLECTED' },
      select: { id: true, commissionMinor: true, totalMinor: true },
    });

    if (!before) return;

    await api()
      .patch(`/v1/admin/stores/${ownStoreId}/commission`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionRateBps: 2000 })
      .expect(200);

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: before.id },
      select: { commissionMinor: true },
    });

    // Komisyon sipariş anında dondurulur.
    expect(after.commissionMinor).toBe(before.commissionMinor);

    await api()
      .patch(`/v1/admin/stores/${ownStoreId}/commission`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionRateBps: 1200 })
      .expect(200);
  });
});
