import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthVerifierService } from './oauth-verifier.service';
import { AuthTasks } from './auth.tasks';
import { PasswordResetService } from './password-reset.service';
import { SessionRevocationService } from './session-revocation.service';
import { TokenService } from './token.service';

/**
 * JwtModule sırsız kaydedilir: imzalama ve doğrulama sırasında sır her
 * çağrıda açıkça verilir. Böylece erişim ve yenileme sırları karışmaz.
 *
 * `global: true` gereklidir: `JwtAuthGuard` uygulama genelinde APP_GUARD
 * olarak kaydediliyor ve AuthModule kapsamının dışında çözümleniyor.
 */
/**
 * `@Global`: `SessionRevocationService` hem HTTP guard'ı hem WebSocket ağ
 * geçidi tarafından kullanılıyor ve ikisi de bu modülün kapsamı dışında
 * çözümleniyor. Her tüketici modüle AuthModule'ü ayrı ayrı import ettirmek,
 * birinin unutulmasına ve iptal kontrolünün sessizce devre dışı kalmasına
 * yol açardı.
 */
@Global()
@Module({
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordResetService,
    OAuthVerifierService,
    SessionRevocationService,
    AuthTasks,
  ],
  exports: [AuthService, TokenService, SessionRevocationService],
})
export class AuthModule {}
