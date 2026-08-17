import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { SkipEnvelope } from '../../common/interceptors/response-envelope.interceptor';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../../database/prisma.service';
import { PaymentProvider } from './payment-provider';

/**
 * Ödeme sağlayıcısı webhook'u.
 *
 * Neden gerekli: kullanıcı 3D Secure ekranından döndüğünde tarayıcıyı
 * kapatırsa `payment-callback` hiç çağrılmaz ve sipariş "ödeme bekliyor"
 * durumunda asılı kalır — para çekilmiş olmasına rağmen. Webhook, sağlayıcının
 * sunucudan sunucuya bildirimidir ve kullanıcının davranışından bağımsızdır.
 *
 * İmza doğrulanmadan hiçbir işlem yapılmaz: aksi hâlde herkes "ödeme başarılı"
 * bildirimi göndererek bedava sipariş alabilirdi.
 */
@ApiExcludeController()
@Controller('payments/webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly payments: PaymentProvider,
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Public()
  @SkipEnvelope()
  // Sağlayıcı yeniden deneme yaparken hız sınırına takılmamalı.
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() request: Request & { rawBody?: Buffer },
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    // İmza ham gövde üzerinden hesaplanır; JSON yeniden serileştirilirse
    // boşluk/sıralama farkı imzayı bozar.
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(payload);

    if (!this.payments.verifyWebhook(rawBody, headers)) {
      this.logger.warn('Geçersiz imzalı webhook reddedildi');
      throw new AppError(
        ErrorCode.WEBHOOK_SIGNATURE_INVALID,
        'Webhook imzası doğrulanamadı.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // iyzico bildiriminde sipariş referansı `basketId`/`conversationId`
    // alanlarında taşınır; sağlayıcı değişirse burası uyarlanır.
    const orderRef =
      (payload.basketId as string | undefined) ??
      (payload.conversationId as string | undefined);

    if (!orderRef) {
      this.logger.warn('Webhook sipariş referansı taşımıyor');
      return { received: true, processed: false };
    }

    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderRef }, { orderNo: orderRef }] },
      select: { id: true, status: true },
    });

    if (!order) {
      // 200 dönülür: sağlayıcı sonsuza kadar yeniden denemesin.
      this.logger.warn(`Webhook bilinmeyen sipariş: ${orderRef}`);
      return { received: true, processed: false };
    }

    if (order.status !== 'PAYMENT_PENDING') {
      return { received: true, processed: false, reason: 'already_settled' };
    }

    try {
      await this.orders.completePayment(order.id, payload);
      this.logger.log(`Webhook ile ödeme tamamlandı: ${order.id}`);
      return { received: true, processed: true };
    } catch (error) {
      // Ödeme başarısızsa completePayment rezervasyonu zaten serbest bırakır.
      this.logger.warn(
        `Webhook ödeme tamamlanamadı (${order.id}): ${(error as Error).message}`,
      );
      return { received: true, processed: false };
    }
  }
}
