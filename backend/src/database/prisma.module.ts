import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Veritabanı erişimi her modülde gerekiyor; tek bir istemci örneğini
 * global olarak paylaşmak bağlantı havuzunun tekilliğini garanti eder.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
