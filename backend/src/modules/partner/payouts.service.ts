import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { StoreAccessService } from './store-access.service';

const ISTANBUL = 'Europe/Istanbul';

/**
 * Hakediş (payout) hesaplama.
 *
 * Kural: bir siparişin işletmeye ait payı ancak sipariş **teslim alındıysa**
 * hakedişe girer. İptal edilen veya teslim alınmayan sipariş için işletmeye
 * ödeme yapılmaz; iade edilen tutar dönemden düşülür.
 *
 * Tutarlar sipariş anında dondurulmuş `netMinor` alanından gelir — komisyon
 * oranı sonradan değişse bile geçmiş hakediş değişmez.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StoreAccessService,
  ) {}

  /**
   * Bir işletmenin belirli dönemdeki hakediş özeti.
   * Dönem kapanmamışsa "tahmini" olarak işaretlenir.
   */
  async summary(user: AuthenticatedUser, storeId?: string, month?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId)
      : await this.access.defaultStore(user);

    const reference = month
      ? DateTime.fromFormat(month, 'yyyy-MM', { zone: ISTANBUL })
      : DateTime.now().setZone(ISTANBUL);

    if (!reference.isValid) {
      throw AppError.unprocessable(ErrorCode.VALIDATION_FAILED, 'Dönem "YYYY-MM" olmalıdır.');
    }

    const periodStart = reference.startOf('month').toUTC().toJSDate();
    const periodEnd = reference.endOf('month').toUTC().toJSDate();

    const [collected, refunded, orderCount] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          storeId: store.id,
          status: 'COLLECTED',
          collectedAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { totalMinor: true, commissionMinor: true, netMinor: true, quantity: true },
      }),
      // İade yalnızca DAHA ÖNCE hakedişe girmiş bir sipariş için düşülür.
      // Aynı dönemde iptal edilen sipariş zaten COLLECTED toplamına
      // girmediği için tekrar düşmek işletmeyi iki kez cezalandırırdı.
      this.prisma.order.aggregate({
        where: {
          storeId: store.id,
          status: 'REFUNDED',
          payoutId: { not: null },
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { netMinor: true },
      }),
      this.prisma.order.count({
        where: {
          storeId: store.id,
          status: 'COLLECTED',
          collectedAt: { gte: periodStart, lte: periodEnd },
        },
      }),
    ]);

    const gross = collected._sum.totalMinor ?? 0;
    const commission = collected._sum.commissionMinor ?? 0;
    const refund = refunded._sum.netMinor ?? 0;
    const net = (collected._sum.netMinor ?? 0) - refund;

    const existing = await this.prisma.payout.findUnique({
      where: {
        storeId_periodStart_periodEnd: {
          storeId: store.id,
          periodStart,
          periodEnd,
        },
      },
    });

    return {
      period: { start: periodStart, end: periodEnd, label: reference.toFormat('yyyy-MM') },
      gross: { amountMinor: gross, currency: 'TRY' },
      commission: { amountMinor: commission, currency: 'TRY' },
      refund: { amountMinor: refund, currency: 'TRY' },
      net: { amountMinor: net, currency: 'TRY' },
      orderCount,
      rescuedBags: collected._sum.quantity ?? 0,
      commissionRateBps: store.commissionRateBps,
      // Dönem henüz bitmediyse rakamlar değişmeye devam eder.
      isEstimate: existing === null,
      status: existing?.status.toLowerCase() ?? 'pending',
      paidAt: existing?.paidAt ?? null,
      // Hakediş bilgileri eksikse ödeme yapılamaz; panel bunu uyarı olarak
      // gösterir.
      payoutReady: store.payoutReady,
    };
  }

  async history(user: AuthenticatedUser, storeId?: string) {
    const store = storeId
      ? await this.access.requireStore(user, storeId)
      : await this.access.defaultStore(user);

    const payouts = await this.prisma.payout.findMany({
      where: { storeId: store.id },
      orderBy: { periodStart: 'desc' },
      take: 24,
    });

    return payouts.map((payout) => ({
      id: payout.id,
      period: { start: payout.periodStart, end: payout.periodEnd },
      gross: { amountMinor: Number(payout.grossMinor), currency: payout.currency },
      commission: { amountMinor: Number(payout.commissionMinor), currency: payout.currency },
      refund: { amountMinor: Number(payout.refundMinor), currency: payout.currency },
      net: { amountMinor: Number(payout.netMinor), currency: payout.currency },
      status: payout.status.toLowerCase(),
      paidAt: payout.paidAt,
      reference: payout.reference,
    }));
  }

  /**
   * Kapanan dönem için hakediş kaydı üretir ve siparişleri bu kayda bağlar.
   *
   * Idempotenttir: aynı dönem için ikinci çağrı yeni kayıt oluşturmaz.
   * Siparişlerin `payoutId` ile işaretlenmesi, aynı siparişin iki farklı
   * döneme sayılmasını imkânsız kılar.
   */
  async generateForPeriod(storeId: string, periodStart: Date, periodEnd: Date) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.payout.findUnique({
        where: { storeId_periodStart_periodEnd: { storeId, periodStart, periodEnd } },
      });
      if (existing) return existing;

      const orders = await tx.order.findMany({
        where: {
          storeId,
          status: 'COLLECTED',
          collectedAt: { gte: periodStart, lte: periodEnd },
          // Başka bir hakedişe dahil edilmiş siparişler tekrar sayılmaz.
          payoutId: null,
        },
        select: { id: true, totalMinor: true, commissionMinor: true, netMinor: true },
      });

      if (orders.length === 0) return null;

      const gross = orders.reduce((sum, order) => sum + order.totalMinor, 0);
      const commission = orders.reduce((sum, order) => sum + order.commissionMinor, 0);
      const net = orders.reduce((sum, order) => sum + order.netMinor, 0);

      // Aynı kural üretimde de geçerli: yalnızca önceki dönemde ödenmiş
      // siparişin iadesi bu dönemden düşülür.
      const refunds = await tx.order.aggregate({
        where: {
          storeId,
          status: 'REFUNDED',
          payoutId: { not: null },
          updatedAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { netMinor: true },
      });

      const refund = refunds._sum.netMinor ?? 0;

      const payout = await tx.payout.create({
        data: {
          storeId,
          periodStart,
          periodEnd,
          grossMinor: BigInt(gross),
          commissionMinor: BigInt(commission),
          refundMinor: BigInt(refund),
          netMinor: BigInt(Math.max(0, net - refund)),
          status: 'PENDING',
        },
      });

      await tx.order.updateMany({
        where: { id: { in: orders.map((order) => order.id) } },
        data: { payoutId: payout.id },
      });

      return payout;
    });
  }

  /**
   * Her ayın 1'inde önceki ayın hakedişlerini üretir.
   * Saat 03:00 seçildi: gece yarısı yoğunluğu geçtikten sonra, mesai
   * başlamadan önce.
   */
  @Cron('0 3 1 * *', { name: 'generate-payouts', timeZone: ISTANBUL })
  async generateMonthlyPayouts(): Promise<void> {
    const previousMonth = DateTime.now().setZone(ISTANBUL).minus({ months: 1 });
    const periodStart = previousMonth.startOf('month').toUTC().toJSDate();
    const periodEnd = previousMonth.endOf('month').toUTC().toJSDate();

    const stores = await this.prisma.store.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, name: true },
    });

    let created = 0;
    for (const store of stores) {
      const payout = await this.generateForPeriod(store.id, periodStart, periodEnd);
      if (payout) created += 1;
    }

    this.logger.log(
      `${previousMonth.toFormat('yyyy-MM')} dönemi için ${created} hakediş kaydı üretildi`,
    );
  }

  /** Yönetici hakedişi ödendi olarak işaretler. */
  async markPaid(payoutId: string, reference: string, actorId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw AppError.notFound('Hakediş');

    if (payout.status === 'PAID') {
      return { id: payout.id, status: 'paid', alreadyPaid: true };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payout.update({
        where: { id: payoutId },
        data: { status: 'PAID', paidAt: new Date(), reference },
      });

      // Para hareketi denetlenebilir olmalı: kim, ne zaman, hangi referansla.
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'payout.marked_paid',
          entity: 'Payout',
          entityId: payoutId,
          meta: { reference, netMinor: result.netMinor.toString() },
        },
      });

      return result;
    });

    return { id: updated.id, status: 'paid', alreadyPaid: false };
  }
}
