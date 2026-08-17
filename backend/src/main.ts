import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Webhook imzası ham gövde üzerinden hesaplanır; JSON yeniden
    // serileştirilirse boşluk/sıralama farkı imzayı bozar.
    rawBody: true,
  });

  const config = app.get(ConfigService<Env, true>);
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Ters vekil arkasında doğru istemci IP'si — hız sınırı ve kayıtlar için.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // API JSON döndürür; tarayıcı kaynağı sunmadığı için CSP gereksiz ve
      // Swagger arayüzünü bozar.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-Id',
      'Accept-Language',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  // Yüklenen görseller statik olarak servis edilir. Üretimde bu işi bir
  // CDN/nesne deposu üstlenmeli; o zaman bu satır kaldırılır.
  app.useStaticAssets(resolve(process.cwd(), config.get('MEDIA_ROOT', { infer: true })), {
    prefix: '/media/',
    maxAge: '30d',
    immutable: true,
    // Yüklenen içerik hiçbir koşulda çalıştırılabilir olmamalı.
    setHeaders: (res: { setHeader: (name: string, value: string) => void }) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
    },
  });

  configureApp(app);


  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const documentConfig = new DocumentBuilder()
      .setTitle('YePaket API')
      .setDescription(
        'Sürpriz paket pazaryeri API\'si. Sözleşmenin tek kaynağı docs/API_CONTRACT.md dosyasıdır.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addServer(config.get('API_PUBLIC_URL', { infer: true }))
      .build();

    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Kubernetes/Docker SIGTERM gönderdiğinde açık istekler tamamlansın.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');

  logger.log(`YePaket API ${port} portunda dinliyor (${config.get('NODE_ENV', { infer: true })})`);
}

void bootstrap();
