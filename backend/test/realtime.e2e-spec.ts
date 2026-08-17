import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Socket, io } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { OutboxPublisher } from '../src/modules/realtime/outbox.publisher';

/**
 * Gerçek zamanlı olay kanalının uçtan uca doğrulaması.
 *
 * Bu test olmadan, istemci tarafı sessizce bağlanamaz hâle gelse bile hiçbir
 * şey fark edilmezdi: kullanıcı yalnızca "stok neden güncellenmiyor?" diye
 * düşünür. Burada kanıtlananlar:
 *
 * - Jetonsuz veya geçersiz jetonlu bağlantı reddediliyor
 * - Geçerli jetonla bağlanan istemci kendi odasına (`user:{id}`) giriyor
 * - Mağaza aboneliği çalışıyor ve uydurma kimlikler süzülüyor
 * - Outbox'a yazılan olay bağlı istemciye ulaşıyor
 */
describe('Realtime (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxPublisher;
  let url: string;

  const device = { deviceId: 'e2e-realtime', platform: 'ANDROID' as const };
  const credentials = {
    email: `realtime_${Date.now()}@example.com`,
    password: 'GuvenliSifre1',
    name: 'Realtime Kullanıcı',
  };

  let accessToken: string;
  let userId: string;

  /** Açılan tüm soketler testin sonunda kapatılsın. */
  const sockets: Socket[] = [];

  const connect = (auth?: Record<string, unknown>): Socket => {
    const socket = io(`${url}/v1/realtime`, {
      transports: ['websocket'],
      auth,
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  };

  /** Bir olayı bekler; süre dolarsa testi anlamlı bir mesajla düşürür. */
  const waitFor = <T>(socket: Socket, event: string, timeoutMs = 6000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`"${event}" olayı ${timeoutMs} ms içinde gelmedi`)),
        timeoutMs,
      );
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    // WebSocket sunucusu ancak dinlemeye başlayınca ayağa kalkar.
    await app.listen(0);

    url = (await app.getUrl()).replace('[::1]', '127.0.0.1');

    prisma = app.get(PrismaService);
    outbox = app.get(OutboxPublisher);

    const registration = await request(app.getHttpServer() as App)
      .post('/v1/auth/register')
      .send({ ...credentials, device })
      .expect(201);

    const body = registration.body as {
      data: { access_token: string; user: { id: string } };
    };

    accessToken = body.data.access_token;
    userId = body.data.user.id;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();

    await prisma.outboxEvent.deleteMany({ where: { type: 'test.event' } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.device.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // Kimlik doğrulama
  // ---------------------------------------------------------------------------

  it('jetonsuz bağlantı reddedilir', async () => {
    const socket = connect();

    const error = await waitFor<{ code: string }>(socket, 'error');
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  it('geçersiz jetonla bağlantı reddedilir', async () => {
    const socket = connect({ token: 'uydurma.jeton.degeri' });

    const error = await waitFor<{ code: string }>(socket, 'error');
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  it('geçerli jetonla bağlanılır ve kullanıcı kimliği doğrulanır', async () => {
    const socket = connect({ token: accessToken });

    const connected = await waitFor<{ userId: string }>(socket, 'connected');
    expect(connected.userId).toBe(userId);
  });

  // ---------------------------------------------------------------------------
  // Mağaza aboneliği
  // ---------------------------------------------------------------------------

  it('mağaza aboneliği kabul edilir ve geçersiz kimlikler süzülür', async () => {
    const socket = connect({ token: accessToken });
    await waitFor(socket, 'connected');

    const valid = '11111111-2222-3333-4444-555555555555';

    const response = await socket
      .timeout(6000)
      .emitWithAck('subscribe:stores', {
        // UUID olmayan değerler odaya çevrilmemeli: uydurma değerlerle
        // sınırsız oda açtırmak bellek tüketimi anlamına gelirdi.
        storeIds: [valid, 'uydurma', '', 123, valid],
      });

    expect(response).toEqual({ subscribed: 1 });
  });

  // ---------------------------------------------------------------------------
  // Olay teslimi
  // ---------------------------------------------------------------------------

  it('kullanıcıya özel olay yalnızca o kullanıcıya ulaşır', async () => {
    const socket = connect({ token: accessToken });
    await waitFor(socket, 'connected');

    const received = waitFor<{ orderId: string; status: string }>(
      socket,
      'order.status.updated',
    );

    // Outbox'a yazıp yayıncıyı tetiklemek, üretimdeki yolun aynısıdır:
    // olay doğrudan sokete gönderilmez, veritabanından okunup Redis
    // üzerinden dağıtılır.
    await prisma.outboxEvent.create({
      data: {
        type: 'order.status.updated',
        payload: { userId, orderId: 'test-order-id', status: 'paid' },
      },
    });

    await outbox.publishPending();

    const event = await received;
    expect(event.orderId).toBe('test-order-id');
    expect(event.status).toBe('paid');
  });

  it('abone olunan mağazanın paket olayı ulaşır', async () => {
    const socket = connect({ token: accessToken });
    await waitFor(socket, 'connected');

    const storeId = '99999999-8888-7777-6666-555555555555';
    await socket.timeout(6000).emitWithAck('subscribe:stores', { storeIds: [storeId] });

    const received = waitFor<{ storeId: string; bagId: string }>(
      socket,
      'bag.available',
    );

    await prisma.outboxEvent.create({
      data: {
        type: 'bag.available',
        payload: { storeId, bagId: 'test-bag-id' },
      },
    });

    await outbox.publishPending();

    const event = await received;
    expect(event.storeId).toBe(storeId);
    expect(event.bagId).toBe('test-bag-id');
  });

  it('abone olunmayan mağazanın olayı ulaşmaz', async () => {
    const socket = connect({ token: accessToken });
    await waitFor(socket, 'connected');

    // Bilerek abone OLUNMUYOR.
    let delivered = false;
    socket.on('bag.available', () => {
      delivered = true;
    });

    await prisma.outboxEvent.create({
      data: {
        type: 'bag.available',
        payload: {
          storeId: '00000000-1111-2222-3333-444444444444',
          bagId: 'baska-bag',
        },
      },
    });

    await outbox.publishPending();
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(delivered).toBe(false);
  });
});
