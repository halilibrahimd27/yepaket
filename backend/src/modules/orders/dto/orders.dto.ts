import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';

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
