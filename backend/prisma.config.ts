import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 CLI yapılandırması.
 *
 * Bağlantı adresi artık schema.prisma içinde tutulmuyor; migration ve seed
 * komutları bu dosyadan okuyor. Uygulama çalışma zamanında ise bağlantı
 * `PrismaService` içinde driver adapter'a veriliyor.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
