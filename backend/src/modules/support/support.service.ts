import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { MailService } from '../mail/mail.service';
import type { SupportCategory } from '../../generated/prisma/client';

export interface CreateTicketInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: SupportCategory;
  orderId?: string;
}

/**
 * Destek talepleri.
 *
 * Giriş yapmamış kullanıcı da talep açabilir (web'deki destek formu);
 * bu yüzden kullanıcı kimliği isteğe bağlıdır.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async create(input: CreateTicketInput, userId?: string) {
    // Sipariş numarası verildiyse gerçekten bu kullanıcıya ait olmalı;
    // aksi hâlde başkasının sipariş bilgisi destek kaydına iliştirilirdi.
    if (input.orderId && userId) {
      const order = await this.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { userId: true },
      });
      if (!order || order.userId !== userId) {
        throw AppError.notFound('Sipariş');
      }
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        orderId: input.orderId,
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        category: input.category ?? 'OTHER',
      },
    });

    await this.mail.sendSupportAcknowledgement(ticket.email, ticket.name, ticket.id);

    this.logger.log(`Destek talebi oluşturuldu: ${ticket.id}`);

    return {
      id: ticket.id,
      status: ticket.status.toLowerCase(),
      createdAt: ticket.createdAt,
    };
  }

  async byId(ticketId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });

    if (!ticket || ticket.userId !== userId) {
      throw AppError.notFound('Destek talebi');
    }

    return {
      id: ticket.id,
      subject: ticket.subject,
      message: ticket.message,
      category: ticket.category.toLowerCase(),
      status: ticket.status.toLowerCase(),
      createdAt: ticket.createdAt,
    };
  }

  async listForUser(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category.toLowerCase(),
      status: ticket.status.toLowerCase(),
      createdAt: ticket.createdAt,
    }));
  }
}
