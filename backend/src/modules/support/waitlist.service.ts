import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

/**
 * Yayına alınmamış özellikler için ilgi kaydı.
 *
 * Uygulamada sahte bir vitrin göstermek yerine kullanıcıdan izin alıp haber
 * veriyoruz. Kayıt sayısı, özelliğin geliştirilmeye değip değmediğini
 * gösteren tek gerçek sinyal.
 */

/** Kabul edilen özellik anahtarları. Serbest metin kabul etmiyoruz: yazım
 *  hatası yüzünden bölünmüş listeler işe yaramaz hale gelir. */
export const WAITLIST_FEATURES = ['parcels', 'business', 'corporate'] as const;

export type WaitlistFeature = (typeof WAITLIST_FEATURES)[number];

export function isWaitlistFeature(value: string): value is WaitlistFeature {
  return (WAITLIST_FEATURES as readonly string[]).includes(value);
}

export interface JoinWaitlistInput {
  feature: string;
  email: string;
  city?: string;
}

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bekleme listesine ekler.
   *
   * Aynı e-posta ikinci kez kaydolursa hata dönmez: kullanıcı açısından
   * "zaten kayıtlısın" bir hata değil, aynı sonucun teyididir.
   */
  async join(input: JoinWaitlistInput, userId?: string) {
    const feature = input.feature.trim().toLowerCase();

    if (!isWaitlistFeature(feature)) {
      throw new BadRequestException({
        code: 'UNKNOWN_FEATURE',
        message: 'Bilinmeyen özellik.',
      });
    }

    const email = input.email.trim().toLowerCase();
    const city = input.city?.trim() || null;

    const entry = await this.prisma.waitlistEntry.upsert({
      where: { feature_email: { feature, email } },
      // Şehir bilgisi sonradan verilirse güncellenir; kayıt tarihi korunur.
      update: { city: city ?? undefined, userId: userId ?? undefined },
      create: { feature, email, city, userId: userId ?? null },
      select: { id: true, feature: true, createdAt: true },
    });

    const position = await this.prisma.waitlistEntry.count({
      where: { feature, createdAt: { lte: entry.createdAt } },
    });

    this.logger.log(`Bekleme listesi kaydı: ${feature} (${position}. sıra)`);

    return {
      id: entry.id,
      feature: entry.feature,
      position,
      createdAt: entry.createdAt,
    };
  }

  /** Bir özelliğin toplam ilgi sayısı. Vitrin ekranında gösterilir. */
  async count(feature: string) {
    const normalized = feature.trim().toLowerCase();

    if (!isWaitlistFeature(normalized)) {
      throw new BadRequestException({
        code: 'UNKNOWN_FEATURE',
        message: 'Bilinmeyen özellik.',
      });
    }

    const total = await this.prisma.waitlistEntry.count({
      where: { feature: normalized },
    });

    return { feature: normalized, total };
  }
}
