import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async upsert(data: { email: string; name: string; phone: string; eventTitle: string }) {
    const existing = await this.prisma.guestContact.findUnique({ where: { email: data.email } });

    return this.prisma.guestContact.upsert({
      where: { email: data.email },
      create: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        totalEvents: 1,
        lastEventTitle: data.eventTitle,
        lastSeenAt: new Date(),
      },
      update: {
        name: data.name,
        phone: data.phone,
        totalEvents: { increment: 1 },
        lastEventTitle: data.eventTitle,
        lastSeenAt: new Date(),
      },
    });
  }

  async getAll(query: { page?: number; limit?: number; search?: string; tag?: string }) {
    const { page = 1, limit = 50, search, tag } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    if (tag) {
      where.tags = { has: tag };
    }

    const [data, total] = await Promise.all([
      this.prisma.guestContact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
      }),
      this.prisma.guestContact.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async update(id: string, dto: { tags?: string[]; notes?: string; name?: string; phone?: string }) {
    const contact = await this.prisma.guestContact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return this.prisma.guestContact.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const contact = await this.prisma.guestContact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    await this.prisma.guestContact.delete({ where: { id } });
    return { message: 'Contact removed' };
  }

  async importToEvent(eventId: string, contactIds: string[]) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const contacts = await this.prisma.guestContact.findMany({
      where: { id: { in: contactIds } },
    });

    let imported = 0;
    let duplicates = 0;

    for (const c of contacts) {
      const exists = await this.prisma.guestInvitation.findUnique({
        where: { eventId_guestEmail: { eventId, guestEmail: c.email } },
      });
      if (exists) { duplicates++; continue; }

      await this.prisma.guestInvitation.create({
        data: {
          eventId,
          token: crypto.randomUUID(),
          guestName: c.name,
          guestEmail: c.email,
          guestPhone: c.phone,
        },
      });
      imported++;
    }

    return { imported, duplicates };
  }

  async exportCsv(): Promise<string> {
    const contacts = await this.prisma.guestContact.findMany({
      orderBy: { lastSeenAt: 'desc' },
    });

    const rows = [
      'Name,Email,Phone,Tags,Events Attended,Last Event,Last Seen',
      ...contacts.map((c) =>
        [
          `"${c.name}"`,
          c.email,
          c.phone,
          `"${c.tags.join(';')}"`,
          c.totalEvents,
          c.lastEventTitle ? `"${c.lastEventTitle}"` : '',
          c.lastSeenAt ? new Date(c.lastSeenAt).toISOString().slice(0, 10) : '',
        ].join(','),
      ),
    ];

    return rows.join('\n');
  }
}
