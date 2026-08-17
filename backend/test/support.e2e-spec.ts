import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

/**
 * Destek, etki ve bekleme listesi uçlarının doğrulaması.
 *
 * Bu üç uç da giriş yapmamış kullanıcıya kısmen açık; yetki sınırlarının
 * doğru yerde olduğunu göstermek testin asıl amacı.
 */
describe('Support & Waitlist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const device = { deviceId: 'e2e-destek-cihaz', platform: 'ANDROID' as const };
  const credentials = {
    email: `destek_${Date.now()}@example.com`,
    password: 'GuvenliSifre1',
    name: 'Destek Kullanıcı',
  };

  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const registration = await request(app.getHttpServer() as App)
      .post('/v1/auth/register')
      .send({ ...credentials, device })
      .expect(201);

    const body = registration.body as {
      data: { access_token: string; user: { id: string } };
    };

    accessToken = body.data.access_token;
    userId = body.data.user.id;
  });

  afterAll(async () => {
    await prisma.waitlistEntry.deleteMany({
      where: { email: { contains: 'destek_' } },
    });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.supportTicket.deleteMany({ where: { userId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Destek talepleri
  // ---------------------------------------------------------------------------

  it('giriş yapmamış kullanıcı destek talebi açabilir', async () => {
    const response = await request(app.getHttpServer() as App)
      .post('/v1/support/tickets')
      .send({
        name: 'Anonim Ziyaretçi',
        email: `destek_anonim_${Date.now()}@example.com`,
        subject: 'Uygulamaya giremiyorum',
        message: 'Şifremi sıfırladım ama e-posta gelmedi, yardımcı olur musunuz?',
        category: 'account',
      })
      .expect(201);

    const body = response.body as { data: { ticket_no: string } };
    expect(body.data.ticket_no).toMatch(/^[A-Z0-9-]+$/);
  });

  it('kısa mesaj reddedilir', async () => {
    await request(app.getHttpServer() as App)
      .post('/v1/support/tickets')
      .send({
        name: 'Ali',
        email: 'ali@example.com',
        subject: 'Selam',
        message: 'kısa',
      })
      .expect(400);
  });

  it('kullanıcı yalnızca kendi taleplerini görür', async () => {
    await request(app.getHttpServer() as App)
      .post('/v1/support/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: credentials.name,
        email: credentials.email,
        subject: 'Siparişim teslim edilmedi',
        message: 'Mağazaya gittim ama paket hazır değildi, ne yapmalıyım?',
        category: 'order',
      })
      .expect(201);

    const response = await request(app.getHttpServer() as App)
      .get('/v1/support/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as { data: Array<{ subject: string }> };

    // Anonim talep bu listede olmamalı: sahibi yok.
    expect(body.data).toHaveLength(1);
    expect(body.data[0].subject).toBe('Siparişim teslim edilmedi');
  });

  it('destek talepleri giriş olmadan listelenemez', async () => {
    await request(app.getHttpServer() as App)
      .get('/v1/support/tickets')
      .expect(401);
  });

  // ---------------------------------------------------------------------------
  // Etki
  // ---------------------------------------------------------------------------

  it('kişisel etki giriş gerektirir, topluluk etkisi gerektirmez', async () => {
    await request(app.getHttpServer() as App).get('/v1/impact/me').expect(401);

    const community = await request(app.getHttpServer() as App)
      .get('/v1/impact/community')
      .expect(200);

    const body = community.body as {
      data: { saved_bags: number; co2e_kg: number; active_stores: number };
    };

    expect(typeof body.data.saved_bags).toBe('number');
    expect(typeof body.data.co2e_kg).toBe('number');
    expect(typeof body.data.active_stores).toBe('number');
  });

  it('yeni kullanıcının etkisi sıfırdır', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/v1/impact/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      data: { saved_bags: number; money_saved: { amount_minor: number } };
    };

    expect(body.data.saved_bags).toBe(0);
    expect(body.data.money_saved.amount_minor).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Bildirim tercihleri
  // ---------------------------------------------------------------------------

  it('varsayılan olarak tüm bildirim türleri açıktır', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/v1/auth/me/notification-preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      data: {
        bag_available: boolean;
        order_updates: boolean;
        impact_digest: boolean;
        campaigns: boolean;
      };
    };

    // Kaydedilmemiş tercih "açık" sayılır: yeni bir bildirim türü
    // eklendiğinde mevcut kullanıcılar sessizce dışarıda kalmasın.
    expect(body.data).toEqual({
      bag_available: true,
      order_updates: true,
      impact_digest: true,
      campaigns: true,
    });
  });

  it('tercih kısmi güncellenir ve diğerleri korunur', async () => {
    await request(app.getHttpServer() as App)
      .patch('/v1/auth/me/notification-preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ campaigns: false })
      .expect(200);

    const response = await request(app.getHttpServer() as App)
      .get('/v1/auth/me/notification-preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      data: { campaigns: boolean; order_updates: boolean };
    };

    expect(body.data.campaigns).toBe(false);
    expect(body.data.order_updates).toBe(true);
  });

  it('kapatılan türde bildirim hiç oluşturulmaz', async () => {
    await request(app.getHttpServer() as App)
      .patch('/v1/auth/me/notification-preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ campaigns: false })
      .expect(200);

    const notifications = app.get(NotificationsService);
    await notifications.notifyCampaign(userId, 'Test kampanyası', 'Gövde metni');

    const stored = await prisma.notification.count({
      where: { userId, type: 'CAMPAIGN' },
    });

    // Yalnızca push'un atlanması yetmezdi: uygulama içi listede görünürdü.
    expect(stored).toBe(0);
  });

  it('açık türde bildirim oluşturulur', async () => {
    await request(app.getHttpServer() as App)
      .patch('/v1/auth/me/notification-preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ campaigns: true })
      .expect(200);

    const notifications = app.get(NotificationsService);
    await notifications.notifyCampaign(userId, 'Açık kampanya', 'Gövde metni');

    const stored = await prisma.notification.count({
      where: { userId, type: 'CAMPAIGN' },
    });

    expect(stored).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Bekleme listesi
  // ---------------------------------------------------------------------------

  it('bekleme listesine katılma sıra numarası döndürür', async () => {
    const email = `destek_bekleme_${Date.now()}@example.com`;

    const response = await request(app.getHttpServer() as App)
      .post('/v1/waitlist')
      .send({ feature: 'parcels', email, city: 'İstanbul' })
      .expect(201);

    const body = response.body as { data: { position: number; feature: string } };

    expect(body.data.feature).toBe('parcels');
    expect(body.data.position).toBeGreaterThan(0);
  });

  it('aynı e-posta ikinci kez kaydolunca hata dönmez', async () => {
    const email = `destek_tekrar_${Date.now()}@example.com`;

    const first = await request(app.getHttpServer() as App)
      .post('/v1/waitlist')
      .send({ feature: 'parcels', email })
      .expect(201);

    const second = await request(app.getHttpServer() as App)
      .post('/v1/waitlist')
      .send({ feature: 'parcels', email, city: 'Ankara' })
      .expect(201);

    const firstBody = first.body as { data: { id: string } };
    const secondBody = second.body as { data: { id: string } };

    // Aynı kayıt güncellenir, yenisi oluşmaz.
    expect(secondBody.data.id).toBe(firstBody.data.id);

    const entry = await prisma.waitlistEntry.findUnique({
      where: { feature_email: { feature: 'parcels', email } },
    });
    expect(entry?.city).toBe('Ankara');
  });

  it('bilinmeyen özellik reddedilir', async () => {
    await request(app.getHttpServer() as App)
      .post('/v1/waitlist')
      .send({ feature: 'uydurma-ozellik', email: 'destek_x@example.com' })
      .expect(400);
  });

  it('bekleme listesi sayısı okunabilir', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/v1/waitlist/parcels/count')
      .expect(200);

    const body = response.body as { data: { total: number } };
    expect(body.data.total).toBeGreaterThanOrEqual(2);
  });
});
