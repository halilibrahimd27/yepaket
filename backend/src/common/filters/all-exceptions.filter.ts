import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../errors/app-error';
import { ErrorCode, type ErrorCodeValue } from '../errors/error-codes';

interface NormalizedError {
  status: HttpStatus;
  /**
   * Normalde `ErrorCodeValue`'dur; `HttpException` gövdesinden gelen serbest
   * kodları da taşıyabildiği için tip `string` bırakılmıştır.
   */
  code: string;
  message: string;
  details?: Record<string, unknown>;
  /** Sunucu tarafında kaydedilecek, istemciye gönderilmeyecek ayrıntı. */
  internal?: unknown;
}

/**
 * Tüm hataları sözleşmedeki tek biçime indirger:
 *
 * ```json
 * { "error": { "code": "...", "message": "...", "details": {}, "request_id": "..." } }
 * ```
 *
 * Beklenmeyen hatalarda istemciye teknik ayrıntı sızdırılmaz; ayrıntı yalnızca
 * `request_id` ile eşleşen sunucu kaydına yazılır.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const normalized = this.normalize(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          requestId: request.id,
          method: request.method,
          path: request.url,
          err: normalized.internal ?? exception,
        },
        normalized.message,
      );
    } else if (normalized.status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn({ requestId: request.id, path: request.url }, 'Hız sınırı aşıldı');
    }

    response.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details ?? {},
        request_id: request.id ?? null,
      },
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof AppError) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Beklenmeyen bir hata oluştu.',
      internal: exception,
    };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { status, code: this.codeForStatus(status), message: payload };
    }

    const body = payload as Record<string, unknown>;

    // AppError zaten `code` taşır (HttpException gövdesi olarak kurulmuştur).
    if (typeof body.code === 'string') {
      return {
        status,
        code: body.code,
        message: typeof body.message === 'string' ? body.message : exception.message,
        details: body.details as Record<string, unknown> | undefined,
      };
    }

    // ValidationPipe çıktısı: message alanı alan hatalarının dizisidir.
    if (Array.isArray(body.message)) {
      return {
        status,
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Gönderilen veriler geçersiz.',
        details: { fields: body.message },
      };
    }

    return {
      status,
      code: this.codeForStatus(status),
      message: typeof body.message === 'string' ? body.message : exception.message,
    };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): NormalizedError {
    switch (exception.code) {
      case 'P2002': // benzersizlik ihlali
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Bu kayıt zaten mevcut.',
          details: { fields: exception.meta?.target ?? [] },
        };
      case 'P2025': // kayıt bulunamadı
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND,
          message: 'Kayıt bulunamadı.',
        };
      case 'P2003': // yabancı anahtar ihlali
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          code: ErrorCode.VALIDATION_FAILED,
          message: 'İlişkili kayıt bulunamadı.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Veritabanı işlemi tamamlanamadı.',
          internal: exception,
        };
    }
  }

  private codeForStatus(status: HttpStatus): ErrorCodeValue {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
