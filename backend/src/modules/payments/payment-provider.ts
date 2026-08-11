/**
 * Ödeme sağlayıcısı soyutlaması.
 *
 * Sağlayıcıya özgü hiçbir tip bu dosyanın dışına sızmaz; sipariş akışı
 * yalnızca bu arayüzü tanır. Sağlayıcı değişimi tek modülü etkiler.
 *
 * Kart verisi hiçbir zaman bizim sunucumuzda saklanmaz: istemci sağlayıcının
 * 3D Secure akışına yönlendirilir, biz yalnızca sağlayıcı kimliğini tutarız.
 */

export interface PaymentBuyer {
  id: string;
  name: string;
  surname: string;
  email: string;
  /** Sağlayıcı dolandırıcılık analizinde kullanır. */
  ipAddress: string;
  identityNumber?: string;
  phone?: string;
}

export interface PaymentBasketItem {
  id: string;
  name: string;
  category: string;
  priceMinor: number;
}

export interface InitializePaymentInput {
  orderId: string;
  conversationId: string;
  amountMinor: number;
  currency: string;
  buyer: PaymentBuyer;
  basket: PaymentBasketItem[];
  /** 3D Secure sonrası sağlayıcının geri döneceği adres. */
  callbackUrl: string;
}

export interface InitializePaymentResult {
  providerPaymentId: string;
  status: 'requires_action' | 'authorized' | 'failed';
  /**
   * 3D Secure adımı için istemciye verilecek içerik. Sağlayıcıya göre
   * yönlendirme adresi veya gömülü HTML olabilir.
   */
  redirectUrl?: string;
  htmlContent?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface CompletePaymentInput {
  providerPaymentId: string;
  conversationId: string;
  /** Sağlayıcının 3DS dönüşünde ilettiği doğrulama verisi. */
  providerPayload: Record<string, unknown>;
}

export interface CompletePaymentResult {
  status: 'captured' | 'failed';
  providerPaymentId: string;
  providerStatus?: string;
  cardLastFour?: string;
  cardBrand?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface RefundInput {
  providerPaymentId: string;
  conversationId: string;
  amountMinor: number;
  currency: string;
  ipAddress: string;
  reason?: string;
}

export interface RefundResult {
  status: 'succeeded' | 'failed';
  providerRefundId?: string;
  failureCode?: string;
  failureMessage?: string;
}

export abstract class PaymentProvider {
  abstract readonly name: string;

  /** Ödemeyi başlatır; genellikle 3D Secure adımı gerektirir. */
  abstract initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>;

  /** 3D Secure dönüşünde ödemeyi tamamlar (tahsilat). */
  abstract complete(input: CompletePaymentInput): Promise<CompletePaymentResult>;

  abstract refund(input: RefundInput): Promise<RefundResult>;

  /**
   * Webhook imzasını doğrular. Doğrulanamayan çağrı işlenmez: aksi hâlde
   * herkes "ödeme başarılı" bildirimi göndererek bedava sipariş alabilirdi.
   */
  abstract verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): boolean;
}
