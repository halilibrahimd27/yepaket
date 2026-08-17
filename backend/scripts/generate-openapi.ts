import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/**
 * OpenAPI şemasını dosyaya yazar.
 *
 * `docs/API_CONTRACT.md` bu çıktıdan üretilir ve `openapi.json` doğrudan
 * Postman/Insomnia'ya veya istemci kodu üreticilerine verilebilir.
 *
 * Uygulama `configureApp` ile yapılandırılır — yani üretimdeki ile aynı
 * doğrulama ve dönüşüm ayarlarıyla. Şemayı farklı bir yapılandırmadan
 * üretmek, belgelenen ile çalışanın ayrışmasına yol açardı.
 *
 * Çalıştırma: `npm run openapi`
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();

  const config = new DocumentBuilder()
    .setTitle('YePaket API')
    .setDescription(
      'Gıda kurtarma pazaryeri API’si. Tüm parasal alanlar tam sayı kuruştur ' +
        've adı `_minor` ile biter. Zaman damgaları UTC ve ISO 8601’dir.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const target = resolve(__dirname, '..', 'openapi.json');

  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);

  const endpointCount = Object.values(document.paths).reduce(
    (sum, operations) => sum + Object.keys(operations).length,
    0,
  );

  process.stdout.write(`${endpointCount} uç nokta yazıldı: ${target}\n`);

  await app.close();
}

main().catch((error: unknown) => {
  process.stderr.write(`OpenAPI üretilemedi: ${String(error)}\n`);
  process.exit(1);
});
