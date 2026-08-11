import { validateEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('geçerli yapılandırmayı varsayılanlarla tamamlar', () => {
    const env = validateEnv(base);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(8080);
    expect(env.DEFAULT_COMMISSION_BPS).toBe(1200);
    expect(env.PAYMENT_PROVIDER).toBe('mock');
  });

  it('kısa JWT sırrını reddeder', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'kisa' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('eksik veritabanı adresini reddeder', () => {
    const { DATABASE_URL: _omit, ...withoutDb } = base;
    expect(() => validateEnv(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('iyzico seçildiğinde anahtarları zorunlu kılar', () => {
    expect(() => validateEnv({ ...base, PAYMENT_PROVIDER: 'iyzico' })).toThrow(
      /IYZICO_API_KEY/,
    );
  });

  it('üretimde sahte ödeme sağlayıcısına izin vermez', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', PAYMENT_PROVIDER: 'mock' }),
    ).toThrow(/sahte ödeme/i);
  });

  it('üretimde joker CORS origin kabul etmez', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        PAYMENT_PROVIDER: 'iyzico',
        IYZICO_API_KEY: 'k',
        IYZICO_SECRET_KEY: 's',
        CORS_ORIGINS: 'https://yepaket.app,*',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('Swagger üretimde varsayılan olarak kapalıdır', () => {
    const dev = validateEnv(base);
    const prod = validateEnv({
      ...base,
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'iyzico',
      IYZICO_API_KEY: 'k',
      IYZICO_SECRET_KEY: 's',
      CORS_ORIGINS: 'https://yepaket.app',
    });

    expect(dev.SWAGGER_ENABLED).toBe(true);
    expect(prod.SWAGGER_ENABLED).toBe(false);
  });

  it('açıkça verilen değer varsayılanı ezer', () => {
    const prod = validateEnv({
      ...base,
      NODE_ENV: 'production',
      SWAGGER_ENABLED: 'true',
      PAYMENT_PROVIDER: 'iyzico',
      IYZICO_API_KEY: 'k',
      IYZICO_SECRET_KEY: 's',
      CORS_ORIGINS: 'https://yepaket.app',
    });

    expect(prod.SWAGGER_ENABLED).toBe(true);
  });
});
