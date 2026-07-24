import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import slugify from 'slugify';
import Mailjet from 'node-mailjet';
import { EventStatus, OrderStatus } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto, UpdateEventStatusDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { EventApprovedEmail } from 'emails/event-approved-email';
import { EventRejectedEmail } from 'emails/event-rejected-email';
import { EventCancelledEmail } from 'emails/event-cancelled-email';

function getMailjet() {
  return Mailjet.apiConnect(
    process.env.MAILJET_API_PUBLIC_KEY!,
    process.env.MAILJET_API_PRIVATE_KEY!,
  );
}

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    let base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.event.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) break;
      slug = `${base}-${counter++}`;
    }

    return slug;
  }

  private async createEvent(
    dto: CreateEventDto,
    userId: string,
    status: EventStatus,
    // Only admins set the platform fee; vendor submissions fall back to the default
    allowServiceFee: boolean,
  ) {
    const slug = await this.generateUniqueSlug(dto.title);

    return this.prisma.event.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        category: dto.category,
        coverImage: dto.coverImage,
        date: new Date(dto.date),
        doorsOpen: dto.doorsOpen,
        venueName: dto.venueName,
        venueAddress: dto.venueAddress,
        city: dto.city,
        dressCode: dto.dressCode,
        isMemberOnly: dto.isMemberOnly ?? false,
        ...(allowServiceFee &&
          dto.serviceFee !== undefined && { serviceFee: dto.serviceFee }),
        createdById: userId,
        status,
        ticketTiers: {
          create: dto.ticketTiers.map((tier) => ({
            name: tier.name,
            description: tier.description,
            price: tier.price,
            quantity: tier.quantity,
          })),
        },
      },
      include: { ticketTiers: true },
    });
  }

  async create(dto: CreateEventDto, adminUserId: string) {
    return this.createEvent(dto, adminUserId, EventStatus.DRAFT, true);
  }

  async createByVendor(dto: CreateEventDto, vendorId: string) {
    return this.createEvent(dto, vendorId, EventStatus.PENDING_REVIEW, false);
  }

  // Admin: all events, any status
  async findAllAdmin(query: EventQueryDto) {
    const { search, category, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { venueName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (status) where.status = status;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          ticketTiers: true,
          createdBy: { select: { firstName: true, lastName: true, role: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    // Attach computed stats
    const eventsWithStats = events.map((e) => {
      const totalCapacity = e.ticketTiers.reduce((s, t) => s + t.quantity, 0);
      const totalSold = e.ticketTiers.reduce((s, t) => s + t.sold, 0);
      const totalRevenue = e.ticketTiers.reduce(
        (s, t) => s + t.sold * t.price,
        0,
      );
      return { ...e, totalCapacity, totalSold, totalRevenue };
    });

    return {
      data: eventsWithStats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Public: only LIVE events
  async findPublished(query: EventQueryDto) {
    const { search, category, sortBy, dateFrom, dateTo, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { status: EventStatus.LIVE };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { venueName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const orderBy = sortBy === 'date_desc' ? { date: 'desc' as const } : { date: 'asc' as const };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: { ticketTiers: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { ticketTiers: true },
    });

    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async findById(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        ticketTiers: true,
        orders: {
          where: { status: 'PAID' },
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            items: { include: { ticketTier: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { orders: true } },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    const totalCapacity = event.ticketTiers.reduce((s, t) => s + t.quantity, 0);
    const totalSold = event.ticketTiers.reduce((s, t) => s + t.sold, 0);
    const totalRevenue = event.ticketTiers.reduce(
      (s, t) => s + t.sold * t.price,
      0,
    );

    return { ...event, totalCapacity, totalSold, totalRevenue };
  }

  async update(id: string, dto: UpdateEventDto, allowServiceFee = true) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');

    let slug = existing.slug;
    if (dto.title && dto.title !== existing.title) {
      slug = await this.generateUniqueSlug(dto.title, id);
    }

    // If ticketTiers are provided, replace them
    const updateData: any = {
      ...(dto.title && { title: dto.title, slug }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.category && { category: dto.category }),
      ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
      ...(dto.date && { date: new Date(dto.date) }),
      ...(dto.doorsOpen && { doorsOpen: dto.doorsOpen }),
      ...(dto.venueName && { venueName: dto.venueName }),
      ...(dto.venueAddress !== undefined && { venueAddress: dto.venueAddress }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.dressCode !== undefined && { dressCode: dto.dressCode }),
      ...(dto.isMemberOnly !== undefined && { isMemberOnly: dto.isMemberOnly }),
      ...(allowServiceFee &&
        dto.serviceFee !== undefined && { serviceFee: dto.serviceFee }),
    };

    if (dto.ticketTiers) {
      // Fetch existing tiers so we know which have sold tickets
      const existingTiers = await this.prisma.ticketTier.findMany({
        where: { eventId: id },
        select: { id: true, sold: true },
      });

      const submittedIdSet = new Set(
        dto.ticketTiers.filter((t) => t.id).map((t) => t.id),
      );

      // Delete only tiers not in the submitted list that have no sold tickets
      const toDelete = existingTiers
        .filter((t) => !submittedIdSet.has(t.id) && t.sold === 0)
        .map((t) => t.id);

      if (toDelete.length > 0) {
        await this.prisma.ticketTier.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Upsert each submitted tier
      for (const tier of dto.ticketTiers) {
        if (tier.id) {
          // Update existing tier; don't allow quantity to drop below sold count
          const existing = existingTiers.find((t) => t.id === tier.id);
          await this.prisma.ticketTier.update({
            where: { id: tier.id },
            data: {
              name: tier.name,
              description: tier.description,
              price: tier.price,
              quantity: existing
                ? Math.max(tier.quantity, existing.sold)
                : tier.quantity,
            },
          });
        } else {
          // Brand-new tier
          await this.prisma.ticketTier.create({
            data: {
              eventId: id,
              name: tier.name,
              description: tier.description,
              price: tier.price,
              quantity: tier.quantity,
            },
          });
        }
      }
    }

    return this.prisma.event.update({
      where: { id },
      data: updateData,
      include: { ticketTiers: true },
    });
  }

  async updateStatus(id: string, dto: UpdateEventStatusDto) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: dto.status },
    });

    // Only on the transition into CANCELLED, so re-saving a cancelled event
    // never mails ticket holders twice.
    if (
      dto.status === EventStatus.CANCELLED &&
      existing.status !== EventStatus.CANCELLED
    ) {
      await this.notifyTicketHoldersOfCancellation(id);
    }

    return updated;
  }

  async delete(id: string) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) throw new NotFoundException('Event not found');

    // If it has paid orders, cancel instead of deleting
    if (existing._count.orders > 0) {
      const cancelled = await this.prisma.event.update({
        where: { id },
        data: { status: EventStatus.CANCELLED },
      });

      if (existing.status !== EventStatus.CANCELLED) {
        await this.notifyTicketHoldersOfCancellation(id);
      }

      return cancelled;
    }

    return this.prisma.event.delete({ where: { id } });
  }

  // Tells everyone holding a paid ticket that the event is off. Never throws —
  // the cancellation itself has already been committed by the time this runs.
  private async notifyTicketHoldersOfCancellation(eventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          orders: {
            where: { status: OrderStatus.PAID },
            include: {
              user: true,
              items: true,
            },
          },
        },
      });
      if (!event || event.orders.length === 0) return;

      const eventDate = event.date.toLocaleDateString('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const messages = event.orders.map((order) => {
        const ticketCount = order.items.reduce((s, i) => s + i.quantity, 0);
        // Face value only — service fees are non-refundable per the policy
        const refundAmount = (order.subtotal / 100).toLocaleString('en-NG', {
          style: 'currency',
          currency: 'NGN',
        });

        return {
          From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: 'Ekovibe' },
          To: [{ Email: order.user.email, Name: order.user.firstName }],
          Subject: `Cancelled — ${event.title}`,
          HTMLPart: EventCancelledEmail({
            firstName: order.user.firstName,
            eventTitle: event.title,
            eventDate,
            venueName: event.venueName,
            orderReference: order.reference,
            ticketCount,
            refundAmount,
            eventImageUrl: event.coverImage ?? undefined,
          }),
        };
      });

      // Mailjet caps a v3.1 send at 50 messages per request
      for (let i = 0; i < messages.length; i += 50) {
        const batch = messages.slice(i, i + 50);
        try {
          await getMailjet()
            .post('send', { version: 'v3.1' })
            .request({ Messages: batch });
        } catch (e) {
          console.error(
            `Failed to send cancellation batch ${i / 50 + 1} for event ${eventId}:`,
            e,
          );
        }
      }
    } catch (e) {
      console.error(
        `Failed to notify ticket holders of cancellation for event ${eventId}:`,
        e,
      );
    }
  }

  // ── Vendor-scoped methods ─────────────────────────────────────────────────

  async findVendorEvents(vendorId: string, query: EventQueryDto) {
    const { search, category, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { createdById: vendorId };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { venueName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (status) where.status = status;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          ticketTiers: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    const eventsWithStats = events.map((e) => {
      const totalCapacity = e.ticketTiers.reduce((s, t) => s + t.quantity, 0);
      const totalSold = e.ticketTiers.reduce((s, t) => s + t.sold, 0);
      const totalRevenue = e.ticketTiers.reduce(
        (s, t) => s + t.sold * t.price,
        0,
      );
      return { ...e, totalCapacity, totalSold, totalRevenue };
    });

    return {
      data: eventsWithStats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findVendorEventById(id: string, vendorId: string) {
    const event = await this.findById(id);
    if (event.createdById !== vendorId)
      throw new ForbiddenException('Access denied');
    return event;
  }

  async approveEvent(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { createdBy: { select: { firstName: true, email: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.LIVE, rejectionReason: null },
    });
    try {
      await getMailjet()
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: 'Ekovibe' },
              To: [{ Email: event.createdBy.email, Name: event.createdBy.firstName }],
              Subject: `Your event is live — ${event.title}`,
              HTMLPart: EventApprovedEmail({
                firstName: event.createdBy.firstName,
                eventTitle: event.title,
                eventDate: event.date.toLocaleDateString('en-NG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
                venueName: event.venueName,
                eventImageUrl: event.coverImage ?? undefined,
              }),
            },
          ],
        });
    } catch {
      // Email failure should not block the approval response
    }
    return updated;
  }

  async rejectEvent(id: string, reason: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { createdBy: { select: { firstName: true, email: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.REJECTED, rejectionReason: reason },
    });
    try {
      await getMailjet()
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: 'Ekovibe' },
              To: [{ Email: event.createdBy.email, Name: event.createdBy.firstName }],
              Subject: `Event review update — ${event.title}`,
              HTMLPart: EventRejectedEmail({
                firstName: event.createdBy.firstName,
                eventTitle: event.title,
                reason,
                eventImageUrl: event.coverImage ?? undefined,
              }),
            },
          ],
        });
    } catch {
      // Email failure should not block the rejection response
    }
    return updated;
  }

  async resubmitByVendor(id: string, vendorId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== vendorId) throw new ForbiddenException('Access denied');
    if (event.status !== EventStatus.REJECTED)
      throw new ForbiddenException('Only rejected events can be resubmitted');
    return this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.PENDING_REVIEW, rejectionReason: null },
    });
  }

  async updateByVendor(id: string, vendorId: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    if (existing.createdById !== vendorId)
      throw new ForbiddenException('Access denied');
    const updated = await this.update(id, dto, false);
    // Auto-resubmit for review when a rejected event is edited
    if (existing.status === EventStatus.REJECTED) {
      return this.prisma.event.update({
        where: { id },
        data: { status: EventStatus.PENDING_REVIEW, rejectionReason: null },
        include: { ticketTiers: true },
      });
    }
    return updated;
  }

  async updateStatusByVendor(
    id: string,
    vendorId: string,
    dto: UpdateEventStatusDto,
  ) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    if (existing.createdById !== vendorId)
      throw new ForbiddenException('Access denied');
    return this.updateStatus(id, dto);
  }

  async deleteByVendor(id: string, vendorId: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    if (existing.createdById !== vendorId)
      throw new ForbiddenException('Access denied');
    return this.delete(id);
  }

  async getVendorStats(vendorId: string) {
    const [totalEvents, liveEvents, ticketStats, revenueStats] =
      await Promise.all([
        this.prisma.event.count({ where: { createdById: vendorId } }),
        this.prisma.event.count({
          where: { createdById: vendorId, status: EventStatus.LIVE },
        }),
        this.prisma.ticketTier.aggregate({
          where: { event: { createdById: vendorId } },
          _sum: { sold: true },
        }),
        this.prisma.order.aggregate({
          where: { status: 'PAID', event: { createdById: vendorId } },
          _sum: { total: true },
          _count: true,
        }),
      ]);

    return {
      totalEvents,
      liveEvents,
      totalTicketsSold: ticketStats._sum.sold ?? 0,
      totalRevenue: revenueStats._sum.total ?? 0,
      totalOrders: revenueStats._count,
    };
  }

  async getAdminStats() {
    const [totalEvents, liveEvents, ticketStats, recentOrders, pendingReview] =
      await Promise.all([
        this.prisma.event.count(),
        this.prisma.event.count({ where: { status: EventStatus.LIVE } }),
        this.prisma.ticketTier.aggregate({
          _sum: { sold: true },
        }),
        this.prisma.order.aggregate({
          where: { status: 'PAID' },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.event.count({ where: { status: EventStatus.PENDING_REVIEW } }),
      ]);

    return {
      totalEvents,
      liveEvents,
      totalTicketsSold: ticketStats._sum.sold ?? 0,
      totalRevenue: recentOrders._sum.total ?? 0, // in kobo
      totalOrders: recentOrders._count,
      pendingReviewCount: pendingReview,
    };
  }
}
