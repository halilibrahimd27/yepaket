import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '../../config/env';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthProvider } from '../../generated/prisma/client';

export interface VerifiedIdentity {
  provider: AuthProvider;
  /** Sağlayıcıdaki değişmez kullanıcı kimliği (`sub`). */
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

interface ProviderConfig {
  issuers: string[];
  jwksUri: string;
  audiences: string[];
}

/**
 * Sosyal giriş jetonlarını doğrular.
 *
 * Kritik kural: istemciden gelen kullanıcı bilgisine **asla** güvenilmez.
 * İstemci yalnızca sağlayıcının imzaladığı `id_token`'ı gönderir; kimlik
 * bilgisi sunucuda, sağlayıcının açık anahtarıyla imza doğrulandıktan sonra
 * jetonun içinden okunur. Aksi hâlde herkes istediği e-postayla giriş yapardı.
 */
@Injectable()
export class OAuthVerifierService {
  private readonly logger = new Logger(OAuthVerifierService.name);
  private readonly jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  private providerConfig(provider: AuthProvider): ProviderConfig | null {
    const parse = (value: string) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    switch (provider) {
      case 'GOOGLE': {
        const audiences = parse(this.config.get('GOOGLE_CLIENT_IDS', { infer: true }));
        return audiences.length
          ? {
              issuers: ['https://accounts.google.com', 'accounts.google.com'],
              jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
              audiences,
            }
          : null;
      }
      case 'APPLE': {
        const audiences = parse(this.config.get('APPLE_CLIENT_IDS', { infer: true }));
        return audiences.length
          ? {
              issuers: ['https://appleid.apple.com'],
              jwksUri: 'https://appleid.apple.com/auth/keys',
              audiences,
            }
          : null;
      }
      case 'MICROSOFT': {
        const audiences = parse(this.config.get('MICROSOFT_CLIENT_IDS', { infer: true }));
        return audiences.length
          ? {
              // Kişisel hesap ve kurumsal kiracılar farklı issuer üretir;
              // doğrulama `aud` ve imza üzerinden yapılır, issuer ön eki
              // kontrol edilir.
              issuers: ['https://login.microsoftonline.com/'],
              jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
              audiences,
            }
          : null;
      }
      default:
        return null;
    }
  }

  private keySet(uri: string) {
    let existing = this.jwks.get(uri);
    if (!existing) {
      // createRemoteJWKSet anahtarları önbelleğe alır ve gerektiğinde
      // yeniler; sağlayıcı anahtar döndürdüğünde kendiliğinden uyum sağlar.
      existing = createRemoteJWKSet(new URL(uri), {
        cooldownDuration: 30_000,
        cacheMaxAge: 600_000,
      });
      this.jwks.set(uri, existing);
    }
    return existing;
  }

  async verify(provider: AuthProvider, idToken: string): Promise<VerifiedIdentity> {
    if (this.config.get('OAUTH_ALLOW_MOCK', { infer: true })) {
      const mocked = this.tryMock(provider, idToken);
      if (mocked) return mocked;
    }

    const providerConfig = this.providerConfig(provider);
    if (!providerConfig) {
      throw new AppError(
        ErrorCode.OAUTH_VERIFICATION_FAILED,
        `${provider} ile giriş bu ortamda yapılandırılmamış.`,
        503,
      );
    }

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(idToken, this.keySet(providerConfig.jwksUri), {
        audience: providerConfig.audiences,
        clockTolerance: 60,
      });
      payload = result.payload;
    } catch (error) {
      this.logger.warn(`${provider} jeton doğrulaması başarısız: ${(error as Error).message}`);
      throw new AppError(
        ErrorCode.OAUTH_VERIFICATION_FAILED,
        'Sosyal giriş doğrulanamadı.',
        401,
      );
    }

    const issuer = typeof payload.iss === 'string' ? payload.iss : '';
    const issuerAllowed = providerConfig.issuers.some((allowed) =>
      allowed.endsWith('/') ? issuer.startsWith(allowed) : issuer === allowed,
    );

    if (!issuerAllowed) {
      throw new AppError(
        ErrorCode.OAUTH_VERIFICATION_FAILED,
        'Sosyal giriş doğrulanamadı.',
        401,
      );
    }

    const email = typeof payload.email === 'string' ? payload.email : undefined;
    if (!email) {
      // Apple "e-postamı gizle" seçeneğinde yönlendirme adresi döndürür;
      // e-posta hiç yoksa hesabı eşleştirecek anahtarımız kalmaz.
      throw new AppError(
        ErrorCode.OAUTH_VERIFICATION_FAILED,
        'Sosyal hesabınızda e-posta paylaşımı kapalı; e-posta ile giriş yapabilirsiniz.',
        422,
      );
    }

    return {
      provider,
      providerAccountId: String(payload.sub),
      email,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  }

  /**
   * Geliştirme kolaylığı: `mock:<sağlayıcı-hesap-id>:<e-posta>` biçimindeki
   * jetonu kabul eder. Yalnızca OAUTH_ALLOW_MOCK açıkken çalışır ve bu
   * bayrak üretimde şema düzeyinde reddedilir.
   */
  private tryMock(provider: AuthProvider, idToken: string): VerifiedIdentity | null {
    if (!idToken.startsWith('mock:')) return null;

    const [, accountId, email] = idToken.split(':');
    if (!accountId || !email) return null;

    this.logger.warn(`SAHTE sosyal giriş kullanıldı (${provider}, ${email}) — yalnızca geliştirme`);

    return {
      provider,
      providerAccountId: accountId,
      email,
      emailVerified: true,
      name: email.split('@')[0],
    };
  }
}
