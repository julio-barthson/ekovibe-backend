import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import Mailjet from 'node-mailjet';
import {
  EventStatus,
  GuestRsvpStatus,
  OrderStatus,
} from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { InitiateOrderDto } from './dto/initiate-order.dto';
import { VerifyOrderDto } from './dto/verify-order.dto';
import { BookingConfirmationEmail } from 'emails/booking-confirmation-email';
import { OrderFailedEmail } from 'emails/order-failed-email';
import { EntryConfirmedEmail } from 'emails/entry-confirmed-email';

function getMailjet() {
  return Mailjet.apiConnect(
    process.env.MAILJET_API_PUBLIC_KEY!,
    process.env.MAILJET_API_PRIVATE_KEY!,
  );
}

// Unambiguous charset — no 0/O, 1/I/L to avoid scanning confusion
const TICKET_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateTicketCode(eventTitle: string): string {
  const abbrev = eventTitle
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .slice(0, 4)
    .join('');

  let random = '';
  for (let i = 0; i < 6; i++) {
    random += TICKET_CHARSET[Math.floor(Math.random() * TICKET_CHARSET.length)];
  }

  return `${abbrev}-${random}`;
}

// Fallback only — the per-ticket fee is set per event (Event.serviceFee, kobo)
const DEFAULT_SERVICE_FEE_PER_TICKET = 30000; // ₦300 in kobo

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private paystack: PaystackService,
  ) {}

  async initiateOrder(
    userId: string,
    dto: InitiateOrderDto,
    userEmail: string,
  ) {
    // Validate event exists and is live
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.LIVE) {
      throw new BadRequestException('This event is not currently available');
    }

    // Member-only gate — check user has an active membership tier
    if (event.isMemberOnly) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { userTier: true },
      });
      if (!user?.userTier) {
        throw new ForbiddenException(
          'This event is exclusive to Ekovibe members',
        );
      }
    }

    // Validate all requested tiers and check stock
    const tiers = await this.prisma.ticketTier.findMany({
      where: { id: { in: dto.items.map((i) => i.tierId) } },
    });

    for (const item of dto.items) {
      const tier = tiers.find((t) => t.id === item.tierId);
      if (!tier || tier.eventId !== dto.eventId) {
        throw new NotFoundException(`Ticket tier ${item.tierId} not found`);
      }
      const available = tier.quantity - tier.sold;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Only ${available} ticket(s) remaining for "${tier.name}"`,
        );
      }
    }

    // Calculate pricing (all in kobo)
    const totalTickets = dto.items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = dto.items.reduce((s, item) => {
      const tier = tiers.find((t) => t.id === item.tierId)!;
      return s + tier.price * item.quantity;
    }, 0);
    const feePerTicket = event.serviceFee ?? DEFAULT_SERVICE_FEE_PER_TICKET;
    const serviceFee = feePerTicket * totalTickets;
    const total = subtotal + serviceFee;

    // Generate unique order reference (no uuid dependency)
    const randPart = Math.random().toString(36).slice(2, 7).toUpperCase();
    const reference = `EKV-${Date.now()}-${randPart}`;

    // Create pending order with all items
    const order = await this.prisma.order.create({
      data: {
        reference,
        userId,
        eventId: dto.eventId,
        status: OrderStatus.PENDING,
        subtotal,
        serviceFee,
        total,
        items: {
          create: dto.items.map((item) => {
            const tier = tiers.find((t) => t.id === item.tierId)!;
            return {
              ticketTierId: item.tierId,
              quantity: item.quantity,
              unitPrice: tier.price,
            };
          }),
        },
      },
      include: { items: true },
    });

    // Initialize Paystack transaction
    const paystack = await this.paystack.initializeTransaction({
      email: userEmail,
      amount: total,
      reference,
      metadata: { orderId: order.id, eventId: dto.eventId, userId },
    });

    return {
      orderId: order.id,
      reference,
      authorizationUrl: paystack.authorization_url,
      accessCode: paystack.access_code,
      total,
      subtotal,
      serviceFee,
    };
  }

  async verifyAndFulfillOrder(dto: VerifyOrderDto, userId: string) {
    // Find the pending order
    const order = await this.prisma.order.findUnique({
      where: { reference: dto.reference },
      include: {
        items: { include: { ticketTier: true } },
        event: true,
        user: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Access denied');

    // Already fulfilled
    if (order.status === OrderStatus.PAID) {
      const tickets = await this.prisma.ticket.findMany({
        where: { orderId: order.id },
        include: { orderItem: { include: { ticketTier: true } } },
      });
      return { order, tickets };
    }

    // Verify with Paystack
    const paystackData = await this.paystack.verifyTransaction(dto.reference);

    if (paystackData.status !== 'success') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FAILED, paystackData: paystackData as any },
      });
      // Notify user of failed payment
      try {
        await getMailjet()
          .post('send', { version: 'v3.1' })
          .request({
            Messages: [
              {
                From: {
                  Email: process.env.SENDER_EMAIL_ADDRESS,
                  Name: 'Ekovibe',
                },
                To: [{ Email: order.user.email, Name: order.user.firstName }],
                Subject: `Payment Failed — ${order.event.title}`,
                HTMLPart: OrderFailedEmail({
                  firstName: order.user.firstName,
                  eventTitle: order.event.title,
                  orderReference: order.reference,
                  eventImageUrl: order.event.coverImage ?? undefined,
                }),
              },
            ],
          });
      } catch {
        // Email failure should not change the error response
      }
      throw new BadRequestException('Payment was not successful');
    }

    // Confirm amount matches (Paystack returns amount in kobo)
    if (paystackData.amount !== order.total) {
      throw new BadRequestException('Payment amount mismatch');
    }

    // Issue tickets (one per quantity per tier)
    const ticketData: {
      code: string;
      orderId: string;
      orderItemId: string;
      userId: string;
    }[] = [];
    for (const item of order.items) {
      for (let i = 0; i < item.quantity; i++) {
        ticketData.push({
          code: generateTicketCode(order.event.title),
          orderId: order.id,
          orderItemId: item.id,
          userId,
        });
      }
    }

    // Fulfill in a single transaction: update order, increment sold, create tickets, credit vendor wallet
    const vendorId = order.event.createdById;
    const [updatedOrder, tickets] = await this.prisma.$transaction(
      async (tx) => {
        // 1. Mark order as paid
        const paid = await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            paystackReference: paystackData.reference,
            paystackData: paystackData as any,
          },
        });

        // 2. Increment sold count for each tier
        await Promise.all(
          order.items.map((item) =>
            tx.ticketTier.update({
              where: { id: item.ticketTierId },
              data: { sold: { increment: item.quantity } },
            }),
          ),
        );

        // 3. Issue tickets
        await tx.ticket.createMany({ data: ticketData });
        const issued = await tx.ticket.findMany({
          where: { orderId: order.id },
          include: { orderItem: { include: { ticketTier: true } } },
        });

        // 4. Credit vendor wallet — inside the transaction so wallet credit
        //    only happens if the entire fulfillment succeeds, and never twice.
        await tx.vendorWallet.upsert({
          where: { vendorId },
          create: { vendorId, balance: order.subtotal },
          update: { balance: { increment: order.subtotal } },
        });

        return [paid, issued] as const;
      },
    );

    // Check if event is now sold out
    await this.checkAndUpdateSoldOutStatus(order.eventId);

    // Fetch created tickets
    const createdTickets = await this.prisma.ticket.findMany({
      where: { orderId: order.id },
      include: {
        orderItem: { include: { ticketTier: true } },
      },
    });

    // Send confirmation email
    try {
      await getMailjet()
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.SENDER_EMAIL_ADDRESS,
                Name: 'Ekovibe',
              },
              To: [{ Email: order.user.email, Name: order.user.firstName }],
              Subject: `Your Tickets: ${order.event.title}`,
              HTMLPart: BookingConfirmationEmail({
                firstName: order.user.firstName,
                eventTitle: order.event.title,
                eventDate: order.event.date.toLocaleDateString('en-NG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }),
                venueName: order.event.venueName,
                orderReference: order.reference,
                tickets: createdTickets.map((t) => ({
                  code: t.code,
                  tierName: t.orderItem.ticketTier.name,
                })),
                eventImageUrl: order.event.coverImage ?? undefined,
              }),
            },
          ],
        });
    } catch (e) {
      // Email failure should not block ticket delivery
      console.error('Failed to send booking email:', e);
    }

    return { order: updatedOrder, tickets: createdTickets };
  }

  private async checkAndUpdateSoldOutStatus(eventId: string) {
    const tiers = await this.prisma.ticketTier.findMany({
      where: { eventId },
    });
    const allSoldOut = tiers.every((t) => t.sold >= t.quantity);
    if (allSoldOut) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { status: EventStatus.SOLD_OUT },
      });
    }
  }

  async getUserTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      include: {
        order: {
          include: {
            event: {
              select: {
                title: true,
                slug: true,
                date: true,
                doorsOpen: true,
                venueName: true,
                venueAddress: true,
                coverImage: true,
                category: true,
              },
            },
          },
        },
        orderItem: {
          include: { ticketTier: { select: { name: true, price: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserTicketByCode(code: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { code },
      include: {
        order: {
          include: {
            event: true,
          },
        },
        orderItem: { include: { ticketTier: true } },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException('Access denied');
    return ticket;
  }

  async getTicketByCode(code: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { code },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        order: { include: { event: true } },
        orderItem: { include: { ticketTier: true } },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async scanTicket(code: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { code },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        order: {
          include: { event: { select: { title: true, coverImage: true } } },
        },
        orderItem: { include: { ticketTier: { select: { name: true } } } },
      },
    });

    // Fall through to guest QR check if no regular ticket found
    if (!ticket) return this.scanGuestQR(code);
    if (ticket.isUsed) {
      return {
        valid: false,
        reason: 'ALREADY_USED',
        usedAt: ticket.usedAt,
        holder: `${ticket.user.firstName} ${ticket.user.lastName}`,
        tier: ticket.orderItem.ticketTier.name,
        event: ticket.order.event.title,
      };
    }

    const usedAt = new Date();

    // Mark as used
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { isUsed: true, usedAt },
    });

    // Send entry confirmed email
    try {
      await getMailjet()
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.SENDER_EMAIL_ADDRESS,
                Name: 'Ekovibe',
              },
              To: [
                {
                  Email: ticket.user.email,
                  Name: ticket.user.firstName,
                },
              ],
              Subject: `Entry Confirmed — ${ticket.order.event.title}`,
              HTMLPart: EntryConfirmedEmail({
                firstName: ticket.user.firstName,
                eventTitle: ticket.order.event.title,
                tierName: ticket.orderItem.ticketTier.name,
                ticketCode: ticket.code,
                scannedAt: usedAt.toLocaleString('en-NG', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                eventImageUrl: ticket.order.event.coverImage ?? undefined,
              }),
            },
          ],
        });
    } catch {
      // Email failure should not block scan response
    }

    return {
      valid: true,
      holder: `${ticket.user.firstName} ${ticket.user.lastName}`,
      tier: ticket.orderItem.ticketTier.name,
      event: ticket.order.event.title,
    };
  }

  private async scanGuestQR(qrCode: string) {
    const guest = await this.prisma.guestInvitation.findUnique({
      where: { qrCode },
      include: { event: { select: { title: true } } },
    });

    if (!guest || guest.status !== GuestRsvpStatus.CONFIRMED) {
      throw new NotFoundException('Invalid ticket code');
    }

    const tier = `Guest${guest.tableNumber ? ` — Table ${guest.tableNumber}` : ''}`;

    if (guest.isCheckedIn) {
      return {
        valid: false,
        reason: 'ALREADY_USED',
        usedAt: guest.checkedInAt,
        holder: guest.guestName,
        tier,
        event: guest.event.title,
      };
    }

    await this.prisma.guestInvitation.update({
      where: { id: guest.id },
      data: { isCheckedIn: true, checkedInAt: new Date() },
    });

    return {
      valid: true,
      holder: guest.guestName,
      tier,
      event: guest.event.title,
    };
  }

  // ── Vendor attendee list ──────────────────────────────────────────────────

  async getVendorEventAttendees(eventId: string, vendorId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { createdById: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.createdById !== vendorId)
      throw new ForbiddenException('Access denied');

    const tickets = await this.prisma.ticket.findMany({
      where: { order: { eventId } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        orderItem: { include: { ticketTier: { select: { name: true } } } },
        order: { select: { reference: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const checkedIn = tickets.filter((t) => t.isUsed).length;

    return {
      total: tickets.length,
      checkedIn,
      tickets: tickets.map((t) => ({
        id: t.id,
        code: t.code,
        holder: `${t.user.firstName} ${t.user.lastName}`,
        email: t.user.email,
        tier: t.orderItem.ticketTier.name,
        isUsed: t.isUsed,
        usedAt: t.usedAt,
        orderRef: t.order.reference,
      })),
    };
  }

  // ── Vendor ticket methods ─────────────────────────────────────────────────

  async getVendorTicketByCode(code: string, vendorId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { code },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        order: { include: { event: true } },
        orderItem: { include: { ticketTier: true } },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.order.event.createdById !== vendorId)
      throw new ForbiddenException('Access denied');
    return ticket;
  }

  async scanVendorTicket(code: string, vendorId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { code },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        order: {
          include: {
            event: {
              select: { title: true, createdById: true, coverImage: true },
            },
          },
        },
        orderItem: { include: { ticketTier: { select: { name: true } } } },
      },
    });

    if (!ticket) throw new NotFoundException('Invalid ticket code');
    if (ticket.order.event.createdById !== vendorId)
      throw new ForbiddenException('Access denied');

    if (ticket.isUsed) {
      return {
        valid: false,
        reason: 'ALREADY_USED',
        usedAt: ticket.usedAt,
        holder: `${ticket.user.firstName} ${ticket.user.lastName}`,
        tier: ticket.orderItem.ticketTier.name,
        event: ticket.order.event.title,
      };
    }

    const usedAt = new Date();
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { isUsed: true, usedAt },
    });

    try {
      await getMailjet()
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.SENDER_EMAIL_ADDRESS,
                Name: 'Ekovibe',
              },
              To: [{ Email: ticket.user.email, Name: ticket.user.firstName }],
              Subject: `Entry Confirmed — ${ticket.order.event.title}`,
              HTMLPart: EntryConfirmedEmail({
                firstName: ticket.user.firstName,
                eventTitle: ticket.order.event.title,
                tierName: ticket.orderItem.ticketTier.name,
                ticketCode: ticket.code,
                scannedAt: usedAt.toLocaleString('en-NG', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                eventImageUrl: ticket.order.event.coverImage ?? undefined,
              }),
            },
          ],
        });
    } catch {
      // Email failure should not block scan response
    }

    return {
      valid: true,
      holder: `${ticket.user.firstName} ${ticket.user.lastName}`,
      tier: ticket.orderItem.ticketTier.name,
      event: ticket.order.event.title,
    };
  }

  async getAdminOrders(query: {
    page?: number;
    limit?: number;
    eventId?: string;
  }) {
    const { page = 1, limit = 20, eventId } = query;
    const skip = (page - 1) * limit;
    const where: any = { status: OrderStatus.PAID };
    if (eventId) where.eventId = eventId;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          event: { select: { title: true, date: true } },
          items: { include: { ticketTier: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
