import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type { Env } from '../config/env';

/**
 * Prisma istemcisi.
 *
 * Prisma 7 bağlantıyı bir "driver adapter" üzerinden alır; bağlantı adresi
 * şemada değil burada verilir. Havuz ayarları uygulamanın eşzamanlılık
 * profiline göre seçilmiştir: sipariş akışı kısa ömürlü ama kilit tutan
 * transaction'lar kullandığından havuzun tükenmemesi kritiktir.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    super({
      adapter,
      log:
        config.get('NODE_ENV', { infer: true }) === 'development'
          ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
          : [{ emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Veritabanı bağlantısı kuruldu');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Test ve yerel geliştirme için tüm tabloları boşaltır.
   * Üretimde çağrılırsa hata fırlatır — yanlışlıkla veri silinemez.
   */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('truncateAll üretim ortamında kullanılamaz.');
    }

    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
    `;

    if (tables.length === 0) return;

    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
}
