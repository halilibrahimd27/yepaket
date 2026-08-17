import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { MailService } from '../src/modules/mail/mail.service';
import { PasswordResetService } from '../src/modules/auth/password-reset.service';

/**
 * Şifre sıfırlama akışının uçtan uca doğrulaması.
 *
 * Bu akış hesap ele geçirmenin en yaygın hedefidir; testin asıl amacı
 * güvenlik davranışlarını sabitlemek:
 *
 * - Kayıtlı olmayan adres için de aynı yanıt döner (kullanıcı sayımı yok)
 * - Jeton tek kullanımlıktır
 * - Süresi dolmuş jeton reddedilir
 * - Sıfırlama tüm oturumları kapatır
 */
describe('Password reset (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ConfigService;
  let passwordReset: PasswordResetService;

  const device = { deviceId: 'e2e-sifirlama', platform: 'IOS' as const };
  const credentials = {
    email: `sifirlama_${Date.now()}@example.com`,
    password: 'EskiSifre1',
    name: 'Sıfırlama Kullanıcı',
  };

  let userId: string;
  let accessToken: string;
  let refreshToken: string;

  /** Gönderilen e-postadaki jetonu yakalamak için posta katmanı taklit edilir. */
  const sentLinks: Array<{ webUrl: string; appUrl: string }> = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        sendPasswordReset: (
          _to: string,
          _name: string,
          links: { webUrl: string; appUrl: string },
        ) => {
          sentLinks.push(links);
          return Promise.resolve();
        },
        sendSupportAcknowledgement: () => Promise.resolve(),
        sendPartnerApplicationReceived: () => Promise.resolve(),
        sendPartnerApplicationApproved: () => Promise.resolve(),
        sendOrderConfirmation: () => Promise.resolve(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    config = app.get(ConfigService);
    passwordReset = app.get(PasswordResetService);

    const registration = await request(app.getHttpServer() as App)
      .post('/v1/auth/register')
      .send({ ...credentials, device })
      .expect(201);

    const body = registration.body as {
      data: { access_token: string; refresh_token: string; user: { id: string } };
    };

    userId = body.data.user.id;
    accessToken = body.data.access_token;
    refreshToken = body.data.refresh_token;
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.device.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  /**
   * Yeni bir sıfırlama jetonu üretir.
   *
   * HTTP yerine servis doğrudan çağrılır: uç noktada dakikada 3 istek sınırı
   * var ve o sınır ayrı bir testte doğrulanıyor. Testleri sınıra takılmamak
   * için beklemeye zorlamak, testi yavaş ve kırılgan yapardı.
   */
  const issueToken = async (): Promise<string> => {
    await passwordReset.request(credentials.email);
    return lastToken();
  };

  /** E-postadaki bağlantıdan jetonu çıkarır. */
  const lastToken = (): string => {
    const link = sentLinks.at(-1);
    if (!link) throw new Error('Sıfırlama e-postası gönderilmedi');
    return new URL(link.webUrl).searchParams.get('token') ?? '';
  };

  it('kayıtlı olmayan adres için de başarı döner', async () => {
    const before = sentLinks.length;

    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/request')
      .send({ email: `olmayan_${Date.now()}@example.com` })
      .expect(200);

    // Yanıt aynı ama e-posta gönderilmedi: adres sızdırılmıyor.
    expect(sentLinks).toHaveLength(before);
  });

  it('kayıtlı adrese sıfırlama bağlantısı gönderilir', async () => {
    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/request')
      .send({ email: credentials.email })
      .expect(200);

    expect(sentLinks.at(-1)?.webUrl).toContain('/sifre-sifirla?token=');
    // Derin bağlantı da verilir: e-posta telefonda açılırsa uygulamaya düşer.
    expect(sentLinks.at(-1)?.appUrl).toContain('://sifre-sifirla?token=');
  });

  it('yeni istek eski jetonu geçersiz kılar', async () => {
    const firstToken = lastToken();

    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/request')
      .send({ email: credentials.email })
      .expect(200);

    // Eski bağlantı artık çalışmamalı: e-posta kutusuna erişen biri
    // birikmiş bağlantıları kullanamamalı.
    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/confirm')
      .send({ token: firstToken, newPassword: 'BaskaSifre1' })
      .expect(422);
  });

  it('zayıf şifre reddedilir', async () => {
    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/confirm')
      .send({ token: lastToken(), newPassword: 'kisa' })
      .expect(400);
  });

  it('süresi dolmuş jeton reddedilir', async () => {
    const token = lastToken();
    const tokenHash = createHmac(
      'sha256',
      config.get<string>('JWT_REFRESH_SECRET') ?? '',
    )
      .update(token)
      .digest('hex');

    await prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/confirm')
      .send({ token, newPassword: 'YeniSifre1' })
      .expect(422);
  });

  it('geçerli jetonla şifre değişir ve tüm oturumlar kapanır', async () => {
    const token = await issueToken();

    const response = await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/confirm')
      .send({ token, newPassword: 'YepyeniSifre1' })
      .expect(200);

    const body = response.body as { data: { revoked_sessions: number } };
    expect(body.data.revoked_sessions).toBeGreaterThan(0);

    // Eski yenileme jetonu artık çalışmamalı: sıfırlamanın amacı bu.
    await request(app.getHttpServer() as App)
      .post('/v1/auth/refresh')
      .send({ refreshToken, device })
      .expect(401);

    // Eski erişim jetonu da geçmemeli.
    await request(app.getHttpServer() as App)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    // Eski şifre çalışmamalı.
    await request(app.getHttpServer() as App)
      .post('/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password, device })
      .expect(401);

    // Yeni şifre çalışmalı.
    await request(app.getHttpServer() as App)
      .post('/v1/auth/login')
      .send({ email: credentials.email, password: 'YepyeniSifre1', device })
      .expect(200);
  });

  it('aynı jeton ikinci kez kullanılamaz', async () => {
    const token = await issueToken();

    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/confirm')
      .send({ token, newPassword: 'UcuncuSifre1' })
      .expect(200);

    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/confirm')
      .send({ token, newPassword: 'DorduncuSifre1' })
      .expect(422);
  });

  it('sıfırlama isteği hız sınırına takılır', async () => {
    const email = `hiz_${Date.now()}@example.com`;

    // Dakikada 3 istek: bu uç, bir adrese sınırsız posta göndermek için
    // kullanılabilir olmamalı.
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const response = await request(app.getHttpServer() as App)
        .post('/v1/auth/password-reset/request')
        .send({ email });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
  });

  it('uydurma jeton reddedilir', async () => {
    await request(app.getHttpServer() as App)
      .post('/v1/auth/password-reset/confirm')
      .send({ token: 'a'.repeat(43), newPassword: 'HerhangiSifre1' })
      .expect(422);
  });
});
