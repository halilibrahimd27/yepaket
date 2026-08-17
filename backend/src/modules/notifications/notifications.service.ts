import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { Prisma, type NotificationType } from '../../generated/prisma/client';
import type { NotificationPreferences } from '../auth/auth.service';
import { PushService } from './push.service';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Bildirim merkezi.
 *
 * Bildirimler kalıcı olarak saklanır: anlık bağlantısı olmayan (uygulaması
 * kapalı) kullanıcı da sonradan görebilmelidir. Push gönderimi ayrı bir
 * kanaldır ve bu kaydın yerine geçmez.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  private present(notification: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    data: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationView {
    return {
      id: notification.id,
      type: notification.type.toLowerCase(),
      title: notification.title,
      body: notification.body,
      data: notification.data,
      isRead: notification.readAt !== null,
      createdAt: notification.createdAt,
    };
  }

  async list(userId: string, onlyUnread = false): Promise<NotificationView[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, readAt: onlyUnread ? null : undefined },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return notifications.map((notification) => this.present(notification));
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { unread };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationView> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw AppError.notFound('Bildirim');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() },
    });

    return this.present(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Push jetonu kaydı; cihaz zaten varsa güncellenir. */
  async registerPushToken(
    userId: string,
    input: { deviceId: string; platform: 'IOS' | 'ANDROID' | 'WEB'; pushToken: string },
  ): Promise<{ registered: boolean }> {
    await this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: input.deviceId } },
      update: { pushToken: input.pushToken, platform: input.platform },
      create: {
        userId,
        deviceId: input.deviceId,
        platform: input.platform,
        pushToken: input.pushToken,
      },
    });

    return { registered: true };
  }

  /**
   * Bildirim türünün hangi kullanıcı tercihine bağlı olduğu.
   *
   * `ORDER_STATUS` ve `PICKUP_REMINDER` işlemsel bildirimlerdir: kullanıcı
   * kapatabilir ama kapattığında teslim saatini kaçırma riskini alır. Yine de
   * seçim kullanıcınındır.
   */
  private static preferenceKey(type: NotificationType): keyof NotificationPreferences {
    switch (type) {
      case 'BAG_AVAILABLE':
        return 'bagAvailable';
      case 'ORDER_STATUS':
      case 'PICKUP_REMINDER':
        return 'orderUpdates';
      case 'IMPACT':
        return 'impactDigest';
      case 'CAMPAIGN':
      case 'SUPPORT':
      default:
        return 'campaigns';
    }
  }

  private async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Prisma.InputJsonValue,
  ): Promise<void> {
    // Kullanıcı bu türü kapattıysa hiç oluşturulmaz. Yalnızca push'u
    // atlamak yetmezdi: uygulama içi listede yine görünürdü.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    const prefs = (user?.notificationPrefs ?? {}) as Partial<NotificationPreferences>;
    // Kayıtlı değer yoksa açık kabul edilir: yeni bir tür eklendiğinde
    // mevcut kullanıcılar sessizce dışarıda kalmasın.
    if (prefs[NotificationsService.preferenceKey(type)] === false) return;

    await this.prisma.notification.create({
      data: { userId, type, title, body, data: data ?? {} },
    });

    // Kalıcı kayıt ile push aynı noktadan gider; biri yazılıp diğeri
    // unutulamaz. Push başarısız olsa da bildirim uygulama içinde durur.
    await this.push.sendToUser(userId, {
      title,
      body,
      data: this.toStringMap(data),
    });
  }

  /** FCM `data` alanı yalnızca dizgi değer kabul eder. */
  private toStringMap(data?: Prisma.InputJsonValue): Record<string, string> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
  }

  /**
   * Kampanya/duyuru bildirimi.
   *
   * Yönetim panelinden ve zamanlanmış işlerden çağrılır; kullanıcı
   * tercihlerine `create` içinde uyulur.
   */
  async notifyCampaign(userId: string, title: string, body: string): Promise<void> {
    await this.create(userId, 'CAMPAIGN', title, body);
  }

  /** Sipariş durumu değiştiğinde kullanıcıyı bilgilendirir. */
  async notifyOrderStatus(userId: string, orderId: string, status: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: true },
    });
    if (!order) return;

    const messages: Record<string, { title: string; body: string }> = {
      pickup_pending: {
        title: 'Paketin hazır!',
        body: `${order.store.name} siparişini teslim aralığında bekliyor.`,
      },
      collected: {
        title: 'Teslim alındı',
        body: `${order.store.name} paketini kurtardın. Deneyimini değerlendirmek ister misin?`,
      },
      cancelled: {
        title: 'Siparişin iptal edildi',
        body: `${order.store.name} siparişin iptal edildi. Ödemen iade ediliyor.`,
      },
    };

    const message = messages[status];
    if (!message) return;

    await this.create(userId, 'ORDER_STATUS', message.title, message.body, {
      orderId,
      status,
      deepLink: `yepaket://orders/${orderId}`,
    });
  }

  /**
   * Favori işletmede paket yeniden satışa çıktığında favorileyen
   * kullanıcılara haber verir. Mobil "Favorilerin yeniden hazır" akışı
   * bu bildirime dayanır.
   */
  async notifyFavoriteStoreHasBags(storeId: string, bagId?: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true },
    });
    if (!store) return;

    const favorites = await this.prisma.favorite.findMany({
      where: { storeId },
      select: { userId: true },
    });

    if (favorites.length === 0) return;

    // Aynı işletme için kısa aralıkla tekrarlanan bildirim kullanıcıyı
    // spam'ler ve bildirimlerin tamamen kapatılmasına yol açar. Bir iptal
    // dalgası birden çok "yeniden hazır" olayı üretebildiği için son
    // altı saat içinde bilgilendirilmiş kullanıcılar atlanır.
    const since = new Date(Date.now() - 6 * 3_600_000);
    const recentlyNotified = await this.prisma.notification.findMany({
      where: {
        type: 'BAG_AVAILABLE',
        createdAt: { gte: since },
        userId: { in: favorites.map((favorite) => favorite.userId) },
        data: { path: ['storeId'], equals: storeId },
      },
      select: { userId: true },
    });

    const alreadyNotified = new Set(recentlyNotified.map((item) => item.userId));
    const targets = favorites.filter((favorite) => !alreadyNotified.has(favorite.userId));

    if (targets.length === 0) return;

    await this.prisma.notification.createMany({
      data: targets.map((favorite) => ({
        userId: favorite.userId,
        type: 'BAG_AVAILABLE',
        title: `${store.name} yeniden hazır!`,
        body: 'Favorindeki işletmede yeni sürpriz paket satışta.',
        data: { storeId, bagId, deepLink: `yepaket://stores/${storeId}` },
      })),
    });

    await this.push.sendToUsers(
      targets.map((favorite) => favorite.userId),
      {
        title: `${store.name} yeniden hazır!`,
        body: 'Favorindeki işletmede yeni sürpriz paket satışta.',
        data: { storeId, deepLink: `yepaket://stores/${storeId}` },
      },
    );

    this.logger.log(`${targets.length} kullanıcıya paket bildirimi oluşturuldu (${store.name})`);
  }

  /** Teslim saati yaklaşan siparişler için hatırlatma (zamanlanmış iş). */
  async sendPickupReminders(): Promise<number> {
    const now = Date.now();
    const windowStart = new Date(now + 25 * 60_000);
    const windowEnd = new Date(now + 35 * 60_000);

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'PICKUP_PENDING',
        pickupStartsAt: { gte: windowStart, lte: windowEnd },
      },
      include: { store: true },
    });

    for (const order of orders) {
      // Aynı sipariş için ikinci hatırlatma gönderilmemeli.
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: order.userId,
          type: 'PICKUP_REMINDER',
          data: { path: ['orderId'], equals: order.id },
        },
      });

      if (existing) continue;

      await this.create(
        order.userId,
        'PICKUP_REMINDER',
        'Teslim saatin yaklaşıyor',
        `${order.store.name} paketin 30 dakika içinde teslime hazır olacak.`,
        { orderId: order.id, deepLink: `yepaket://orders/${order.id}` },
      );
    }

    return orders.length;
  }
}
