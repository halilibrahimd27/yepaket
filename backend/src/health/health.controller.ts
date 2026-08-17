import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/auth.decorators';
import { SkipEnvelope } from '../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Sağlık uçları yanıt zarfının dışındadır: yük dengeleyiciler ve konteyner
 * orkestratörleri standart terminus çıktısını bekler.
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle()
// Yük dengeleyici ve konteyner orkestratörü kimlik doğrulayamaz; sağlık
// uçları kimlik gerektirmemelidir. Guard varsayılan olarak kapalı olduğu
// için bu muafiyet açıkça belirtilir.
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Süreç ayakta mı? Bağımlılıklara bakmaz — yeniden başlatma kararı için. */
  @Get('live')
  @SkipEnvelope()
  @ApiOperation({
    summary: 'Süreç ayakta mı (liveness)',
    description:
      'Bağımlılıklara bakmaz. Kubernetes bu ucu 200 dönmediğinde konteyneri yeniden başlatır; ' +
      'veritabanı kesintisinde yeniden başlatmak durumu düzeltmez, bu yüzden burada kontrol edilmez.',
  })
  live(): { status: string } {
    return { status: 'ok' };
  }

  /** Trafik alabilir mi? Veritabanı ve Redis erişilebilir olmalı. */
  @Get('ready')
  @SkipEnvelope()
  @HealthCheck()
  @ApiOperation({ summary: 'Bağımlılıkların hazır olup olmadığını kontrol eder' })
  ready() {
    return this.health.check([
      async () => {
        const check = this.indicator.check('database');
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return check.up();
        } catch (error) {
          return check.down({ message: (error as Error).message });
        }
      },
      async () => {
        const check = this.indicator.check('redis');
        try {
          const alive = await this.redis.ping();
          return alive ? check.up() : check.down({ message: 'PONG alınamadı' });
        } catch (error) {
          return check.down({ message: (error as Error).message });
        }
      },
    ]);
  }

  @Get()
  @SkipEnvelope()
  @HealthCheck()
  @ApiOperation({ summary: 'Genel sağlık özeti (readiness ile aynı kontroller)' })
  root() {
    return this.ready();
  }
}
