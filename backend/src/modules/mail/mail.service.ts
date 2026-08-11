import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env';

/**
 * E-posta gönderimi.
 *
 * Geliştirmede Mailpit yakalar (http://localhost:8025), dışarı gerçek posta
 * çıkmaz. Gönderim hatası iş akışını durdurmaz: destek talebi oluştu ama
 * bilgilendirme e-postası gitmediyse, talebi geri almak daha kötü olurdu.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    this.transporter = createTransport({
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: this.config.get('SMTP_PORT', { infer: true }),
      secure: this.config.get('SMTP_SECURE', { infer: true }),
      auth: this.config.get('SMTP_USER', { infer: true })
        ? {
            user: this.config.get('SMTP_USER', { infer: true }),
            pass: this.config.get('SMTP_PASSWORD', { infer: true }),
          }
        : undefined,
    });
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM', { infer: true }),
        to,
        subject,
        html,
      });
    } catch (error) {
      // Bilinçli olarak yutulur ama sessiz değil: kayıt düşer.
      this.logger.error(`E-posta gönderilemedi (${to}): ${(error as Error).message}`);
    }
  }

  private layout(title: string, body: string): string {
    return `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#10251e">
        <div style="background:#0B3B2E;color:#fff;padding:24px;border-radius:16px 16px 0 0">
          <strong style="font-size:20px">Ye<span style="color:#C7F22B">Paket</span></strong>
        </div>
        <div style="border:1px solid #e6e6e6;border-top:0;border-radius:0 0 16px 16px;padding:24px">
          <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
          ${body}
        </div>
        <p style="font-size:11px;color:#65736e;text-align:center;margin-top:16px">
          Bu e-posta YePaket tarafından gönderildi.
        </p>
      </div>
    `;
  }

  async sendSupportAcknowledgement(to: string, name: string, ticketId: string): Promise<void> {
    await this.send(
      to,
      'Destek talebiniz alındı',
      this.layout(
        `Merhaba ${name},`,
        `<p style="line-height:1.6">Destek talebinizi aldık. Ekibimiz en kısa sürede dönüş yapacak.</p>
         <p style="line-height:1.6;color:#65736e;font-size:13px">Talep numaranız: <strong>${ticketId}</strong></p>`,
      ),
    );
  }

  async sendPartnerApplicationReceived(to: string, businessName: string): Promise<void> {
    await this.send(
      to,
      'Başvurunuz alındı',
      this.layout(
        `${businessName} başvurusu alındı`,
        `<p style="line-height:1.6">İşletme başvurunuzu aldık. Ekibimiz bilgilerinizi inceleyip
         demo kurulum için sizinle iletişime geçecek.</p>`,
      ),
    );
  }

  async sendOrderConfirmation(
    to: string,
    order: { orderNo: string; storeName: string; pickupLabel: string; pickupCode: string },
  ): Promise<void> {
    await this.send(
      to,
      `Siparişin hazır — ${order.orderNo}`,
      this.layout(
        'Paketin seni bekliyor',
        `<p style="line-height:1.6"><strong>${order.storeName}</strong> paketini
         <strong>${order.pickupLabel}</strong> aralığında teslim alabilirsin.</p>
         <p style="line-height:1.6">Teslim kodun: <strong style="font-size:20px">${order.pickupCode}</strong></p>`,
      ),
    );
  }
}
