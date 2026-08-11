import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type ErrorCodeValue } from './error-codes';

/**
 * Alan hatası (domain error).
 *
 * `HttpException`'dan türer ki Nest'in yönlendirme katmanı doğru HTTP
 * durumunu üretsin; ama taşıdığı asıl bilgi makine tarafından okunabilir
 * `code` alanıdır. İstemciler buna göre dallanır.
 */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCodeValue,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(entity: string, code: ErrorCodeValue = ErrorCode.NOT_FOUND): AppError {
    return new AppError(code, `${entity} bulunamadı.`, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'Bu işlem için yetkiniz yok.'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static unauthenticated(
    message = 'Oturum açmanız gerekiyor.',
    code: ErrorCodeValue = ErrorCode.UNAUTHENTICATED,
  ): AppError {
    return new AppError(code, message, HttpStatus.UNAUTHORIZED);
  }

  static conflict(
    code: ErrorCodeValue,
    message: string,
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(code, message, HttpStatus.CONFLICT, details);
  }

  static unprocessable(
    code: ErrorCodeValue,
    message: string,
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}
