import { Module } from '@nestjs/common';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';
import { MediaController } from '../media/media.controller';
import { MediaService } from '../media/media.service';
import { BagPublisherTasks } from './bag-publisher.tasks';
import { PartnerApplicationController, PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';
import { PayoutsService } from './payouts.service';
import { StoreAccessService } from './store-access.service';

/**
 * İşletme paneli, yönetici işlemleri ve medya.
 *
 * Tek modülde toplandılar çünkü hepsi `StoreAccessService` üzerinden aynı
 * sahiplik kontrolüne dayanıyor.
 */
@Module({
  controllers: [
    PartnerController,
    PartnerApplicationController,
    AdminController,
    MediaController,
  ],
  providers: [
    PartnerService,
    PayoutsService,
    StoreAccessService,
    AdminService,
    MediaService,
    BagPublisherTasks,
  ],
  exports: [StoreAccessService, PayoutsService, MediaService],
})
export class PartnerModule {}
