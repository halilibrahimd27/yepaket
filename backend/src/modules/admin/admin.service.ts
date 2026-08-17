import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { MailService } from '../mail/mail.service';
import { presentStore } from '../catalog/catalog.presenter';
import type { Prisma, StoreStatus } from '../../generated/prisma/client';
import type { ReviewApplicationDto, SetCommissionDto } from '../partner/dto/partner.dto';

/**
 * Yönetici işlemleri.
 *
 * Her değiştirici işlem `AuditLog`'a yazılır: işletme onayı, komisyon
 * değişikliği ve hakediş ödemesi para sonucu doğuran kararlardır; kimin ne
 * zaman yaptığı sonradan sorulabilmelidir.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private async audit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    meta?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorId, action, entity, entityId, meta },
    });
  }

  /** Sistem geneli özet. */
  async overview() {
    const [users, stores, pendingStores, applications, orders, revenue, collected] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.store.count({ where: { status: 'APPROVED' } }),
        this.prisma.store.count({ where: { status: 'PENDING' } }),
        this.prisma.partnerApplication.count({ where: { status: 'NEW' } }),
        this.prisma.order.count(),
        this.prisma.order.aggregate({
          where: { status: 'COLLECTED' },
          _sum: { totalMinor: true, commissionMinor: true },
        }),
        this.prisma.order.aggregate({
          where: { status: 'COLLECTED' },
          _sum: { quantity: true },
        }),
      ]);

    return {
      users,
      approvedStores: stores,
      pendingStores,
      newApplications: applications,
      orders,
      grossRevenue: { amountMinor: revenue._sum.totalMinor ?? 0, currency: 'TRY' },
      platformRevenue: { amountMinor: revenue._sum.commissionMinor ?? 0, currency: 'TRY' },
      rescuedBags: collected._sum.quantity ?? 0,
    };
  }

  // --- Başvurular -----------------------------------------------------------

  async listApplications(status?: string) {
    const applications = await this.prisma.partnerApplication.findMany({
      where: status ? { status: status.toUpperCase() as never } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return applications.map((application) => ({
      id: application.id,
      businessName: application.businessName,
      businessType: application.businessType,
      contactName: application.contactName,
      phone: application.phone,
      email: application.email,
      city: application.city,
      district: application.district,
      note: application.note,
      status: application.status.toLowerCase(),
      createdStoreId: application.createdStoreId,
      createdAt: application.createdAt,
    }));
  }

  /**
   * Başvuruyu değerlendirir. Onaylandığında işletme kaydı oluşturulur ve
   * belirtilen kullanıcı sahip olarak atanır.
   */
  async reviewApplication(actorId: string, applicationId: string, dto: ReviewApplicationDto) {
    const application = await this.prisma.partnerApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) throw AppError.notFound('Başvuru');

    if (dto.status !== 'APPROVED') {
      const updated = await this.prisma.partnerApplication.update({
        where: { id: applicationId },
        data: { status: dto.status },
      });
      await this.audit(actorId, `application.${dto.status.toLowerCase()}`, 'PartnerApplication', applicationId);
      return { id: updated.id, status: updated.status.toLowerCase() };
    }

    if (application.createdStoreId) {
      return { id: application.id, status: 'approved', storeId: application.createdStoreId };
    }

    if (!dto.location) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Onay için işletme konumu (enlem, boylam, adres) zorunludur.',
      );
    }

    // Sahip kullanıcı belirtilmediyse başvurudaki e-postayla eşleşen
    // kullanıcı aranır; yoksa mağaza sahipsiz oluşturulur ve sonra atanır.
    const owner = dto.ownerUserId
      ? await this.prisma.user.findUnique({ where: { id: dto.ownerUserId } })
      : await this.prisma.user.findUnique({ where: { email: application.email } });

    const store = await this.prisma.$transaction(async (tx) => {
      const slug = await this.uniqueSlug(tx, application.businessName);

      const created = await tx.store.create({
        data: {
          name: application.businessName,
          slug,
          category: this.guessCategory(application.businessType),
          phone: application.phone,
          email: application.email,
          addressLine: dto.location!.addressLine,
          district: application.district,
          city: application.city,
          latitude: dto.location!.latitude,
          longitude: dto.location!.longitude,
          status: 'APPROVED',
        },
      });

      if (owner) {
        await tx.storeMember.create({
          data: { storeId: created.id, userId: owner.id, role: 'OWNER' },
        });

        // Rolü yükselt: artık işletme paneline erişmesi gerekiyor.
        if (owner.role === 'CONSUMER') {
          await tx.user.update({ where: { id: owner.id }, data: { role: 'PARTNER' } });
        }
      }

      await tx.partnerApplication.update({
        where: { id: applicationId },
        data: { status: 'APPROVED', createdStoreId: created.id },
      });

      return created;
    });

    await this.audit(actorId, 'application.approved', 'PartnerApplication', applicationId, {
      storeId: store.id,
      ownerAssigned: owner !== null,
    });

    // Başvuru sahibine sonucu bildir: onay e-postası olmadan işletme
    // panele girmesi gerektiğini bilemez.
    await this.mail.sendPartnerApplicationApproved(
      application.email,
      application.businessName,
      owner !== null,
    );

    this.logger.log(`İşletme onaylandı: ${store.name} (${store.city})`);

    return {
      id: applicationId,
      status: 'approved',
      storeId: store.id,
      ownerAssigned: owner !== null,
    };
  }

  private guessCategory(businessType: string) {
    const normalized = businessType.toLowerCase();
    if (normalized.includes('kafe') || normalized.includes('kahve')) return 'CAFE' as const;
    if (normalized.includes('market') || normalized.includes('manav')) return 'MARKET' as const;
    if (normalized.includes('restoran') || normalized.includes('lokanta'))
      return 'RESTAURANT' as const;
    return 'BAKERY' as const;
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const base = name
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    let candidate = base || 'isletme';
    let suffix = 1;

    while (await tx.store.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  // --- İşletmeler -----------------------------------------------------------

  async listStores(status?: string) {
    const stores = await this.prisma.store.findMany({
      where: status ? { status: status.toUpperCase() as StoreStatus } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return stores.map((store) => ({
      ...presentStore(store),
      status: store.status.toLowerCase(),
      commissionRateBps: store.commissionRateBps,
      payoutReady: store.payoutReady,
    }));
  }

  async setStoreStatus(actorId: string, storeId: string, status: StoreStatus, reason?: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { status },
    });

    // Askıya alınan işletmenin yayındaki paketleri de durdurulmalı; aksi
    // hâlde kapalı bir işletmeden sipariş alınmaya devam ederdi.
    if (status === 'SUSPENDED' || status === 'REJECTED') {
      await this.prisma.bag.updateMany({
        where: { storeId, status: 'PUBLISHED' },
        data: { status: 'PAUSED' },
      });
    }

    await this.audit(actorId, `store.status.${status.toLowerCase()}`, 'Store', storeId, {
      reason,
      previousStatus: store.status,
    });

    return { id: updated.id, status: updated.status.toLowerCase() };
  }

  async setCommission(actorId: string, storeId: string, dto: SetCommissionDto) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { commissionRateBps: dto.commissionRateBps },
    });

    await this.audit(actorId, 'store.commission.changed', 'Store', storeId, {
      from: store.commissionRateBps,
      to: dto.commissionRateBps,
    });

    // Not: geçmiş siparişler etkilenmez — komisyon sipariş anında dondurulur.
    return { id: updated.id, commissionRateBps: updated.commissionRateBps };
  }

  /** Hakediş bilgilerini günceller (IBAN, vergi bilgileri). */
  async setPayoutDetails(
    actorId: string,
    storeId: string,
    details: {
      legalName?: string;
      taxNumber?: string;
      taxOffice?: string;
      mersisNo?: string;
      iban?: string;
      ibanHolder?: string;
      submerchantKey?: string;
    },
  ) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    const merged = { ...store, ...details };
    // Hakediş ancak yasal kimlik ve banka bilgisi eksiksizken üretilebilir.
    const payoutReady = Boolean(
      merged.legalName && merged.taxNumber && merged.iban && merged.ibanHolder,
    );

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { ...details, payoutReady },
    });

    await this.audit(actorId, 'store.payout_details.updated', 'Store', storeId, {
      payoutReady,
    });

    return {
      id: updated.id,
      payoutReady: updated.payoutReady,
      // IBAN yalnızca maskeli döner.
      ibanMasked: updated.iban ? `****${updated.iban.slice(-4)}` : null,
    };
  }

  // --- Destek ve denetim ----------------------------------------------------

  async listSupportTickets(status?: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: status ? { status: status.toUpperCase() as never } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      name: ticket.name,
      email: ticket.email,
      subject: ticket.subject,
      message: ticket.message,
      category: ticket.category.toLowerCase(),
      status: ticket.status.toLowerCase(),
      createdAt: ticket.createdAt,
    }));
  }

  async resolveTicket(actorId: string, ticketId: string, status: string) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: status.toUpperCase() as never },
    });

    await this.audit(actorId, 'support.ticket.updated', 'SupportTicket', ticketId, { status });

    return { id: ticket.id, status: ticket.status.toLowerCase() };
  }

  async listAuditLog(entity?: string, limit = 100) {
    const logs = await this.prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      meta: log.meta,
      actor: log.actor ? { name: log.actor.name, email: log.actor.email } : null,
      createdAt: log.createdAt,
    }));
  }
}
