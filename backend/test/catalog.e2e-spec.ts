import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Keşif ve katalog uçları.
 *
 * Testler seed verisine dayanır (`npm run db:seed`). Kadıköy koordinatı
 * referans alınır: Moda Fırını ~0,26 km, Mimoza ~13 km uzaklıktadır.
 */
describe('Katalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const KADIKOY = { lat: 40.9877, lng: 29.0277 };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer() as App);

  it('konum verilince mesafeyi hesaplar ve yakından uzağa sıralar', async () => {
    const response = await api()
      .get('/v1/bags/nearby')
      .query({ ...KADIKOY, radiusKm: 30, sort: 'distance' })
      .expect(200);

    const items = response.body.data as { distance_meters: number }[];
    expect(items.length).toBeGreaterThan(1);

    const distances = items.map((item) => item.distance_meters);
    expect(distances.every((distance) => typeof distance === 'number')).toBe(true);
    // Sıralama artan olmalı.
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('yarıçap dışındaki işletmeleri elemeye alır', async () => {
    const wide = await api()
      .get('/v1/bags/nearby')
      .query({ ...KADIKOY, radiusKm: 30 })
      .expect(200);

    const narrow = await api()
      .get('/v1/bags/nearby')
      .query({ ...KADIKOY, radiusKm: 2 })
      .expect(200);

    expect(narrow.body.meta.total).toBeLessThan(wide.body.meta.total);
  });

  it('konum verilmezse mesafe null döner — 0 döndürmek yanıltıcı olurdu', async () => {
    const response = await api().get('/v1/bags/nearby').expect(200);
    const items = response.body.data as { distance_meters: number | null }[];
    expect(items.every((item) => item.distance_meters === null)).toBe(true);
  });

  it('teslim aralığı geçmiş paketleri listelemez', async () => {
    const response = await api().get('/v1/bags/nearby').expect(200);
    const items = response.body.data as { pickup_window: { ends_at: string } }[];

    for (const item of items) {
      expect(new Date(item.pickup_window.ends_at).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('stoğu tükenmiş paketleri listelemez', async () => {
    const response = await api().get('/v1/bags/nearby').expect(200);
    const items = response.body.data as { available_quantity: number }[];
    expect(items.every((item) => item.available_quantity > 0)).toBe(true);
  });

  it('yazım hatasına toleranslı arama yapar (trigram)', async () => {
    const response = await api().get('/v1/bags/nearby').query({ q: 'mimoz' }).expect(200);
    const items = response.body.data as { store: { name: string } }[];

    expect(items.length).toBeGreaterThan(0);
    expect(items[0].store.name).toContain('Mimoza');
  });

  it('fiyata göre artan sıralar ve indirim yüzdesini hesaplar', async () => {
    const response = await api().get('/v1/bags/nearby').query({ sort: 'price' }).expect(200);
    const items = response.body.data as {
      sale_price: { amount_minor: number };
      original_value: { amount_minor: number };
      discount_percent: number;
    }[];

    const prices = items.map((item) => item.sale_price.amount_minor);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);

    for (const item of items) {
      const expected = Math.round(
        (1 - item.sale_price.amount_minor / item.original_value.amount_minor) * 100,
      );
      expect(item.discount_percent).toBe(expected);
    }
  });

  it('sayfalama meta bilgisi tutarlıdır', async () => {
    const response = await api().get('/v1/bags/nearby').query({ limit: 2, page: 1 }).expect(200);
    const meta = response.body.meta;

    expect(meta.limit).toBe(2);
    expect(meta.page).toBe(1);
    expect(meta.total_pages).toBe(Math.ceil(meta.total / 2));
    expect(response.body.data.length).toBeLessThanOrEqual(2);
  });

  it('geçersiz sıralama değeri reddedilir', async () => {
    const response = await api().get('/v1/bags/nearby').query({ sort: 'ucuzdan' }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('bilinmeyen paket için BAG_NOT_FOUND döner', async () => {
    const response = await api()
      .get('/v1/bags/00000000-0000-4000-8000-000000000000')
      .expect(404);
    expect(response.body.error.code).toBe('BAG_NOT_FOUND');
  });

  it('favori işlemleri kimlik ister', async () => {
    const bag = await prisma.bag.findFirstOrThrow();
    await api().post(`/v1/bags/${bag.id}/favorite`).expect(401);
  });

  it('favori ekleme tekrarlanabilir ve paket kimliği işletmeye çevrilir', async () => {
    const device = { deviceId: 'e2e-katalog', platform: 'IOS' as const };
    const login = await api()
      .post('/v1/auth/login')
      .send({ email: 'demo@yepaket.app', password: 'demo1234', device })
      .expect(200);

    const token = login.body.data.access_token as string;
    const bag = await prisma.bag.findFirstOrThrow({ include: { store: true } });

    const first = await api()
      .post(`/v1/bags/${bag.id}/favorite`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.data.is_favorite).toBe(true);

    // İkinci kez eklemek hata üretmemeli: istemcide çift dokunuş yaygındır.
    const second = await api()
      .post(`/v1/bags/${bag.id}/favorite`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.data.is_favorite).toBe(true);

    // Favori işletme düzeyinde tutulur: aynı işletmenin başka paketi de
    // favori görünmelidir.
    const listed = await api()
      .get('/v1/bags/nearby')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const sameStore = (listed.body.data as { store: { id: string }; is_favorite: boolean }[]).filter(
      (item) => item.store.id === bag.storeId,
    );
    expect(sameStore.every((item) => item.is_favorite)).toBe(true);

    await api()
      .delete(`/v1/bags/${bag.id}/favorite`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
