import { ValidationPipe, type INestApplication } from '@nestjs/common';

/**
 * Uygulama seviyesindeki yapılandırma.
 *
 * Hem `main.ts` hem de testler bu fonksiyonu kullanır. Ayrı ayrı
 * yapılandırılsalardı testler üretimden farklı davranır ve gerçek hatalar
 * testlerden kaçardı (ör. sorgu parametrelerinin sayıya çevrilmesi).
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Şemada tanımsız alan gönderilirse sessizce yok saymak yerine hata ver:
      // istemci bir alanı yanlış adlandırdığında bunu fark etmesi gerekir.
      forbidNonWhitelisted: true,
      transform: true,
      // Sorgu parametreleri her zaman dizgi gelir; DTO'daki sayı ve boolean
      // tipleri bu olmadan doğrulamadan geçemez.
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Sözleşmedeki taban yol: https://api.yepaket.app/v1
  // Sağlık uçları yük dengeleyici için önekin dışında tutulur.
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/live', 'health/ready'] });
}
