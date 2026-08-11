import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { presentBag, presentStore, type BagView, type StoreView } from './catalog.presenter';

/**
 * Paket ve işletme okuma işlemleri ile favori yönetimi.
 *
 * Favoriler işletme düzeyinde tutulur: paket yayınları her gün yeniden
 * oluştuğu için "yeniden satışa çıkınca haber ver" ancak işletmeye
 * bağlıysa anlamlıdır. Sözleşmedeki `/bags/{id}/favorite` ucu, paketin
 * işletmesine çevrilerek karşılanır.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private async isFavorite(userId: string | undefined, storeId: string): Promise<boolean> {
    if (!userId) return false;
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { id: true },
    });
    return favorite !== null;
  }

  async bagById(bagId: string, userId?: string): Promise<BagView> {
    const bag = await this.prisma.bag.findUnique({
      where: { id: bagId },
      include: { store: true },
    });

    if (!bag) throw AppError.notFound('Paket', ErrorCode.BAG_NOT_FOUND);

    return presentBag(bag, { isFavorite: await this.isFavorite(userId, bag.storeId) });
  }

  async storeById(storeId: string, userId?: string): Promise<StoreView> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    return presentStore(store, await this.isFavorite(userId, store.id));
  }

  /** Bir işletmenin yayında olan paketleri (mağaza sayfası için). */
  async storeBags(storeId: string, userId?: string): Promise<BagView[]> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    const bags = await this.prisma.bag.findMany({
      where: {
        storeId,
        status: 'PUBLISHED',
        availableQuantity: { gt: 0 },
        pickupEndsAt: { gt: new Date() },
      },
      include: { store: true },
      orderBy: { pickupStartsAt: 'asc' },
    });

    const favorite = await this.isFavorite(userId, storeId);
    return bags.map((bag) => presentBag(bag, { isFavorite: favorite }));
  }

  /**
   * Favoriye ekleme idempotenttir: aynı isteğin tekrarı hata üretmez,
   * çünkü istemci tarafında çift dokunuş yaygındır.
   */
  async addFavoriteByStore(userId: string, storeId: string): Promise<{ isFavorite: boolean }> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true },
    });
    if (!store) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    await this.prisma.favorite.upsert({
      where: { userId_storeId: { userId, storeId } },
      update: {},
      create: { userId, storeId },
    });

    return { isFavorite: true };
  }

  async removeFavoriteByStore(userId: string, storeId: string): Promise<{ isFavorite: boolean }> {
    await this.prisma.favorite.deleteMany({ where: { userId, storeId } });
    return { isFavorite: false };
  }

  /** Sözleşme uyumu: paket kimliği verildiğinde işletmesine çevrilir. */
  private async storeIdOfBag(bagId: string): Promise<string> {
    const bag = await this.prisma.bag.findUnique({
      where: { id: bagId },
      select: { storeId: true },
    });
    if (!bag) throw AppError.notFound('Paket', ErrorCode.BAG_NOT_FOUND);
    return bag.storeId;
  }

  async addFavoriteByBag(userId: string, bagId: string) {
    return this.addFavoriteByStore(userId, await this.storeIdOfBag(bagId));
  }

  async removeFavoriteByBag(userId: string, bagId: string) {
    return this.removeFavoriteByStore(userId, await this.storeIdOfBag(bagId));
  }

  /**
   * Kullanıcının favori işletmeleri ve varsa bugünkü paketleri.
   * Mobil "Favoriler" ekranı, favorinin şu an satışta olup olmadığını
   * göstermek zorunda; bu yüzden paket bilgisi de birlikte döner.
   */
  async favorites(userId: string): Promise<{ store: StoreView; bags: BagView[] }[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        store: {
          include: {
            bags: {
              where: {
                status: 'PUBLISHED',
                availableQuantity: { gt: 0 },
                pickupEndsAt: { gt: new Date() },
              },
              orderBy: { pickupStartsAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((favorite) => {
      const { bags, ...store } = favorite.store;
      return {
        store: presentStore(store, true),
        bags: bags.map((bag) => presentBag({ ...bag, store }, { isFavorite: true })),
      };
    });
  }
}
