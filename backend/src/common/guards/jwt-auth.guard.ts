import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import {
  IS_PUBLIC_KEY,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import type { UserRole } from '../../generated/prisma/client';
import { SessionRevocationService } from '../../modules/auth/session-revocation.service';

/** Erişim jetonunun taşıdığı iddialar. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Oturum kimliği: jetonu üreten yenileme oturumuna bağlar. */
  sid: string;
}

/**
 * Erişim jetonunu doğrular ve kullanıcıyı istek bağlamına yerleştirir.
 *
 * Global guard olarak kaydedilir; muafiyet `@Public()` ile açıkça istenir.
 * Böylece yeni eklenen bir uç kazara herkese açık kalmaz.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly revocations: SessionRevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    // Herkese açık uçlarda jeton varsa yine de çözülür: "giriş yaptıysan
    // favori durumunu da göster" gibi davranışlar buna dayanır.
    if (isPublic) {
      if (token) {
        const user = await this.verify(token).catch(() => undefined);
        if (user) request.user = user;
      }
      return true;
    }

    if (!token) {
      throw AppError.unauthenticated('Bu işlem için giriş yapmalısınız.');
    }

    request.user = await this.verify(token);
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;

    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
    return value;
  }

  private async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });

      // İmza geçerli olsa bile oturum iptal edilmiş olabilir: çıkış, şifre
      // değişimi/sıfırlaması veya jeton hırsızlığı tespiti. İmza kontrolü
      // tek başına yeterli olsaydı, iptalden sonra jeton süresi dolana
      // kadar erişim sürerdi.
      if (await this.revocations.isRevoked(payload.sid)) {
        throw AppError.unauthenticated(
          'Oturumun sonlandırıldı. Lütfen tekrar giriş yap.',
          ErrorCode.SESSION_REVOKED,
        );
      }

      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid,
      };
    } catch (error) {
      // Kendi ürettiğimiz hata olduğu gibi geçer; aşağıdaki dönüşüm
      // yalnızca jwt kütüphanesinin hataları içindir.
      if (error instanceof AppError) throw error;

      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw AppError.unauthenticated(
        expired ? 'Oturum süresi doldu.' : 'Geçersiz oturum bilgisi.',
        expired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.UNAUTHENTICATED,
      );
    }
  }
}
