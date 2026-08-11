import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '../../generated/prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/**
 * Kimlik doğrulama zorunluluğunu kaldırır.
 *
 * Guard varsayılan olarak *kapalıdır*: yeni bir uç eklendiğinde geliştirici
 * hiçbir şey yapmazsa uç korumalı olur. Açmak bilinçli bir karar gerektirir.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Ucu belirli rollerle sınırlar.
 *
 * Rol tek başına yetki vermez: partner uçlarında ayrıca mağaza üyeliği
 * kontrol edilir (bkz. `StoreAccessService`).
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** İstek bağlamına guard tarafından yerleştirilen kimlik bilgisi. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  /** Erişim jetonunun bağlı olduğu oturum; çıkışta bu oturum iptal edilir. */
  sessionId: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser; id?: string };

/**
 * Denetleyicilerde `@CurrentUser() user: AuthenticatedUser` şeklinde kullanılır.
 * Alan adı verilirse yalnızca o alanı döndürür: `@CurrentUser('id') id: string`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
