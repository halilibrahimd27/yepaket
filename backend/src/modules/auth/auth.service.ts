import { Injectable, Logger } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthProvider, User } from '../../generated/prisma/client';
import { OAuthVerifierService } from './oauth-verifier.service';
import { SessionRevocationService } from './session-revocation.service';
import { TokenService, type SessionContext, type TokenPair } from './token.service';
import type {
  ChangePasswordDto,
  DeviceInfoDto,
  LoginDto,
  NotificationPreferencesDto,
  OAuthLoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

/** Bildirim tercihlerinin tam hâli; eksik anahtar bırakılmaz. */
export interface NotificationPreferences {
  bagAvailable: boolean;
  orderUpdates: boolean;
  impactDigest: boolean;
  campaigns: boolean;
}

/**
 * Argon2id parametreleri.
 *
 * OWASP'ın önerdiği taban yapılandırma (19 MiB bellek, 2 tur). Bellek maliyeti
 * GPU ile paralel denemeyi pahalı kılar; sunucu tarafında ~50 ms'lik bir
 * maliyet giriş akışı için kabul edilebilir.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Kullanıcı bulunamadığında da doğrulama yapabilmek için sabit bir hash.
 * Böylece "kayıtlı e-posta" ile "kayıtsız e-posta" arasındaki yanıt süresi
 * farkı üzerinden hesap sayımı (user enumeration) yapılamaz.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$Wm9tYmllUGxhY2Vob2xkZXJIYXNoVmFsdWU';

export interface AuthResult extends TokenPair {
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: User['role'];
  locale: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly oauth: OAuthVerifierService,
    private readonly revocations: SessionRevocationService,
  ) {}

  static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      locale: user.locale,
    };
  }

  private sessionContext(device: DeviceInfoDto, meta: Omit<SessionContext, keyof DeviceInfoDto>) {
    return {
      deviceId: device.deviceId,
      platform: device.platform,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    } satisfies SessionContext;
  }

  /** Cihaz kaydı push bildirimi için gerekli; her girişte tazelenir. */
  private async upsertDevice(userId: string, device: DeviceInfoDto): Promise<void> {
    await this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: device.deviceId } },
      update: {
        platform: device.platform,
        pushToken: device.pushToken,
        appVersion: device.appVersion,
      },
      create: {
        userId,
        deviceId: device.deviceId,
        platform: device.platform,
        pushToken: device.pushToken,
        appVersion: device.appVersion,
      },
    });
  }

  async register(dto: RegisterDto, meta: { userAgent?: string; ipAddress?: string }): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw AppError.conflict(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Bu e-posta adresi zaten kayıtlı.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        passwordHash: await hash(dto.password, ARGON2_OPTIONS),
        // Rol asla istekten alınmaz: aksi hâlde herkes kendini yönetici
        // olarak kaydedebilirdi.
        role: 'CONSUMER',
      },
    });

    await this.upsertDevice(user.id, dto.device);
    const pair = await this.tokens.issue(user, this.sessionContext(dto.device, meta));

    return { ...pair, user: AuthService.toPublicUser(user) };
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ipAddress?: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Kullanıcı yoksa bile doğrulama çalıştırılır (sabit zaman).
    const passwordMatches = await verify(user?.passwordHash ?? DUMMY_HASH, dto.password).catch(
      () => false,
    );

    if (!user || !user.passwordHash || !passwordMatches) {
      throw AppError.unauthenticated(
        'E-posta veya şifre hatalı.',
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    if (user.deletedAt) {
      throw AppError.unauthenticated('Bu hesap kapatılmış.', ErrorCode.ACCOUNT_DISABLED);
    }

    await this.upsertDevice(user.id, dto.device);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const pair = await this.tokens.issue(user, this.sessionContext(dto.device, meta));
    return { ...pair, user: AuthService.toPublicUser(user) };
  }

  /**
   * Sosyal giriş.
   *
   * Hesap eşleştirme sırası önemlidir:
   * 1. Aynı sağlayıcı hesabı daha önce bağlandıysa o kullanıcı.
   * 2. Aynı e-postaya sahip kullanıcı varsa **yalnızca sağlayıcı e-postayı
   *    doğrulamışsa** bağlanır. Aksi hâlde saldırgan, doğrulanmamış bir
   *    e-postayla var olan hesabı ele geçirebilirdi.
   * 3. Yoksa yeni kullanıcı oluşturulur.
   */
  async oauthLogin(
    provider: AuthProvider,
    dto: OAuthLoginDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const identity = await this.oauth.verify(provider, dto.idToken);

    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: identity.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user = linked?.user;

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });

      if (byEmail) {
        if (!identity.emailVerified) {
          throw AppError.conflict(
            ErrorCode.OAUTH_VERIFICATION_FAILED,
            'Bu e-posta adresiyle bir hesap var. Şifrenizle giriş yapıp sosyal hesabınızı ayarlardan bağlayabilirsiniz.',
          );
        }

        // Hesap ön-ele geçirme (pre-hijacking) savunması.
        //
        // Kayıt sırasında e-posta doğrulaması yapmıyoruz. Bu, bir saldırganın
        // başkasının adresiyle önceden şifreli hesap açmasına izin verir.
        // Gerçek sahip sonradan sosyal girişle geldiğinde sağlayıcı adresi
        // doğrulamış olur ve hesabı ona bağlarız — ama saldırganın şifresi
        // hâlâ çalışıyorsa hesaba ikisi de erişebilir.
        //
        // Bu yüzden bağlama anında var olan şifre GEÇERSİZ KILINIR ve tüm
        // oturumlar kapatılır. Sağlayıcı adresin sahibini doğruladı; o andan
        // sonra tek meşru giriş yolu sosyal hesaptır. Şifreyle girmek isteyen
        // gerçek sahip "şifremi unuttum" akışını kullanır ve bu akış da aynı
        // adrese e-posta gönderdiği için yine doğrulanmış olur.
        if (byEmail.passwordHash) {
          const sessions = await this.prisma.session.findMany({
            where: { userId: byEmail.id, revokedAt: null },
            select: { id: true },
          });

          await this.prisma.$transaction([
            this.prisma.user.update({
              where: { id: byEmail.id },
              data: { passwordHash: null, emailVerifiedAt: new Date() },
            }),
            this.prisma.session.updateMany({
              where: { userId: byEmail.id, revokedAt: null },
              data: {
                revokedAt: new Date(),
                revokeReason: 'oauth_link_password_cleared',
              },
            }),
          ]);

          await this.revocations.revokeMany(sessions.map((session) => session.id));

          this.logger.warn(
            `Sosyal hesap bağlandı, mevcut şifre geçersiz kılındı: ${byEmail.id} ` +
              `(${sessions.length} oturum kapatıldı)`,
          );
        } else if (!byEmail.emailVerifiedAt) {
          await this.prisma.user.update({
            where: { id: byEmail.id },
            data: { emailVerifiedAt: new Date() },
          });
        }

        user = byEmail;
      } else {
        user = await this.prisma.user.create({
          data: {
            email: identity.email,
            name: dto.name ?? identity.name ?? identity.email.split('@')[0],
            role: 'CONSUMER',
            emailVerifiedAt: identity.emailVerified ? new Date() : null,
          },
        });
      }

      await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider,
          providerAccountId: identity.providerAccountId,
          email: identity.email,
        },
      });
    }

    if (user.deletedAt) {
      throw AppError.unauthenticated('Bu hesap kapatılmış.', ErrorCode.ACCOUNT_DISABLED);
    }

    await this.upsertDevice(user.id, dto.device);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const pair = await this.tokens.issue(user, this.sessionContext(dto.device, meta));
    return { ...pair, user: AuthService.toPublicUser(user) };
  }

  async refresh(
    refreshToken: string,
    device: DeviceInfoDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, this.sessionContext(device, meta));
  }

  async logout(sessionId: string): Promise<void> {
    await this.tokens.revokeSession(sessionId);
  }

  async logoutAll(userId: string): Promise<{ revoked: number }> {
    const revoked = await this.tokens.revokeAllForUser(userId, 'logout_all');
    return { revoked };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw AppError.notFound('Kullanıcı');
    return AuthService.toPublicUser(user);
  }

  /**
   * Bildirim tercihlerini okur.
   *
   * Kaydedilmemiş anahtar "açık" sayılır: yeni bir bildirim türü
   * eklendiğinde mevcut kullanıcılar da alsın, sessizce dışarıda kalmasın.
   */
  async notificationPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });

    return AuthService.mergePreferences(user?.notificationPrefs);
  }

  async updateNotificationPreferences(
    userId: string,
    dto: NotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const current = await this.notificationPreferences(userId);

    // Kısmi güncelleme: gönderilmeyen alan mevcut değerini korur.
    const next: NotificationPreferences = {
      bagAvailable: dto.bagAvailable ?? current.bagAvailable,
      orderUpdates: dto.orderUpdates ?? current.orderUpdates,
      impactDigest: dto.impactDigest ?? current.impactDigest,
      campaigns: dto.campaigns ?? current.campaigns,
    };

    await this.prisma.user.update({
      where: { id: userId },
      // Prisma'nın JSON girdisi indeks imzası bekler; arayüzü olduğu gibi
      // vermek tip hatası üretiyor.
      data: { notificationPrefs: { ...next } },
    });

    return next;
  }

  /** JSON alanını varsayılanlarla birleştirir. */
  private static mergePreferences(value: unknown): NotificationPreferences {
    const stored = (value ?? {}) as Partial<NotificationPreferences>;
    return {
      bagAvailable: stored.bagAvailable ?? true,
      orderUpdates: stored.orderUpdates ?? true,
      impactDigest: stored.impactDigest ?? true,
      campaigns: stored.campaigns ?? true,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone, locale: dto.locale },
    });
    return AuthService.toPublicUser(user);
  }

  /**
   * Şifre değiştirildiğinde diğer tüm oturumlar kapatılır: şifre
   * değiştirmenin amacı zaten "başkasının erişimini kes"tir.
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ): Promise<{ revokedSessions: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw AppError.unprocessable(
        ErrorCode.VALIDATION_FAILED,
        'Bu hesap sosyal giriş kullanıyor; şifre tanımlı değil.',
      );
    }

    const matches = await verify(user.passwordHash, dto.currentPassword).catch(() => false);
    if (!matches) {
      throw AppError.unauthenticated('Mevcut şifre hatalı.', ErrorCode.INVALID_CREDENTIALS);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(dto.newPassword, ARGON2_OPTIONS) },
    });

    // Kimlikler önce okunur: kara listeye alınacak oturumları bilmek
    // gerekiyor. Yalnızca veritabanını güncellemek yetmez; elde bulunan
    // erişim jetonları süresi dolana kadar çalışmaya devam ederdi.
    const targets = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      select: { id: true },
    });

    const revoked = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date(), revokeReason: 'password_changed' },
    });

    await this.revocations.revokeMany(targets.map((session) => session.id));

    return { revokedSessions: revoked.count };
  }

  /**
   * KVKK: hesap silme.
   *
   * Kişisel alanlar anonimleştirilir, finansal kayıtlar (sipariş, ödeme)
   * yasal saklama süresi boyunca korunur ama artık kişiye bağlanamaz.
   * Satırın tamamen silinmesi sipariş geçmişini ve muhasebe kayıtlarını
   * bozardı.
   */
  async deleteAccount(userId: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const anonymousEmail = `silinmis+${userId}@yepaket.invalid`;

      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymousEmail,
          name: 'Silinmiş kullanıcı',
          phone: null,
          avatarUrl: null,
          passwordHash: null,
          deletedAt: new Date(),
        },
      });

      await tx.oAuthAccount.deleteMany({ where: { userId } });
      await tx.device.deleteMany({ where: { userId } });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'account_deleted' },
      });
    });

    // Silinen hesabın elindeki erişim jetonları da anında geçersizleşir.
    await this.revocations.revokeMany(sessions.map((session) => session.id));

    this.logger.log(`Hesap anonimleştirildi: ${userId}`);
  }
}
