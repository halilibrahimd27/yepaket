import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BagCategory, PublishMode, StoreStatus } from '../../../generated/prisma/client';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class CreateBagDto {
  @ApiProperty({ example: 'Günün Fırın Paketi' })
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiProperty({ enum: BagCategory })
  @Transform(upper)
  @IsEnum(BagCategory)
  category!: BagCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiProperty({ description: 'Normal değer (kuruş)', example: 42000 })
  @IsInt()
  @Min(1)
  originalValueMinor!: number;

  @ApiProperty({ description: 'Satış fiyatı (kuruş)', example: 13900 })
  @IsInt()
  @Min(1)
  salePriceMinor!: number;

  @ApiProperty({ minimum: 1, maximum: 200 })
  @IsInt()
  @Min(1)
  @Max(200)
  quantity!: number;

  @ApiProperty({ description: 'Teslim başlangıcı (ISO-8601 UTC)' })
  @IsISO8601()
  pickupStartsAt!: string;

  @ApiProperty({ description: 'Teslim bitişi (ISO-8601 UTC)' })
  @IsISO8601()
  pickupEndsAt!: string;
}

export class UpdateBagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Yeni toplam adet' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  salePriceMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  pickupStartsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  pickupEndsAt?: string;
}

export class CreateBagTemplateDto {
  @ApiProperty()
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiProperty({ enum: BagCategory })
  @Transform(upper)
  @IsEnum(BagCategory)
  category!: BagCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  originalValueMinor!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  salePriceMinor!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(200)
  defaultQuantity!: number;

  @ApiProperty({ example: '20:00', description: 'Yerel saat' })
  @Matches(HHMM)
  pickupStart!: string;

  @ApiProperty({ example: '20:30', description: 'Yerel saat' })
  @Matches(HHMM)
  pickupEnd!: string;

  @ApiProperty({ enum: PublishMode })
  @Transform(upper)
  @IsEnum(PublishMode)
  publishMode!: PublishMode;

  @ApiPropertyOptional({
    type: [Number],
    description: 'WEEKLY modunda yayın günleri (1=Pazartesi … 7=Pazar)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays?: number[];
}

export class UpdateStoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\s()-]{10,20}$/)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(5, 200)
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: '07:30' })
  @IsOptional()
  @Matches(HHMM)
  openingTime?: string;

  @ApiPropertyOptional({ example: '21:30' })
  @IsOptional()
  @Matches(HHMM)
  closingTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;
}

/** Web'deki "İşletmeni ekle" formu. Kimlik gerektirmez. */
export class PartnerApplicationDto {
  @ApiProperty()
  @IsString()
  @Length(2, 160)
  businessName!: string;

  @ApiProperty({ example: 'Fırın / Pastane' })
  @IsString()
  @Length(2, 80)
  businessType!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  contactName!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[0-9+\s()-]{10,20}$/, { message: 'Telefon numarası geçersiz.' })
  phone!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 80)
  city!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 80)
  district!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ConfirmPartnerPickupDto {
  @ApiProperty({ description: 'Müşterinin gösterdiği 6 haneli teslim kodu' })
  @IsString()
  @Length(6, 6)
  pickupCode!: string;
}

// Not: Bu sınıf ReviewApplicationDto'dan önce tanımlanmalı — dekoratör
// metadata'sı sınıf tanımlanırken değerlendirildiği için ileri referans
// çalışma zamanında hata verir.
export class StoreLocationDto {
  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiProperty()
  @IsString()
  @Length(5, 200)
  addressLine!: string;
}

export class ReviewApplicationDto {
  @ApiProperty({ enum: ['CONTACTED', 'APPROVED', 'REJECTED'] })
  @Transform(upper)
  @IsIn(['CONTACTED', 'APPROVED', 'REJECTED'])
  status!: 'CONTACTED' | 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Onaylanırsa işletme sahibi olacak kullanıcı' })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional({ description: 'Onaylanırsa işletme konumu' })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreLocationDto)
  location?: StoreLocationDto;
}


export class UpdateStoreStatusDto {
  @ApiProperty({ enum: StoreStatus })
  @Transform(upper)
  @IsEnum(StoreStatus)
  status!: StoreStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class SetCommissionDto {
  @ApiProperty({ description: 'Baz puan (1200 = %12)', minimum: 0, maximum: 10000 })
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionRateBps!: number;
}

export class ToggleBagDto {
  @ApiProperty()
  @IsBoolean()
  published!: boolean;
}
