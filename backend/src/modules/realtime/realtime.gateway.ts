import { Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { Env } from '../../config/env';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';
import { RedisService } from '../../redis/redis.service';
import { REALTIME_CHANNEL } from './outbox.publisher';

/**
 * Gerçek zamanlı olay kanalı.
 *
 * Olaylar Redis pub/sub üzerinden dağıtılır; böylece API yatayda
 * ölçeklendiğinde her örnek kendi bağlı istemcilerine yayın yapabilir.
 *
 * Yetkilendirme bağlantı anında yapılır: jetonsuz veya geçersiz jetonlu
 * bağlantı hemen kapatılır. Her kullanıcı yalnızca kendi odasına katılır,
 * bu yüzden başkasının olaylarını göremez.
 */
@WebSocketGateway({
  namespace: '/v1/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.subscriber.subscribe(REALTIME_CHANNEL);

    this.redis.subscriber.on('message', (channel, raw) => {
      if (channel !== REALTIME_CHANNEL) return;

      try {
        const event = JSON.parse(raw) as {
          type: string;
          payload: { userId?: string; storeId?: string };
        };
        this.fanOut(event.type, event.payload);
      } catch (error) {
        this.logger.error(`Olay çözümlenemedi: ${(error as Error).message}`);
      }
    });
  }

  private fanOut(type: string, payload: { userId?: string; storeId?: string }): void {
    if (!this.server) return;

    // Kullanıcıya özel olaylar yalnızca o kullanıcının odasına gider.
    if (payload.userId) {
      this.server.to(`user:${payload.userId}`).emit(type, payload);
    }

    // İşletmeye özel olaylar (yeni sipariş, stok) mağaza odasına gider.
    if (payload.storeId) {
      this.server.to(`store:${payload.storeId}`).emit(type, payload);
    }

    // Kimseye özel olmayan olaylar (stok güncellemesi) genel kanala.
    if (!payload.userId && !payload.storeId) {
      this.server.emit(type, payload);
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });

      await client.join(`user:${payload.sub}`);
      // socket.io `data` alanını `any` olarak tipler; erişimi burada daraltıyoruz.
      (client.data as { userId?: string }).userId = payload.sub;

      client.emit('connected', { userId: payload.sub });
    } catch {
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Bağlantı kapandı: ${client.id}`);
  }
}
