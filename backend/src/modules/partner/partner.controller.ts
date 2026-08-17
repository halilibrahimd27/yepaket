import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  Public,
  Roles,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import { PartnerService } from './partner.service';
import { PayoutsService } from './payouts.service';
import {
  ConfirmPartnerPickupDto,
  CreateBagDto,
  CreateBagTemplateDto,
  PartnerApplicationDto,
  ToggleBagDto,
  UpdateBagDto,
  UpdateStoreDto,
} from './dto/partner.dto';

/**
 * İşletme paneli (MyStore) uçları.
 *
 * Hepsi PARTNER rolü ister; ayrıca her işlem mağaza üyeliğiyle doğrulanır.
 * Rol "bir işletmesi var" der, "bu işletmenin sahibi" demez.
 */
@ApiTags('partner')
@ApiBearerAuth('access-token')
@Controller('partner')
@Roles('PARTNER')
export class PartnerController {
  constructor(
    private readonly partner: PartnerService,
    private readonly payouts: PayoutsService,
  ) {}

  @Get('stores')
  @ApiOperation({ summary: 'Kullanıcının yönetebildiği işletmeler' })
  stores(@CurrentUser() user: AuthenticatedUser) {
    return this.partner.myStores(user);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Panel özeti',
    description:
      'Bugünün cirosu, bekleyen teslimler, aktif paketler ve 7 günlük seri tek çağrıda döner.',
  })
  dashboard(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.partner.dashboard(user, storeId);
  }

  // --- Paketler -------------------------------------------------------------

  @Get('bags')
  @ApiOperation({ summary: 'İşletmenin paketleri (satılan adet dahil)' })
  listBags(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.partner.listBags(user, storeId);
  }

  @Post('bags')
  @ApiOperation({ summary: 'Yeni sürpriz paket yayınlar' })
  createBag(
    @Body() dto: CreateBagDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('storeId') storeId?: string,
  ) {
    return this.partner.createBag(user, dto, storeId);
  }

  @Patch('bags/:id')
  @ApiOperation({
    summary: 'Paketi günceller',
    description: 'Toplam adet, satılmış adedin altına indirilemez.',
  })
  updateBag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.partner.updateBag(user, id, dto);
  }

  @Post('bags/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paketi yayına alır' })
  publishBag(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.toggleBag(user, id, true);
  }

  @Post('bags/:id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paketi yayından kaldırır' })
  pauseBag(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.toggleBag(user, id, false);
  }

  @Post('bags/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paketi yayına alır veya kaldırır' })
  toggleBag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleBagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.partner.toggleBag(user, id, dto.published);
  }

  @Delete('bags/:id')
  @ApiOperation({
    summary: 'Paketi siler',
    description: 'Sipariş almış paket silinmez, iptal edilir — geçmiş bozulmamalı.',
  })
  deleteBag(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.deleteBag(user, id);
  }

  // --- Tekrar eden yayın şablonları ----------------------------------------

  @Get('templates')
  @ApiOperation({ summary: 'Tekrar eden paket şablonları' })
  listTemplates(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.partner.listTemplates(user, storeId);
  }

  @Post('templates')
  @ApiOperation({
    summary: 'Tekrar eden paket şablonu oluşturur',
    description: 'Zamanlanmış iş, aktif şablonlardan her gün paket üretir.',
  })
  createTemplate(
    @Body() dto: CreateBagTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('storeId') storeId?: string,
  ) {
    return this.partner.createTemplate(user, dto, storeId);
  }

  @Post('templates/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Şablonu etkinleştirir veya durdurur' })
  toggleTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleBagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.partner.toggleTemplate(user, id, dto.published);
  }

  // --- Siparişler -----------------------------------------------------------

  @Get('orders')
  @ApiOperation({
    summary: 'İşletmenin siparişleri',
    description:
      'En yeniden eskiye sıralanır ve sayfalanır. Müşteri adı maskelenir; ' +
      'teslimde eşleştirme için baş harf yeterlidir.',
  })
  listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.partner.listOrders(user, { storeId, status, date, page, limit });
  }

  @Post('orders/:id/confirm-pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Teslim kodunu doğrulayarak siparişi tamamlar',
    description:
      'Müşteri uygulamayı açamadığında (şarj bitti, internet yok) personel kodu girerek ' +
      'teslimi tamamlayabilir.',
  })
  confirmPickup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPartnerPickupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.partner.confirmPickupByCode(user, id, dto.pickupCode);
  }

  // --- Mağaza profili -------------------------------------------------------

  @Get('store')
  @ApiOperation({ summary: 'Mağaza profili' })
  async store(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    const stores = await this.partner.myStores(user);
    if (storeId) return stores.find((store) => store.id === storeId) ?? stores[0];
    return stores[0];
  }

  @Patch('store')
  @ApiOperation({ summary: 'Mağaza profilini günceller' })
  updateStore(
    @Body() dto: UpdateStoreDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('storeId') storeId?: string,
  ) {
    return this.partner.updateStore(user, dto, storeId);
  }

  // --- Hakediş --------------------------------------------------------------

  @Get('payouts')
  @ApiOperation({ summary: 'Hakediş geçmişi' })
  payoutHistory(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.payouts.history(user, storeId);
  }

  @Get('payouts/summary')
  @ApiOperation({
    summary: 'Dönem hakediş özeti',
    description:
      'Yalnızca teslim alınmış siparişler hakedişe girer; iade edilenler dönemden düşülür.',
  })
  payoutSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('storeId') storeId?: string,
    @Query('month') month?: string,
  ) {
    return this.payouts.summary(user, storeId, month);
  }
}

/**
 * İşletme başvurusu — web'deki "İşletmeni ekle" formu.
 * Kimlik gerektirmez; hız sınırı kötüye kullanımı engeller.
 */
@ApiTags('partner')
@Controller('partners')
export class PartnerApplicationController {
  constructor(private readonly partner: PartnerService) {}

  @Post('applications')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'İşletme ön kayıt başvurusu' })
  apply(@Body() dto: PartnerApplicationDto) {
    return this.partner.submitApplication(dto);
  }
}
