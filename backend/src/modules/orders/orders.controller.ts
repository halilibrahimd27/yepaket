import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { SkipEnvelope } from '../../common/interceptors/response-envelope.interceptor';
import { IdempotencyService } from './idempotency.service';
import { OrdersService } from './orders.service';
import { CancelOrderDto, ConfirmPickupDto, CreateOrderDto } from './dto/orders.dto';
import type { OrderStatus } from '../../generated/prisma/client';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Kullanıcı eylemi başına bir kez üretilmelidir (istek başına değil). ' +
      'Ağ tekrarında aynı anahtarla gelen istek ikinci sipariş oluşturmaz.',
  })
  @ApiOperation({
    summary: 'Sipariş oluşturur ve ödemeyi başlatır',
    description:
      'Stok, ödeme onayı beklenmeden rezerve edilir; aksi hâlde ödeme sayfasındayken ' +
      'paket başkasına satılabilirdi. Ödeme tamamlanmazsa rezervasyon otomatik geri verilir.',
  })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.idempotency.run(
      { key: idempotencyKey, endpoint: 'POST /orders', userId, body: dto },
      () => this.orders.create(userId, dto, { ipAddress: request.ip ?? '0.0.0.0' }),
    );
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Kullanıcının siparişleri' })
  list(@CurrentUser('id') userId: string, @Query('status') status?: string) {
    const parsed = status
      ? (status.split(',').map((item) => item.trim().toUpperCase()) as OrderStatus[])
      : undefined;
    return this.orders.listForUser(userId, parsed);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sipariş detayı' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.orders.byId(id, userId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Siparişi iptal eder',
    description:
      'Ücretsiz iptal penceresi teslim aralığına kalan süreye göre belirlenir. ' +
      'Ödeme alınmışsa iade süreci başlatılır.',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.idempotency.run(
      { key: idempotencyKey, endpoint: `POST /orders/${id}/cancel`, userId, body: dto },
      () => this.orders.cancel(id, userId, dto.reason),
    );
  }

  @Post(':id/pickup-nonce')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Teslim doğrulaması için tek kullanımlık kod üretir',
    description:
      'Yalnızca teslim aralığı içindeyken ve sunucu saatine göre verilir; ' +
      'istemcinin saatine güvenilmez.',
  })
  pickupNonce(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.orders.issuePickupNonce(id, userId);
  }

  @Post(':id/pickup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Teslim alındığını onaylar',
    description:
      'Kaydırma hareketi tek başına yeterli değildir: sunucu nonce, sipariş sahipliği ' +
      've zaman aralığını kendi saatine göre doğrular.',
  })
  confirmPickup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPickupDto,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.idempotency.run(
      { key: idempotencyKey, endpoint: `POST /orders/${id}/pickup`, userId, body: dto },
      () => this.orders.confirmPickup(id, userId, dto.pickupNonce),
    );
  }

  @Post(':id/share-pickup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Arkadaşa teslim bağlantısı üretir',
    description: 'Asıl teslim kodu paylaşılmaz; ayrı ve süreli bir jeton verilir.',
  })
  sharePickup(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.orders.sharePickup(id, userId);
  }

  /**
   * Ödeme sağlayıcısı 3D Secure sonrası kullanıcıyı buraya yönlendirir.
   * Kimlik doğrulaması yoktur: çağrı sağlayıcıdan gelir, kullanıcının
   * oturumu bu istekte taşınmaz. Güvenlik, sağlayıcı jetonunun
   * doğrulanmasıyla sağlanır.
   */
  @Post(':id/payment-callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @SkipEnvelope()
  @ApiOperation({ summary: 'Ödeme sağlayıcısı dönüş ucu (3D Secure sonrası)' })
  async paymentCallback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: Record<string, unknown>,
    @Query() query: Record<string, string>,
  ) {
    const order = await this.orders.completePayment(id, { ...query, ...payload });
    return { status: order.status, orderNo: order.orderNo };
  }
}
