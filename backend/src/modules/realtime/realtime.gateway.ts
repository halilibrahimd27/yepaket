import { Logger, type OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { Env } from '../../config/env';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';
import { RedisService } from '../../redis/redis.service';
import { SessionRevocationService } from '../auth/session-revocation.service';
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
    private readonly revocations: SessionRevocationService,
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

      // HTTP guard'ıyla aynı kontrol: imza geçerli olsa bile oturum iptal
      // edilmiş olabilir (çıkış, şifre değişimi, jeton hırsızlığı).
      if (await this.revocations.isRevoked(payload.sid)) {
        client.emit('error', { code: 'SESSION_REVOKED' });
        client.disconnect(true);
        return;
      }

      await client.join(`user:${payload.sub}`);
      // socket.io `data` alanını `any` olarak tipler; erişimi burada daraltıyoruz.
      const data = client.data as {
        userId?: string;
        sessionId?: string;
        expiresAt?: number;
      };
      data.userId = payload.sub;
      data.sessionId = payload.sid;
      // `exp` saniye cinsindendir.
      data.expiresAt = (payload as { exp?: number }).exp;

      client.emit('connected', { userId: payload.sub });
    } catch {
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Bağlantı kapandı: ${client.id}`);
  }

  /**
   * Açık soketleri düzenli olarak yeniden doğrular.
   *
   * WebSocket bağlantısı bir kez kurulduktan sonra saatlerce açık kalabilir.
   * Yalnızca bağlantı anında kontrol etmek, o andan sonra iptal edilen veya
   * süresi dolan bir jetonun süresiz olay almasına izin verirdi — HTTP
   * tarafında kapattığımız pencerenin WebSocket'te açık kalması anlamına
   * gelirdi.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'realtime-revalidate' })
  async revalidateConnections(): Promise<void> {
    const sockets = await this.server.fetchSockets();
    const now = Math.floor(Date.now() / 1000);
    let dropped = 0;

    for (const socket of sockets) {
      const data = socket.data as { sessionId?: string; expiresAt?: number };
      if (!data.sessionId) continue;

      const expired = data.expiresAt !== undefined && data.expiresAt <= now;
      const revoked = expired ? false : await this.revocations.isRevoked(data.sessionId);

      if (expired || revoked) {
        socket.emit('error', {
          code: expired ? 'TOKEN_EXPIRED' : 'SESSION_REVOKED',
        });
        socket.disconnect(true);
        dropped += 1;
      }
    }

    if (dropped > 0) {
      this.logger.log(`${dropped} soket geçersiz oturum nedeniyle kapatıldı`);
    }
  }

  /**
   * Favori işletmelerin odalarına katılır.
   *
   * `bag.available` olayı `store:{id}` odasına yayınlanır. Bu abonelik
   * olmadan o odada kimse bulunmaz ve olay hiçbir istemciye ulaşmazdı —
   * yalnızca kalıcı bildirim yazılırdı.
   *
   * Sahiplik doğrulaması gerekmez: mağaza kimliği zaten herkese açık bir
   * bilgidir ve odaya yayınlanan olay yalnızca "yeni paket var" der,
   * kişisel veri taşımaz.
   */
  @SubscribeMessage('subscribe:stores')
  async subscribeStores(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ subscribed: number }> {
    const storeIds = RealtimeGateway.parseStoreIds(body);

    // Önce eski abonelikler bırakılır: favori listesi değiştiğinde istemci
    // tüm listeyi yeniden gönderir ve çıkarılan mağazadan olay almamalı.
    for (const room of client.rooms) {
      if (room.startsWith('store:')) await client.leave(room);
    }

    for (const id of storeIds) {
      await client.join(`store:${id}`);
    }

    return { subscribed: storeIds.length };
  }

  /**
   * İstemciden gelen mağaza kimliklerini ayıklar.
   *
   * Girdi doğrudan `join()`'e verilmez: uydurma bir değerle sınırsız oda
   * açtırmak bellek tüketimi anlamına gelirdi. UUID biçimi ve sayı sınırı
   * bunu kapatır.
   */
  private static parseStoreIds(body: unknown): string[] {
    const raw = Array.isArray(body)
      ? body
      : ((body as { storeIds?: unknown })?.storeIds ?? []);

    if (!Array.isArray(raw)) return [];

    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return [...new Set(raw.filter((id): id is string => typeof id === 'string'))]
      .filter((id) => uuid.test(id))
      .slice(0, 100);
  }
}
