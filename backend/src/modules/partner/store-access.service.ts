import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import type { Store, StoreMemberRole } from '../../generated/prisma/client';

/**
 * Mağaza sahipliği kontrolü.
 *
 * Rol tek başına yetki vermez: "PARTNER" rolü kullanıcının *bir* işletmesi
 * olduğunu söyler, *bu* işletmenin sahibi olduğunu değil. Her partner
 * işlemi burada doğrulanır — aksi hâlde bir işletme sahibi başka bir
 * işletmenin siparişlerini görebilir ve stoğunu değiştirebilirdi.
 */
@Injectable()
export class StoreAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kullanıcının erişebildiği işletmeler. Yönetici hepsini görür.
   */
  async storesFor(user: AuthenticatedUser): Promise<Store[]> {
    if (user.role === 'ADMIN') {
      return this.prisma.store.findMany({ orderBy: { name: 'asc' } });
    }

    const memberships = await this.prisma.storeMember.findMany({
      where: { userId: user.id },
      include: { store: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => membership.store);
  }

  /**
   * Belirli bir işletmeye erişim doğrulaması.
   *
   * Yetkisiz erişimde "bulunamadı" döner: "yetkiniz yok" demek, o kimlikte
   * bir işletmenin var olduğunu doğrulardı.
   */
  async requireStore(
    user: AuthenticatedUser,
    storeId: string,
    minimumRole: StoreMemberRole = 'STAFF',
  ): Promise<Store> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    if (user.role === 'ADMIN') return store;

    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId: user.id } },
    });

    if (!membership) throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);

    const hierarchy: Record<StoreMemberRole, number> = { STAFF: 1, MANAGER: 2, OWNER: 3 };
    if (hierarchy[membership.role] < hierarchy[minimumRole]) {
      throw AppError.forbidden('Bu işlem için işletmede yeterli yetkiniz yok.');
    }

    return store;
  }

  /**
   * Kullanıcının varsayılan işletmesi. Tek işletmesi olan partner her
   * istekte mağaza kimliği göndermek zorunda kalmasın.
   */
  async defaultStore(user: AuthenticatedUser): Promise<Store> {
    const stores = await this.storesFor(user);
    if (stores.length === 0) {
      throw AppError.notFound('İşletme', ErrorCode.STORE_NOT_FOUND);
    }
    return stores[0];
  }

  /** Verilen paketin gerçekten bu işletmeye ait olduğunu doğrular. */
  async requireOwnBag(user: AuthenticatedUser, bagId: string) {
    const bag = await this.prisma.bag.findUnique({
      where: { id: bagId },
      include: { store: true },
    });

    if (!bag) throw AppError.notFound('Paket', ErrorCode.BAG_NOT_FOUND);
    await this.requireStore(user, bag.storeId, 'MANAGER');

    return bag;
  }
}
