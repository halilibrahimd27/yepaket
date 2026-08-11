import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../config/env';

/**
 * Redis bağlantıları.
 *
 * Üç ayrı istemci tutulur: pub/sub abonelik modundaki bir bağlantı başka
 * komut çalıştıramaz, bu yüzden yayıncı ve genel amaçlı istemciden ayrılmalıdır.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  readonly client: Redis;
  readonly publisher: Redis;
  readonly subscriber: Redis;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true });

    const options = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => Math.min(times * 200, 5_000),
    };

    this.client = new Redis(url, options);
    this.publisher = new Redis(url, options);
    this.subscriber = new Redis(url, options);

    for (const [name, instance] of Object.entries({
      client: this.client,
      publisher: this.publisher,
      subscriber: this.subscriber,
    })) {
      instance.on('error', (error: Error) => {
        this.logger.error(`Redis (${name}) hatası: ${error.message}`);
      });
    }
  }

  async ping(): Promise<boolean> {
    const response = await this.client.ping();
    return response === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.client.quit(),
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }
}
