import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength, Matches } from 'class-validator';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import {
  ReviewApplicationDto,
  SetCommissionDto,
  UpdateStoreStatusDto,
} from '../partner/dto/partner.dto';
import { PayoutsService } from '../partner/payouts.service';
import { AdminService } from './admin.service';

export class PayoutDetailsDto {
  @ApiPropertyOptional({ description: 'Ticari unvan' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Vergi/TC numarası 10 veya 11 hane olmalıdır.' })
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  taxOffice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(16, 16)
  mersisNo?: string;

  @ApiPropertyOptional({ example: 'TR330006100519786457841326' })
  @IsOptional()
  @IsString()
  @Matches(/^TR\d{24}$/, { message: 'IBAN "TR" ile başlamalı ve 26 karakter olmalıdır.' })
  iban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  ibanHolder?: string;

  @ApiPropertyOptional({ description: 'Ödeme sağlayıcısındaki alt üye işyeri kimliği' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  submerchantKey?: string;
}

export class MarkPayoutPaidDto {
  @ApiProperty({ description: 'Banka dekont/işlem referansı' })
  @IsString()
  @Length(3, 120)
  reference!: string;
}

export class UpdateTicketDto {
  @ApiProperty({ enum: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] })
  @IsString()
  status!: string;
}

/**
 * Yönetici uçları.
 *
 * `@Roles('ADMIN')` yeterlidir: yönetici tüm kaynaklara erişir, ama her
 * değiştirici işlem denetim kaydına yazılır.
 */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payouts: PayoutsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Sistem geneli özet' })
  overview() {
    return this.admin.overview();
  }

  // --- Başvurular -----------------------------------------------------------

  @Get('applications')
  @ApiOperation({ summary: 'İşletme başvuruları' })
  applications(@Query('status') status?: string) {
    return this.admin.listApplications(status);
  }

  @Post('applications/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Başvuruyu değerlendirir',
    description:
      'Onaylandığında işletme kaydı oluşturulur, başvuru e-postasıyla eşleşen kullanıcı ' +
      'sahip olarak atanır ve rolü PARTNER’a yükseltilir.',
  })
  reviewApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewApplicationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.admin.reviewApplication(actorId, id, dto);
  }

  // --- İşletmeler -----------------------------------------------------------

  @Get('stores')
  @ApiOperation({ summary: 'İşletmeler' })
  stores(@Query('status') status?: string) {
    return this.admin.listStores(status);
  }

  @Patch('stores/:id/status')
  @ApiOperation({
    summary: 'İşletme durumunu değiştirir',
    description: 'Askıya alınan işletmenin yayındaki paketleri de durdurulur.',
  })
  setStoreStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.admin.setStoreStatus(actorId, id, dto.status, dto.reason);
  }

  @Patch('stores/:id/commission')
  @ApiOperation({
    summary: 'Komisyon oranını değiştirir',
    description: 'Geçmiş siparişleri etkilemez — komisyon sipariş anında dondurulur.',
  })
  setCommission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCommissionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.admin.setCommission(actorId, id, dto);
  }

  @Patch('stores/:id/payout-details')
  @ApiOperation({
    summary: 'Hakediş bilgilerini günceller (IBAN, vergi)',
    description: 'Bilgiler eksiksiz olduğunda işletme hakedişe uygun hâle gelir.',
  })
  setPayoutDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayoutDetailsDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.admin.setPayoutDetails(actorId, id, dto);
  }

  // --- Hakediş --------------------------------------------------------------

  @Post('stores/:id/payouts/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verilen dönem için hakediş kaydı üretir' })
  async generatePayout(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('month') month: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const summary = await this.payouts.summary(user, id, month);
    const payout = await this.payouts.generateForPeriod(
      id,
      summary.period.start,
      summary.period.end,
    );

    return payout
      ? { id: payout.id, netMinor: Number(payout.netMinor), status: payout.status.toLowerCase() }
      : { id: null, netMinor: 0, status: 'no_orders' };
  }

  @Post('payouts/:id/mark-paid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hakedişi ödendi olarak işaretler' })
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPayoutPaidDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.payouts.markPaid(id, dto.reference, actorId);
  }

  // --- Destek ve denetim ----------------------------------------------------

  @Get('support/tickets')
  @ApiOperation({ summary: 'Destek talepleri' })
  tickets(@Query('status') status?: string) {
    return this.admin.listSupportTickets(status);
  }

  @Patch('support/tickets/:id')
  @ApiOperation({ summary: 'Destek talebi durumunu günceller' })
  updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.admin.resolveTicket(actorId, id, dto.status);
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Denetim kaydı' })
  auditLog(@Query('entity') entity?: string, @Query('limit') limit?: number) {
    return this.admin.listAuditLog(entity, limit ?? 100);
  }
}
