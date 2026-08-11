import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CurrentUser,
  Public,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthProvider } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import {
  ChangePasswordDto,
  LoginDto,
  OAUTH_PROVIDERS,
  OAuthLoginDto,
  RefreshDto,
  RegisterDto,
  UpdateProfileDto,
  type OAuthProviderParam,
} from './dto/auth.dto';

/**
 * Kimlik doğrulama uçlarında hız sınırı genel sınırdan çok daha katıdır:
 * şifre deneme ve hesap sayımı saldırıları buradan gelir.
 */
const AUTH_THROTTLE = { default: { limit: 8, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  /** İstek üst bilgilerinden oturum bağlamı çıkarır. */
  private meta(request: Request) {
    return {
      userAgent: request.headers['user-agent']?.slice(0, 255),
      ipAddress: request.ip,
    };
  }

  @Post('register')
  @Public()
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'E-posta ve şifre ile yeni hesap oluşturur' })
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, this.meta(request));
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'E-posta ve şifre ile giriş yapar' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, this.meta(request));
  }

  @Post('oauth/:provider')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({
    summary: 'Sosyal giriş',
    description:
      'Sağlayıcıdan alınan id_token sunucuda, sağlayıcının açık anahtarıyla doğrulanır. ' +
      'İstemciden gelen kullanıcı bilgisine güvenilmez.',
  })
  oauth(
    @Param('provider') provider: string,
    @Body() dto: OAuthLoginDto,
    @Req() request: Request,
  ) {
    const normalized = provider.toLowerCase() as OAuthProviderParam;
    if (!OAUTH_PROVIDERS.includes(normalized)) {
      throw AppError.notFound('Sağlayıcı');
    }

    return this.auth.oauthLogin(
      normalized.toUpperCase() as AuthProvider,
      dto,
      this.meta(request),
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  // Yenileme normal akışın parçası olduğu için sınır biraz daha geniş,
  // ama yine de kaba kuvvete kapalı.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Erişim jetonunu yeniler',
    description:
      'Yenileme jetonu her kullanımda döner. Kullanılmış bir jeton tekrar sunulursa ' +
      'hırsızlık varsayılır ve kullanıcının tüm oturumları kapatılır.',
  })
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, dto.device, this.meta(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Yalnızca mevcut oturumu kapatır' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Tüm cihazlardaki oturumları kapatır' })
  logoutAll(@CurrentUser('id') userId: string) {
    return this.auth.logoutAll(userId);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Oturum açmış kullanıcının profili' })
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Profil bilgilerini günceller' })
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Hesabı kapatır (KVKK)',
    description:
      'Kişisel alanlar anonimleştirilir; sipariş ve ödeme kayıtları yasal saklama ' +
      'süresince korunur ancak kişiye bağlanamaz.',
  })
  async deleteAccount(@CurrentUser('id') userId: string): Promise<void> {
    await this.auth.deleteAccount(userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Şifre değiştirir',
    description: 'Başarılı olduğunda mevcut oturum dışındaki tüm oturumlar kapatılır.',
  })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, user.sessionId, dto);
  }

  @Get('sessions')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Açık oturumları listeler (cihaz yönetimi)' })
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.tokens.listSessions(user.id);

    // Jeton hash'i asla dışarı verilmez.
    return sessions.map((session) => ({
      id: session.id,
      deviceId: session.deviceId,
      platform: session.platform,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      isCurrent: session.id === user.sessionId,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Belirli bir oturumu kapatır' })
  async revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const sessions = await this.tokens.listSessions(user.id);
    if (!sessions.some((session) => session.id === sessionId)) {
      // Başkasının oturumunu kapatmaya çalışmak "bulunamadı" döner;
      // oturum kimliğinin varlığı sızdırılmaz.
      throw AppError.notFound('Oturum', ErrorCode.NOT_FOUND);
    }

    await this.tokens.revokeSession(sessionId, 'revoked_by_user');
  }
}
