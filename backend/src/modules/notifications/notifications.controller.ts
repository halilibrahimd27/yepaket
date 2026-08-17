import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { DevicePlatform, SupportCategory } from '../../generated/prisma/client';
import { ImpactService } from '../impact/impact.service';
import { SupportService } from '../support/support.service';
import { WAITLIST_FEATURES, WaitlistService } from '../support/waitlist.service';
import { NotificationsService } from './notifications.service';

export class RegisterPushTokenDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  deviceId!: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @ApiProperty()
  @IsString()
  @Length(10, 512)
  pushToken!: string;
}

export class CreateSupportTicketDto {
  @ApiProperty()
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(3, 160)
  subject!: string;

  @ApiProperty()
  @IsString()
  @Length(10, 4000)
  message!: string;

  @ApiPropertyOptional({ enum: SupportCategory })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(SupportCategory)
  category?: SupportCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;
}

export class JoinWaitlistDto {
  @ApiProperty({ enum: WAITLIST_FEATURES })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(WAITLIST_FEATURES)
  feature!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Bildirimleri listeler' })
  list(
    @CurrentUser('id') userId: string,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.list(userId, unread === 'true');
  }

  @Get('unread-count')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Okunmamış bildirim sayısı (rozet için)' })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Patch(':id/read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Bildirimi okundu işaretler' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Tümünü okundu işaretler' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Push bildirim jetonunu kaydeder' })
  register(@Body() dto: RegisterPushTokenDto, @CurrentUser('id') userId: string) {
    return this.notifications.registerPushToken(userId, dto);
  }
}

@ApiTags('impact')
@Controller('impact')
export class ImpactController {
  constructor(private readonly impact: ImpactService) {}

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Kullanıcının çevresel etkisi',
    description: 'Yalnızca teslim alınmış siparişler sayılır.',
  })
  me(@CurrentUser('id') userId: string) {
    return this.impact.forUser(userId);
  }

  @Get('community')
  @Public()
  @ApiOperation({ summary: 'Topluluk toplam etkisi (tanıtım sayfası için)' })
  community() {
    return this.impact.forCommunity();
  }
}

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /**
   * Hız sınırı zorunlu: bu uç giriş gerektirmiyor ve saldırganın belirlediği
   * adrese onay e-postası gönderiyor. Sınırsız bırakılırsa bir e-posta
   * bombardımanı aracına dönüşür ve gönderen alan adımızın itibarını
   * (deliverability) yakar.
   */
  @Post('tickets')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Destek talebi oluşturur',
    description: 'Giriş yapmamış kullanıcı da talep açabilir. Dakikada 3 istekle sınırlıdır.',
  })
  create(@Body() dto: CreateSupportTicketDto, @CurrentUser('id') userId?: string) {
    return this.support.create(dto, userId);
  }

  @Get('tickets')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Kullanıcının destek talepleri' })
  list(@CurrentUser('id') userId: string) {
    return this.support.listForUser(userId);
  }

  @Get('tickets/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Destek talebi detayı' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.support.byId(id, userId);
  }
}

/**
 * Yayına alınmamış özellikler için ilgi kaydı.
 *
 * Giriş zorunlu değil: kullanıcı ürünü denemeden önce haber almak isteyebilir.
 */
@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @Public()
  // Aynı gerekçe: kimlik gerektirmeyen yazma ucu sınırsız olmamalı.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Bekleme listesine katılır' })
  join(@Body() dto: JoinWaitlistDto, @CurrentUser('id') userId?: string) {
    return this.waitlist.join(dto, userId);
  }

  @Get(':feature/count')
  @Public()
  @ApiOperation({ summary: 'Özelliğin bekleme listesi sayısı' })
  count(@Param('feature') feature: string) {
    return this.waitlist.count(feature);
  }
}
