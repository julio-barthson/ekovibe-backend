import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SettlementStatus } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  async generate(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        orders: {
          where: { status: 'PAID' },
          include: { items: true },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.eventSettlement.findUnique({ where: { eventId } });
    if (existing?.status === SettlementStatus.PAID) {
      throw new BadRequestException('Settlement has already been marked as paid');
    }

    let ticketCount = 0;
    let totalRevenue = 0;
    // Commission is the service fee actually collected on each order, so it
    // always matches what the buyer was charged for this event.
    let ekovibeCommission = 0;

    for (const order of event.orders) {
      totalRevenue += order.total;
      ekovibeCommission += order.serviceFee;
      for (const item of order.items) {
        ticketCount += item.quantity;
      }
    }

    const netAmount = Math.max(totalRevenue - ekovibeCommission, 0);

    const settlement = await this.prisma.eventSettlement.upsert({
      where: { eventId },
      create: { eventId, totalRevenue, ekovibeCommission, netAmount, ticketCount },
      update: { totalRevenue, ekovibeCommission, netAmount, ticketCount, status: SettlementStatus.PENDING },
    });

    return settlement;
  }

  async getAll(query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && Object.values(SettlementStatus).includes(status as SettlementStatus)) {
      where.status = status as SettlementStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.eventSettlement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { event: { select: { title: true, date: true, slug: true } } },
      }),
      this.prisma.eventSettlement.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getByEvent(eventId: string) {
    const settlement = await this.prisma.eventSettlement.findUnique({
      where: { eventId },
      include: { event: { select: { title: true, date: true, slug: true } } },
    });
    if (!settlement) throw new NotFoundException('No settlement found for this event');
    return settlement;
  }

  async markPaid(eventId: string, dto: { accountName?: string; accountNumber?: string; bankName?: string; notes?: string }) {
    const settlement = await this.prisma.eventSettlement.findUnique({ where: { eventId } });
    if (!settlement) throw new NotFoundException('Settlement not found — generate it first');
    if (settlement.status === SettlementStatus.PAID) {
      throw new BadRequestException('Already marked as paid');
    }

    return this.prisma.eventSettlement.update({
      where: { eventId },
      data: {
        status: SettlementStatus.PAID,
        paidAt: new Date(),
        accountName: dto.accountName ?? settlement.accountName,
        accountNumber: dto.accountNumber ?? settlement.accountNumber,
        bankName: dto.bankName ?? settlement.bankName,
        notes: dto.notes ?? settlement.notes,
      },
    });
  }

  async updateBankDetails(eventId: string, dto: { accountName?: string; accountNumber?: string; bankName?: string; notes?: string }) {
    const settlement = await this.prisma.eventSettlement.findUnique({ where: { eventId } });
    if (!settlement) throw new NotFoundException('Settlement not found — generate it first');

    return this.prisma.eventSettlement.update({
      where: { eventId },
      data: {
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName,
        notes: dto.notes,
      },
    });
  }
}
