import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsTasks {
  private readonly logger = new Logger(NotificationsTasks.name);

  constructor(private readonly notifications: NotificationsService) {}

  /**
   * Teslim saatine ~30 dakika kalan siparişler için hatırlatma.
   * Beş dakikada bir çalışır; aynı sipariş için ikinci hatırlatma
   * gönderilmez.
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'pickup-reminders' })
  async sendPickupReminders(): Promise<void> {
    const sent = await this.notifications.sendPickupReminders();
    if (sent > 0) {
      this.logger.log(`${sent} teslim hatırlatması işlendi`);
    }
  }
}
