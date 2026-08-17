import { Global, Module } from '@nestjs/common';
import { ImpactService } from '../impact/impact.service';
import { MailService } from '../mail/mail.service';
import { SupportService } from '../support/support.service';
import { WaitlistService } from '../support/waitlist.service';
import { OutboxPublisher } from '../realtime/outbox.publisher';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { NotificationsTasks } from './notifications.tasks';
import {
  DevicesController,
  ImpactController,
  NotificationsController,
  SupportController,
  WaitlistController,
} from './notifications.controller';

/**
 * Bildirim, gerçek zamanlı olay, etki ve destek modülü.
 *
 * Tek modülde toplandılar çünkü hepsi aynı olay akışını paylaşıyor:
 * outbox → Redis → hem WebSocket hem kalıcı bildirim.
 */
@Global()
@Module({
  controllers: [
    NotificationsController,
    DevicesController,
    ImpactController,
    SupportController,
    WaitlistController,
  ],
  providers: [
    NotificationsService,
    PushService,
    NotificationsTasks,
    ImpactService,
    SupportService,
    WaitlistService,
    MailService,
    OutboxPublisher,
    RealtimeGateway,
  ],
  exports: [NotificationsService, MailService, ImpactService, PushService],
})
export class NotificationsModule {}
