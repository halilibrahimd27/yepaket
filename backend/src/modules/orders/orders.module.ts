import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentWebhookController } from '../payments/webhook.controller';
import { IdempotencyService } from './idempotency.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersTasks } from './orders.tasks';

@Module({
  imports: [PaymentsModule],
  controllers: [OrdersController, PaymentWebhookController],
  providers: [OrdersService, IdempotencyService, OrdersTasks],
  exports: [OrdersService, IdempotencyService],
})
export class OrdersModule {}
