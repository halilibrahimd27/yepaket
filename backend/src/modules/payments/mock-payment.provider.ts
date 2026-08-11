import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PaymentProvider,
  type CompletePaymentInput,
  type CompletePaymentResult,
  type InitializePaymentInput,
  type InitializePaymentResult,
  type RefundInput,
  type RefundResult,
} from './payment-provider';

/**
 * Geliştirme ve test için sahte sağlayıcı.
 *
 * Gerçek sağlayıcının davranışını taklit eder: 3D Secure adımı üretir,
 * tamamlama gerektirir, iade destekler. Böylece sipariş akışı gerçek
 * sağlayıcıya geçildiğinde sürpriz yaşamaz.
 *
 * Üretimde kullanılamaz — ortam şeması `PAYMENT_PROVIDER=mock` değerini
 * production'da reddeder.
 */
@Injectable()
export class MockPaymentProvider extends PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);

  /** Test senaryoları için: bu tutarla ödeme başarısız olur. */
  private static readonly FAILING_AMOUNT_MINOR = 66_600;

  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    this.logger.warn(`SAHTE ödeme başlatıldı: ${input.orderId} (${input.amountMinor} kuruş)`);

    if (input.amountMinor === MockPaymentProvider.FAILING_AMOUNT_MINOR) {
      return Promise.resolve({
        providerPaymentId: `mock_${randomUUID()}`,
        status: 'failed',
        failureCode: 'TEST_DECLINE',
        failureMessage: 'Test senaryosu: kart reddedildi.',
      });
    }

    const providerPaymentId = `mock_${randomUUID()}`;
    return Promise.resolve({
      providerPaymentId,
      status: 'requires_action',
      // Gerçek sağlayıcıda banka 3DS sayfası döner; burada tamamlama ucuna
      // yönlendiren sahte bir adres verilir.
      redirectUrl: `${input.callbackUrl}?paymentId=${providerPaymentId}&status=success`,
    });
  }

  complete(input: CompletePaymentInput): Promise<CompletePaymentResult> {
    const declined = input.providerPayload.status === 'failure';

    if (declined) {
      return Promise.resolve({
        status: 'failed',
        providerPaymentId: input.providerPaymentId,
        failureCode: 'TEST_3DS_FAILED',
        failureMessage: 'Test senaryosu: 3D Secure doğrulaması başarısız.',
      });
    }

    return Promise.resolve({
      status: 'captured',
      providerPaymentId: input.providerPaymentId,
      providerStatus: 'success',
      cardLastFour: '4242',
      cardBrand: 'Visa',
    });
  }

  refund(input: RefundInput): Promise<RefundResult> {
    this.logger.warn(`SAHTE iade: ${input.providerPaymentId} (${input.amountMinor} kuruş)`);
    return Promise.resolve({
      status: 'succeeded',
      providerRefundId: `mock_refund_${randomUUID()}`,
    });
  }

  verifyWebhook(): boolean {
    // Sahte sağlayıcıda imza yoktur; bu sınıf üretimde kullanılamadığı için
    // güvenlik açığı oluşturmaz.
    return true;
  }
}
