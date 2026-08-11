import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BagCategory } from '../../../generated/prisma/client';

export enum BagSort {
  RELEVANCE = 'relevance',
  DISTANCE = 'distance',
  PRICE = 'price',
  RATING = 'rating',
  PICKUP_TIME = 'pickup_time',
}

/** "HH:mm" biçimindeki gün içi saat filtresi. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class NearbyQueryDto {
  @ApiPropertyOptional({ example: 40.9877, description: 'Kullanıcı enlemi' })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 29.0277, description: 'Kullanıcı boylamı' })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ default: 10, description: 'Arama yarıçapı (km)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  radiusKm?: number = 10;

  @ApiPropertyOptional({ enum: BagCategory })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(BagCategory)
  category?: BagCategory;

  @ApiPropertyOptional({ example: '18:00', description: 'Teslim aralığı başlangıç filtresi' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'Saat "HH:mm" biçiminde olmalıdır.' })
  pickupFrom?: string;

  @ApiPropertyOptional({ example: '23:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'Saat "HH:mm" biçiminde olmalıdır.' })
  pickupTo?: string;

  @ApiPropertyOptional({ description: 'Azami satış fiyatı (kuruş)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPriceMinor?: number;

  @ApiPropertyOptional({ description: 'İşletme veya paket adında arama' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ enum: BagSort, default: BagSort.RELEVANCE })
  @IsOptional()
  @IsEnum(BagSort)
  sort?: BagSort = BagSort.RELEVANCE;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
