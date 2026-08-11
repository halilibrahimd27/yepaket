import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Kimlik akışının uçtan uca doğrulaması.
 *
 * Özellikle jeton hırsızlığı tespiti burada korunur: bu davranış sessizce
 * bozulursa çalınmış bir yenileme jetonu süresiz geçerli kalır.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const device = { deviceId: 'e2e-cihaz', platform: 'IOS' as const };
  const credentials = {
    email: `e2e_${Date.now()}@example.com`,
    password: 'GuvenliSifre1',
    name: 'E2E Kullanıcı',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/live', 'health/ready'] });

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: credentials.email } });
    await app.close();
  });

  const api = () => request(app.getHttpServer() as App);

  it('kayıt olur ve jeton çifti döner', async () => {
    const response = await api()
      .post('/v1/auth/register')
      .send({ ...credentials, device })
      .expect(201);

    expect(response.body.data.access_token).toBeDefined();
    expect(response.body.data.refresh_token).toBeDefined();
    expect(response.body.data.user.email).toBe(credentials.email);
    // Rol istekten alınmamalı: kayıt her zaman tüketici olur.
    expect(response.body.data.user.role).toBe('CONSUMER');
    // Zarf sözleşmeye uygun olmalı.
    expect(response.body.meta.request_id).toBeDefined();
  });

  it('aynı e-posta ile ikinci kayıt reddedilir', async () => {
    const response = await api()
      .post('/v1/auth/register')
      .send({ ...credentials, device })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('yanlış şifre ile giriş reddedilir', async () => {
    const response = await api()
      .post('/v1/auth/login')
      .send({ email: credentials.email, password: 'YanlisSifre1', device })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('jetonsuz korumalı uca erişilemez', async () => {
    const response = await api().get('/v1/auth/me').expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('yenileme jetonu her kullanımda döner ve tekrar kullanımı tüm oturumları kapatır', async () => {
    const login = await api()
      .post('/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password, device })
      .expect(200);

    const firstRefresh = login.body.data.refresh_token as string;

    const rotated = await api()
      .post('/v1/auth/refresh')
      .send({ refreshToken: firstRefresh, device })
      .expect(200);

    const secondRefresh = rotated.body.data.refresh_token as string;
    expect(secondRefresh).not.toBe(firstRefresh);

    // Çalınmış jeton senaryosu: kullanılmış jeton tekrar sunuluyor.
    const reuse = await api()
      .post('/v1/auth/refresh')
      .send({ refreshToken: firstRefresh, device })
      .expect(401);

    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // Hırsızlık tespit edildiğinde meşru jeton da geçersiz olmalı:
    // saldırgan ile kullanıcı ayırt edilemediği için ikisi de yeniden
    // giriş yapmak zorundadır.
    const afterRevoke = await api()
      .post('/v1/auth/refresh')
      .send({ refreshToken: secondRefresh, device })
      .expect(401);

    expect(afterRevoke.body.error.code).toBe('REFRESH_TOKEN_REUSED');
  });

  it('zayıf şifre doğrulaması alan bazında hata döner', async () => {
    const response = await api()
      .post('/v1/auth/register')
      .send({
        email: `zayif_${Date.now()}@example.com`,
        password: '12345678',
        name: 'Zayıf',
        device,
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    const fields = response.body.error.details.fields as string[];
    expect(fields.join(' ')).toMatch(/rakam/i);
  });

  it('sağlık uçları kimlik doğrulama istemez', async () => {
    // Yük dengeleyici ve orkestratör bu uçlara jetonsuz erişir; global
    // guard eklendiğinde kazara kilitlenmesi üretimde servisi düşürür.
    await api().get('/health/live').expect(200);
    await api().get('/health/ready').expect(200);
  });

  it('tanımsız alan gönderilirse istek reddedilir', async () => {
    const response = await api()
      .post('/v1/auth/register')
      .send({ ...credentials, device, role: 'ADMIN' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});
