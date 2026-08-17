import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'Sipariş verilecek paket' })
  @IsUUID()
  bagId!: string;

  @ApiProperty({ minimum: 1, maximum: 10, default: 1 })
  @IsInt()
  @Min(1)
  // Üst sınır kötüye kullanımı sınırlar: tek istekte tüm stoğu rezerve edip
  // ödemeden kaçmak, paketi başkalarına kapatmak anlamına gelirdi.
  @Max(10)
  quantity = 1;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class ConfirmPickupDto {
  @ApiProperty({ description: 'Teslim ekranından alınan tek kullanımlık doğrulama' })
  @IsString()
  @Length(10, 128)
  pickupNonce!: string;
}

export class RateOrderDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  overall!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  foodQuality?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  pickupExperience?: number;

  @ApiPropertyOptional({ type: [String], example: ['Lezzetli', 'Kolay teslim'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
