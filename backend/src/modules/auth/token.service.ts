import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { SessionRevocationService } from './session-revocation.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';
import type { DevicePlatform, Session, User } from '../../generated/prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionContext {
  deviceId: string;
  platform: DevicePlatform;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Jeton üretimi ve yenileme oturumu yönetimi.
 *
 * Erişim jetonu kısa ömürlü JWT'dir. Yenileme jetonu ise **opak** rastgele
 * bir dizgidir: JWT olsaydı iptal edilemezdi. Veritabanında yalnızca HMAC
 * hash'i saklanır; veritabanı sızsa bile jetonlar kullanılamaz.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly revocations: SessionRevocationService,
  ) {}

  /**
   * Yenileme jetonu yüksek entropili rastgele veridir (256 bit), bu yüzden
   * Argon2 gibi yavaş bir fonksiyona gerek yoktur; kaba kuvvet zaten
   * uygulanamaz. HMAC-SHA256 hem hızlı hem de sunucu sırrına bağlıdır.
   */
  private hash(token: string): string {
    return createHmac('sha256', this.config.get('JWT_REFRESH_SECRET', { infer: true }))
      .update(token)
      .digest('hex');
  }

  private async signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>, sessionId: string) {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
  }

  /** `15m`, `900s`, `1h` gibi ifadeleri saniyeye çevirir. */
  private accessTtlSeconds(): number {
    const raw = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const match = /^(\d+)([smhd])?$/.exec(raw.trim());
    if (!match) return 900;

    const value = Number(match[1]);
    switch (match[2]) {
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86_400;
      default:
        return value;
    }
  }

  /** Yeni bir oturum açar ve jeton çifti üretir. */
  async issue(
    user: Pick<User, 'id' | 'email' | 'role'>,
    context: SessionContext,
  ): Promise<TokenPair> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.get('REFRESH_TTL_DAYS', { infer: true }) * 86_400_000,
    );

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hash(refreshToken),
        deviceId: context.deviceId,
        platform: context.platform,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  /**
   * Yenileme jetonunu döndürür (rotation).
   *
   * Kullanılmış bir jeton tekrar sunulursa bu, jetonun çalındığına dair
   * güçlü bir sinyaldir: meşru istemci her yenilemede yeni jeton alır ve
   * eskisini bir daha kullanmaz. Bu durumda kullanıcının **tüm** oturumları
   * iptal edilir — saldırgan da meşru istemci de yeniden giriş yapmak
   * zorunda kalır.
   */
  async rotate(refreshToken: string, context: SessionContext): Promise<TokenPair> {
    const hash = this.hash(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: true },
    });

    if (!session) {
      throw AppError.unauthenticated(
        'Oturum bilgisi geçersiz.',
        ErrorCode.REFRESH_TOKEN_INVALID,
      );
    }

    if (session.revokedAt) {
      await this.revokeAllForUser(session.userId, 'refresh_token_reuse');
      throw AppError.unauthenticated(
        'Güvenlik nedeniyle tüm oturumlar kapatıldı. Lütfen tekrar giriş yapın.',
        ErrorCode.REFRESH_TOKEN_REUSED,
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthenticated('Oturum süresi doldu.', ErrorCode.REFRESH_TOKEN_INVALID);
    }

    if (session.user.deletedAt) {
      throw AppError.unauthenticated('Hesap kapatılmış.', ErrorCode.ACCOUNT_DISABLED);
    }

    const newRefreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.get('REFRESH_TTL_DAYS', { infer: true }) * 86_400_000,
    );

    // Eski oturumu iptal etmek ve yenisini açmak tek transaction'da olmalı:
    // arada bir hata olursa kullanıcı iki jetonun da geçersiz olduğu bir
    // aralıkta kalmamalı.
    const created = await this.prisma.$transaction(async (tx) => {
      const next = await tx.session.create({
        data: {
          userId: session.userId,
          refreshTokenHash: this.hash(newRefreshToken),
          deviceId: context.deviceId || session.deviceId,
          platform: context.platform,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          expiresAt,
        },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokeReason: 'rotated', replacedById: next.id },
      });

      return next;
    });

    // Döndürülen oturumun erişim jetonu da geçersizleşir: yenileme jetonu
    // ele geçirilip döndürüldüyse, eski erişim jetonu da kullanılmamalı.
    await this.revocations.revoke(session.id);

    return {
      accessToken: await this.signAccessToken(session.user, created.id),
      refreshToken: newRefreshToken,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  /**
   * Tek oturumu kapatır (çıkış).
   *
   * Veritabanı kaydının yanı sıra oturum kara listeye alınır; aksi hâlde
   * elde bulunan erişim jetonu süresi dolana kadar çalışmaya devam ederdi.
   */
  async revokeSession(sessionId: string, reason = 'logout'): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
    await this.revocations.revoke(sessionId);
  }

  /** Kullanıcının tüm açık oturumlarını kapatır. */
  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    // Kimlikler önce okunur: updateMany güncellenen satırları döndürmez ve
    // hangi oturumların kara listeye gireceğini bilmemiz gerekiyor.
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });

    if (sessions.length === 0) return 0;

    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });

    await this.revocations.revokeMany(sessions.map((session) => session.id));
    return result.count;
  }

  /** Kullanıcının açık oturumlarını listeler (cihaz yönetimi ekranı için). */
  async listSessions(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /**
   * Sabit zamanlı dizgi karşılaştırması. Uzunluk farkı sızdırmamak için
   * önce uzunluk kontrol edilir; bu bilgi zaten gizli değildir.
   */
  static safeEquals(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
