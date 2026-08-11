import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../../config/env';
import {
  PaymentProvider,
  type CompletePaymentInput,
  type CompletePaymentResult,
  type InitializePaymentInput,
  type InitializePaymentResult,
  type RefundInput,
  type RefundResult,
} from './payment-provider';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-require-imports */
// iyzipay SDK'sının tip tanımı yok; sınırları bu dosyada tutulur ve
// dışarıya yalnızca tiplenmiş PaymentProvider arayüzü sızar.

/** SDK'nın geri çağırma tabanlı kaynak metotları. */
type IyzipayCallback = (error: Error | null, result: IyzipayResponse) => void;
type IyzipayResource = {
  create: (payload: Record<string, unknown>, callback: IyzipayCallback) => void;
  retrieve: (payload: Record<string, unknown>, callback: IyzipayCallback) => void;
};
type IyzipayClient = Record<string, IyzipayResource>;

interface IyzipayResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  token?: string;
  paymentPageUrl?: string;
  checkoutFormContent?: string;
  paymentId?: string;
  paymentStatus?: string;
  cardType?: string;
  cardAssociation?: string;
  cardFamily?: string;
  lastFourDigits?: string;
  conversationId?: string;
  [key: string]: unknown;
}

/**
 * iyzico Checkout Form entegrasyonu.
 *
 * Checkout Form seçildi çünkü kart bilgisi iyzico'nun sayfasında girilir ve
 * bizim sunucumuza hiç uğramaz — PCI kapsamı en aza iner. 3D Secure akışı
 * iyzico tarafından yönetilir.
 *
 * NOT: Bu sağlayıcı sandbox anahtarlarıyla uçtan uca doğrulanmalıdır.
 * Anahtarlar geldiğinde `PAYMENT_PROVIDER=iyzico` ile sandbox üzerinde
 * başarılı ödeme, başarısız kart ve iade senaryoları test edilmelidir.
 */
@Injectable()
export class IyzicoPaymentProvider extends PaymentProvider {
  readonly name = 'iyzico';
  private readonly logger = new Logger(IyzicoPaymentProvider.name);
  private clientInstance: IyzipayClient | null = null;
  private readonly secretKey: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
    this.secretKey = this.config.get('IYZICO_SECRET_KEY', { infer: true }) ?? '';
  }

  /**
   * İstemci ilk kullanımda kurulur. Sahte sağlayıcı seçiliyken bu sınıf da
   * bağımlılık ağacında oluşturulur; anahtarsız bir ödeme istemcisi kurmanın
   * anlamı yok.
   */
  private get client(): IyzipayClient {
    if (!this.clientInstance) {
      // CommonJS paketi; ESM import'u tip bilgisi sağlamıyor.
      const Iyzipay = require('iyzipay');
      const created = new Iyzipay({
        apiKey: this.config.get('IYZICO_API_KEY', { infer: true }),
        secretKey: this.secretKey,
        uri: this.config.get('IYZICO_BASE_URL', { infer: true }),
      }) as IyzipayClient;
      this.clientInstance = created;
      return created;
    }
    return this.clientInstance;
  }

  /** SDK geri çağırma tabanlı; söz tabanlı sarmalayıcı. */
  private call(
    resource: string,
    method: 'create' | 'retrieve',
    payload: Record<string, unknown>,
  ): Promise<IyzipayResponse> {
    return new Promise((resolve, reject) => {
      const target = this.client[resource];
      if (!target) {
        reject(new Error(`iyzipay kaynağı bulunamadı: ${resource}`));
        return;
      }

      target[method](payload, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /** Kuruş -> iyzico'nun beklediği ondalık dizgi ("139.00"). */
  private toDecimal(amountMinor: number): string {
    return (amountMinor / 100).toFixed(2);
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const [name, ...rest] = input.buyer.name.split(' ');

    const response = await this.call('checkoutFormInitialize', 'create', {
      locale: 'tr',
      conversationId: input.conversationId,
      price: this.toDecimal(input.amountMinor),
      paidPrice: this.toDecimal(input.amountMinor),
      currency: input.currency,
      basketId: input.orderId,
      paymentGroup: 'PRODUCT',
      callbackUrl: input.callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: input.buyer.id,
        name: name || 'Musteri',
        surname: rest.join(' ') || 'YePaket',
        email: input.buyer.email,
        identityNumber: input.buyer.identityNumber ?? '11111111111',
        registrationAddress: 'Bilgi verilmedi',
        ip: input.buyer.ipAddress,
        city: 'Istanbul',
        country: 'Turkey',
        gsmNumber: input.buyer.phone,
      },
      // Sürpriz paket teslim alınarak verilir; kargo adresi işletme adresidir
      // ve sipariş oluşturulurken doldurulur.
      shippingAddress: {
        contactName: input.buyer.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Magazadan teslim alinacak',
      },
      billingAddress: {
        contactName: input.buyer.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Magazadan teslim alinacak',
      },
      basketItems: input.basket.map((item) => ({
        id: item.id,
        name: item.name,
        category1: item.category,
        itemType: 'PHYSICAL',
        price: this.toDecimal(item.priceMinor),
      })),
    });

    if (response.status !== 'success') {
      this.logger.error(
        `iyzico başlatma başarısız: ${response.errorCode} ${response.errorMessage}`,
      );
      return {
        providerPaymentId: response.token ?? input.conversationId,
        status: 'failed',
        failureCode: response.errorCode,
        failureMessage: response.errorMessage,
      };
    }

    return {
      // Checkout Form akışında ödemeyi tanımlayan değer token'dır; nihai
      // paymentId tamamlama adımında gelir.
      providerPaymentId: response.token!,
      status: 'requires_action',
      redirectUrl: response.paymentPageUrl,
      htmlContent: response.checkoutFormContent,
    };
  }

  async complete(input: CompletePaymentInput): Promise<CompletePaymentResult> {
    const response = await this.call('checkoutForm', 'retrieve', {
      locale: 'tr',
      conversationId: input.conversationId,
      token: input.providerPaymentId,
    });

    const succeeded = response.status === 'success' && response.paymentStatus === 'SUCCESS';

    if (!succeeded) {
      return {
        status: 'failed',
        providerPaymentId: response.paymentId ?? input.providerPaymentId,
        providerStatus: response.paymentStatus,
        failureCode: response.errorCode,
        failureMessage: response.errorMessage ?? 'Ödeme tamamlanamadı.',
      };
    }

    return {
      status: 'captured',
      providerPaymentId: response.paymentId ?? input.providerPaymentId,
      providerStatus: response.paymentStatus,
      cardLastFour: response.lastFourDigits,
      cardBrand: response.cardAssociation ?? response.cardFamily,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const response = await this.call('refund', 'create', {
      locale: 'tr',
      conversationId: input.conversationId,
      paymentTransactionId: input.providerPaymentId,
      price: this.toDecimal(input.amountMinor),
      currency: input.currency,
      ip: input.ipAddress,
      reason: 'buyer_request',
      description: input.reason,
    });

    if (response.status !== 'success') {
      this.logger.error(`iyzico iade başarısız: ${response.errorCode} ${response.errorMessage}`);
      return {
        status: 'failed',
        failureCode: response.errorCode,
        failureMessage: response.errorMessage,
      };
    }

    return { status: 'succeeded', providerRefundId: String(response.paymentId ?? '') };
  }

  /**
   * Webhook imzası doğrulaması.
   *
   * iyzico bildirimi `X-IYZ-SIGNATURE` başlığıyla imzalar. Doğrulanamayan
   * çağrı işlenmez: aksi hâlde herkes "ödeme başarılı" bildirimi göndererek
   * bedava sipariş alabilirdi.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): boolean {
    const received = headers['x-iyz-signature'] ?? headers['X-IYZ-SIGNATURE'];
    if (!received || !this.secretKey) return false;

    const expected = createHmac('sha256', this.secretKey).update(rawBody).digest('base64');

    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length) return false;

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }
}
