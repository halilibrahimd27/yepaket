import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { Prisma } from '../../generated/prisma/client';

/** Anahtar kaydının saklanma süresi. */
const RETENTION_HOURS = 24;

/**
 * Idempotency (aynı isteğin tekrarında yeni kayıt oluşturmama).
 *
 * Redis yerine veritabanı kullanılır: bu kayıtlar para hareketini korur ve
 * bellek baskısı altında sessizce düşmemeleri gerekir.
 *
 * Akış:
 * 1. Anahtar + uç + kullanıcı üçlüsü için satır oluşturulmaya çalışılır.
 * 2. Satır zaten varsa:
 *    - tamamlanmışsa ilk yanıt aynen döndürülür,
 *    - hâlâ işleniyorsa 409 döner (istemci beklemeli, yeni sipariş açılmamalı),
 *    - aynı anahtar farklı gövdeyle geldiyse çakışma hatası verilir.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashRequest(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  }

  /**
   * İşlemi idempotent olarak çalıştırır. `operation` yalnızca bu anahtarla
   * ilk kez gelindiğinde çağrılır.
   */
  async run<T>(
    params: { key: string | undefined; endpoint: string; userId: string; body: unknown },
    operation: () => Promise<T>,
  ): Promise<T> {
    const { key, endpoint, userId, body } = params;

    if (!key) {
      throw AppError.unprocessable(
        ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
        'Bu işlem için Idempotency-Key başlığı zorunludur.',
      );
    }

    const requestHash = this.hashRequest(body);
    const expiresAt = new Date(Date.now() + RETENTION_HOURS * 3_600_000);

    try {
      await this.prisma.idempotencyKey.create({
        data: { key, endpoint, userId, requestHash, expiresAt },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.replay<T>({ key, endpoint, userId, requestHash });
      }
      throw error;
    }

    try {
      const result = await operation();

      await this.prisma.idempotencyKey.updateMany({
        where: { key, endpoint, userId },
        data: {
          responseStatus: 200,
          responseBody: result as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      // Başarısız işlemin anahtarı serbest bırakılır: kullanıcı aynı
      // anahtarla tekrar deneyebilmeli. Anahtarı tutmak, geçici bir hatadan
      // sonra siparişin bir daha asla oluşturulamaması demek olurdu.
      await this.prisma.idempotencyKey.deleteMany({ where: { key, endpoint, userId } });
      throw error;
    }
  }

  private async replay<T>(params: {
    key: string;
    endpoint: string;
    userId: string;
    requestHash: string;
  }): Promise<T> {
    const existing = await this.prisma.idempotencyKey.findFirst({
      where: { key: params.key, endpoint: params.endpoint, userId: params.userId },
    });

    if (!existing) {
      // Yarış durumu: kayıt silinmiş olabilir. İstemci tekrar denemeli.
      throw AppError.conflict(
        ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS,
        'İstek işleniyor, lütfen tekrar deneyin.',
      );
    }

    if (existing.requestHash !== params.requestHash) {
      throw AppError.conflict(
        ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
        'Bu Idempotency-Key farklı bir istek gövdesiyle kullanılmış.',
      );
    }

    if (!existing.completedAt) {
      throw AppError.conflict(
        ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS,
        'Aynı istek hâlâ işleniyor.',
      );
    }

    this.logger.log(`Idempotent tekrar: ${params.endpoint} (${params.key})`);
    return existing.responseBody as T;
  }

  /** Süresi dolmuş kayıtları temizler (zamanlanmış iş çağırır). */
  async purgeExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
