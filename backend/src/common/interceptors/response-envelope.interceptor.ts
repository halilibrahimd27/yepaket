import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, map } from 'rxjs';
import { deepSnakeCase } from '../util/case';

/**
 * Zarfın dışında kalması gereken uçlar (webhook yanıtı, sağlık kontrolü,
 * 3D Secure yönlendirme HTML'i) bu dekoratörle işaretlenir.
 */
export const SKIP_ENVELOPE = 'skipEnvelope';
export const SkipEnvelope = (): MethodDecorator => SetMetadata(SKIP_ENVELOPE, true);

/** Sayfalama bilgisi taşıyan servisler bu şekli döndürür. */
export interface Paginated<T> {
  items: T[];
  meta: Record<string, unknown>;
}

function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Paginated<unknown>).items) &&
    typeof (value as Paginated<unknown>).meta === 'object'
  );
}

/**
 * Sözleşmedeki yanıt zarfını uygular:
 *
 * ```json
 * { "data": ..., "meta": { "request_id": "...", "timestamp": "..." } }
 * ```
 *
 * Ayrıca tüm alan adlarını snake_case'e çevirir, böylece istemcilerle
 * isimlendirme sözleşmesi tek noktadan garanti altına alınır.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip || context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { id?: string }>();

    return next.handle().pipe(
      map((payload) => {
        const meta: Record<string, unknown> = {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        };

        let data: unknown = payload;
        if (isPaginated(payload)) {
          data = payload.items;
          Object.assign(meta, payload.meta);
        }

        // Zarf elle kurulur: aksi hâlde `data` ve `meta` anahtarları serbest
        // JSON sayılıp içerikleri dönüştürülmeden geçerdi.
        return {
          data: data === undefined ? null : deepSnakeCase(data),
          meta: deepSnakeCase(meta),
        };
      }),
    );
  }
}
