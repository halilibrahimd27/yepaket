import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { CatalogService } from './catalog.service';
import { DiscoveryService } from './discovery.service';
import { NearbyQueryDto } from './dto/discovery.dto';

/**
 * Keşif ve katalog uçları herkese açıktır: giriş yapmamış kullanıcı da
 * paketleri görebilmelidir. Jeton gönderilirse `is_favorite` alanı
 * kullanıcıya göre doldurulur (guard `@Public()` uçlarda da jetonu çözer).
 */
@ApiTags('bags')
@Controller('bags')
export class BagsController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('nearby')
  @Public()
  @ApiOperation({
    summary: 'Yakındaki paketleri listeler',
    description:
      'Konum verilirse mesafe PostGIS ile hesaplanır ve yarıçap filtresi coğrafi ' +
      'indeks üzerinden uygulanır. Konum verilmezse mesafe null döner.',
  })
  nearby(@Query() query: NearbyQueryDto, @CurrentUser('id') userId?: string) {
    return this.discovery.nearby(query, userId);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Paketleri listeler (nearby ile aynı filtreler)' })
  list(@Query() query: NearbyQueryDto, @CurrentUser('id') userId?: string) {
    return this.discovery.nearby(query, userId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Paket detayı' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId?: string) {
    return this.catalog.bagById(id, userId);
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Paketi favorilere ekler',
    description:
      'Favori işletme düzeyinde tutulur; paket kimliği işletmesine çevrilir. ' +
      'Tekrarlanan istek hata üretmez.',
  })
  addFavorite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.catalog.addFavoriteByBag(userId, id);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Paketi favorilerden çıkarır' })
  removeFavorite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.catalog.removeFavoriteByBag(userId, id);
  }
}

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'İşletme profili' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId?: string) {
    return this.catalog.storeById(id, userId);
  }

  @Get(':id/bags')
  @Public()
  @ApiOperation({ summary: 'İşletmenin yayındaki paketleri' })
  bags(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId?: string) {
    return this.catalog.storeBags(id, userId);
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'İşletmeyi favorilere ekler' })
  addFavorite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.catalog.addFavoriteByStore(userId, id);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'İşletmeyi favorilerden çıkarır' })
  removeFavorite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.catalog.removeFavoriteByStore(userId, id);
  }
}

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Favori işletmeler ve varsa bugünkü paketleri',
    description:
      'Favoriler ekranı bir işletmenin şu an satışta olup olmadığını göstermek ' +
      'zorunda olduğu için paketler de birlikte döner.',
  })
  list(@CurrentUser('id') userId: string) {
    return this.catalog.favorites(userId);
  }
}
