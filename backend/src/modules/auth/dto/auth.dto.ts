import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsDefined,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DevicePlatform } from '../../../generated/prisma/client';

/** E-posta alanlarını normalleştirir: baştaki/sondaki boşluk ve büyük harf. */
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class DeviceInfoDto {
  @ApiProperty({ description: 'Cihazı tekil olarak tanımlayan kimlik', example: 'ios-9f2a...' })
  @IsString()
  @Length(1, 128)
  deviceId!: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @ApiPropertyOptional({ description: 'Push bildirim jetonu' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  pushToken?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'eylul@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'CokGizliSifre123' })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır.' })
  @MaxLength(128)
  // Yaygın zayıf şifreleri engellemek için asgari çeşitlilik: yalnızca
  // rakamdan veya yalnızca harften oluşan şifreler kabul edilmez.
  @Matches(/(?=.*[a-zA-ZğüşöçıİĞÜŞÖÇ])(?=.*\d)/, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  password!: string;

  @ApiProperty({ example: 'Eylül Kaya' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ example: '05551112233' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\s()-]{10,20}$/, { message: 'Telefon numarası geçersiz.' })
  phone?: string;

  @ApiProperty({ type: DeviceInfoDto })
  // @ValidateNested tek başına eksik alanı yakalamaz: alan yoksa doğrulama
  // atlanır ve servis katmanı null referansla patlar. @IsDefined() bunu
  // doğrulama hatasına çevirir.
  @IsDefined({ message: 'Cihaz bilgisi zorunludur.' })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device!: DeviceInfoDto;
}

export class LoginDto {
  @ApiProperty({ example: 'demo@yepaket.app' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  email!: string;

  @ApiProperty({ example: 'demo1234' })
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiProperty({ type: DeviceInfoDto })
  // @ValidateNested tek başına eksik alanı yakalamaz: alan yoksa doğrulama
  // atlanır ve servis katmanı null referansla patlar. @IsDefined() bunu
  // doğrulama hatasına çevirir.
  @IsDefined({ message: 'Cihaz bilgisi zorunludur.' })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device!: DeviceInfoDto;
}

export class OAuthLoginDto {
  @ApiProperty({
    description: 'Sağlayıcıdan alınan kimlik jetonu. Doğrulaması sunucuda yapılır.',
  })
  @IsString()
  @Length(10, 8192)
  idToken!: string;

  @ApiPropertyOptional({ description: 'Apple ilk girişte adı yalnızca burada gönderir.' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiProperty({ type: DeviceInfoDto })
  // @ValidateNested tek başına eksik alanı yakalamaz: alan yoksa doğrulama
  // atlanır ve servis katmanı null referansla patlar. @IsDefined() bunu
  // doğrulama hatasına çevirir.
  @IsDefined({ message: 'Cihaz bilgisi zorunludur.' })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device!: DeviceInfoDto;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(10, 512)
  refreshToken!: string;

  @ApiProperty({ type: DeviceInfoDto })
  // @ValidateNested tek başına eksik alanı yakalamaz: alan yoksa doğrulama
  // atlanır ve servis katmanı null referansla patlar. @IsDefined() bunu
  // doğrulama hatasına çevirir.
  @IsDefined({ message: 'Cihaz bilgisi zorunludur.' })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device!: DeviceInfoDto;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-zA-ZğüşöçıİĞÜŞÖÇ])(?=.*\d)/, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  newPassword!: string;
}

/**
 * Şifre sıfırlama isteği.
 *
 * Yalnızca e-posta alınır; yanıt adresin kayıtlı olup olmadığını sızdırmaz.
 */
export class RequestPasswordResetDto {
  @ApiProperty({ example: 'eylul@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ description: 'E-postadaki bağlantıda yer alan jeton' })
  @IsString()
  @Length(20, 200)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-zA-ZğüşöçıİĞÜŞÖÇ])(?=.*\d)/, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\s()-]{10,20}$/, { message: 'Telefon numarası geçersiz.' })
  phone?: string;

  @ApiPropertyOptional({ enum: ['tr-TR', 'en-US'] })
  @IsOptional()
  @IsIn(['tr-TR', 'en-US'])
  locale?: string;
}

/**
 * Bildirim tercihleri.
 *
 * Hepsi isteğe bağlı: kısmi güncelleme yapılabilsin diye. Gönderilmeyen
 * alan mevcut değerini korur.
 */
export class NotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Favori işletme yeni paket yayınladığında' })
  @IsOptional()
  @IsBoolean()
  bagAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Sipariş durumu ve teslim hatırlatması' })
  @IsOptional()
  @IsBoolean()
  orderUpdates?: boolean;

  @ApiPropertyOptional({ description: 'Aylık etki özeti' })
  @IsOptional()
  @IsBoolean()
  impactDigest?: boolean;

  @ApiPropertyOptional({ description: 'Kampanya ve duyurular' })
  @IsOptional()
  @IsBoolean()
  campaigns?: boolean;
}

/** OAuth sağlayıcısı yol parametresi olarak gelir. */
export const OAUTH_PROVIDERS = ['google', 'apple', 'microsoft'] as const;
export type OAuthProviderParam = (typeof OAUTH_PROVIDERS)[number];
