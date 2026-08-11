import { z } from 'zod';

/**
 * Ortam değişkeni şeması.
 *
 * Uygulama açılışta bu şemaya göre doğrulanır; eksik veya geçersiz bir değer
 * varsa süreç başlamaz. Yanlış yapılandırmayla sessizce çalışmak, üretimde
 * fark edilmesi en zor hata sınıfıdır.
 */
const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()),
  );

const port = z.coerce.number().int().min(1).max(65535);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: port.default(8080),
    /** API'nin dışarıdan görünen kök adresi; e-posta ve webhook bağlantılarında kullanılır. */
    API_PUBLIC_URL: z.url().default('http://localhost:8080'),
    /** Virgülle ayrılmış izinli origin listesi. `*` yalnızca geliştirmede anlamlıdır. */
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    DATABASE_URL: z.string().startsWith('postgresql://'),
    REDIS_URL: z.string().startsWith('redis://'),

    /** En az 32 karakter: kısa sır, imzayı kaba kuvvete açık bırakır. */
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    /** Yenileme jetonu opaktır; bu sır yalnızca hash'lemede kullanılır. */
    JWT_REFRESH_SECRET: z.string().min(32),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(60),

    /** Ödeme onayı gelmezse rezervasyonun geri verileceği süre. */
    ORDER_RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    /** Teslim onayı nonce'ının ömrü. */
    PICKUP_NONCE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    /** Arkadaşa devredilen teslim bağlantısının ömrü. */
    SHARED_PICKUP_TTL_MINUTES: z.coerce.number().int().positive().default(120),
    /** Ücretsiz iptal için teslim aralığına kalan asgari süre. */
    FREE_CANCEL_WINDOW_MINUTES: z.coerce.number().int().nonnegative().default(120),
    /** Varsayılan platform komisyonu, baz puan (1200 = %12). */
    DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).default(1200),

    PAYMENT_PROVIDER: z.enum(['iyzico', 'mock']).default('mock'),
    IYZICO_API_KEY: z.string().optional(),
    IYZICO_SECRET_KEY: z.string().optional(),
    IYZICO_BASE_URL: z.url().default('https://sandbox-api.iyzipay.com'),

    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: port.default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: booleanFromString.default(false),
    MAIL_FROM: z.string().default('YePaket <bilgi@yepaket.app>'),

    /**
     * Swagger arayüzü. Belirtilmezse geliştirmede açık, üretimde kapalıdır —
     * API şemasını üretimde varsayılan olarak yayınlamak gereksiz bir
     * saldırı yüzeyidir. Açmak isteyen bilinçli olarak `true` verir.
     */
    SWAGGER_ENABLED: booleanFromString.optional(),
    /** Dakika başına IP başına istek üst sınırı. */
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENT_PROVIDER === 'iyzico') {
      if (!env.IYZICO_API_KEY || !env.IYZICO_SECRET_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['IYZICO_API_KEY'],
          message:
            'PAYMENT_PROVIDER=iyzico seçildiğinde IYZICO_API_KEY ve IYZICO_SECRET_KEY zorunludur.',
        });
      }
    }

    if (env.NODE_ENV === 'production') {
      if (env.PAYMENT_PROVIDER === 'mock') {
        ctx.addIssue({
          code: 'custom',
          path: ['PAYMENT_PROVIDER'],
          message: 'Üretimde sahte ödeme sağlayıcısı kullanılamaz.',
        });
      }
      if (env.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'Üretimde CORS_ORIGINS "*" olamaz; alan adlarını açıkça listeleyin.',
        });
      }
    }
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

/**
 * @nestjs/config `validate` kancası. Hata mesajını okunabilir hâle getirir;
 * çünkü açılışta alınan ham zod çıktısı kimseye yardımcı olmuyor.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(kök)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Ortam değişkenleri geçersiz:\n${details}`);
  }

  return result.data;
}
