import { Module } from '@nestjs/common';
import {
  BagsController,
  FavoritesController,
  StoresController,
} from './catalog.controller';
import { CatalogService } from './catalog.service';
import { DiscoveryService } from './discovery.service';

@Module({
  controllers: [BagsController, StoresController, FavoritesController],
  providers: [CatalogService, DiscoveryService],
  exports: [CatalogService],
})
export class CatalogModule {}
