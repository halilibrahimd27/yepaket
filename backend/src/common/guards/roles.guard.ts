import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../generated/prisma/client';
import { ROLES_KEY, type AuthenticatedRequest } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';

/**
 * `@Roles(...)` ile işaretlenmiş uçlarda rol kontrolü yapar.
 *
 * Rol kaba bir filtredir: "partner mı?" sorusunu yanıtlar, "bu mağazanın
 * partneri mi?" sorusunu yanıtlamaz. İkincisi kaynak sahipliği kontrolüdür
 * ve servis katmanında `StoreAccessService` ile yapılır.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) throw AppError.unauthenticated();

    // Yönetici tüm uçlara erişir; ayrıca her role tek tek eklenmesi gerekmez.
    if (user.role === 'ADMIN') return true;

    if (!required.includes(user.role)) {
      throw AppError.forbidden('Bu işlem için yetkiniz yok.');
    }

    return true;
  }
}
