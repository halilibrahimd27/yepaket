import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { IyzicoPaymentProvider } from './iyzico-payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment-provider';

/**
 * Ödeme sağlayıcısı yapılandırmaya göre seçilir.
 *
 * Seçim tek yerde yapılır; sipariş akışı hangi sağlayıcının kullanıldığını
 * bilmez. Üretimde `mock` seçilmesi ortam şeması tarafından engellenir.
 */
@Global()
@Module({
  providers: [
    MockPaymentProvider,
    IyzicoPaymentProvider,
    {
      provide: PaymentProvider,
      inject: [ConfigService, MockPaymentProvider, IyzicoPaymentProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockPaymentProvider,
        iyzico: IyzicoPaymentProvider,
      ): PaymentProvider => {
        const selected = config.get('PAYMENT_PROVIDER', { infer: true });
        const provider = selected === 'iyzico' ? iyzico : mock;

        new Logger('PaymentProvider').log(`Ödeme sağlayıcısı: ${provider.name}`);
        return provider;
      },
    },
  ],
  exports: [PaymentProvider],
})
export class PaymentsModule {}
