import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Mailjet from 'node-mailjet';
import { GuestRsvpStatus, RequestStatus } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContactsService } from 'src/contacts/contacts.service';
import { ImportGuestsDto } from './dto/import-guests.dto';
import { SubmitRsvpDto } from './dto/submit-rsvp.dto';
import { AddGuestDto } from './dto/add-guest.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SubmitRequestDto } from './dto/submit-request.dto';
import { TermiiService } from './termii.service';
import { GuestInvitationEmail } from 'emails/guest-invitation-email';
import { GuestRsvpConfirmationEmail } from 'emails/guest-rsvp-confirmation-email';
import { GuestPostEventEmail } from 'emails/guest-post-event-email';
import { GuestRequestDeclinedEmail } from 'emails/guest-request-declined-email';

function getMailjet() {
  return Mailjet.apiConnect(
    process.env.MAILJET_API_PUBLIC_KEY!,
    process.env.MAILJET_API_PRIVATE_KEY!,
  );
}

const QR_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateGuestQR(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += QR_CHARSET[Math.floor(Math.random() * QR_CHARSET.length)];
  return `EKG-${s}`;
}

function formatEventDate(date: Date): string {
  return date.toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function chunkProcess<T>(
  items: T[],
  size: number,
  fn: (chunk: T[]) => Promise<void>,
  delayMs = 1000,
) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
    if (i + size < items.length) await delay(delayMs);
  }
}

function senderName(config: { inviteFromName?: string | null } | null): string {
  return config?.inviteFromName || 'Ekovibe';
}

@Injectable()
export class GuestsService {
  private readonly logger = new Logger(GuestsService.name);

  constructor(
    private prisma: PrismaService,
    private termii: TermiiService,
    private contacts: ContactsService,
  ) {}

  // ── Config ──────────────────────────────────────────────────────────────────

  async getConfig(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const config = await this.prisma.guestEventConfig.findUnique({ where: { eventId } });
    return config ?? {
      eventId, rsvpDeadline: null, customMessage: null, capacity: null,
      photoGalleryUrl: null, followUpMessage: null,
      accentColor: null, inviteHeaderImageUrl: null, inviteFromName: null,
      allowRequests: false,
    };
  }

  async updateConfig(eventId: string, dto: UpdateConfigDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.guestEventConfig.upsert({
      where: { eventId },
      create: {
        eventId,
        rsvpDeadline: dto.rsvpDeadline ? new Date(dto.rsvpDeadline) : null,
        customMessage: dto.customMessage ?? null,
        capacity: dto.capacity ?? null,
        photoGalleryUrl: dto.photoGalleryUrl ?? null,
        followUpMessage: dto.followUpMessage ?? null,
        accentColor: dto.accentColor ?? null,
        inviteHeaderImageUrl: dto.inviteHeaderImageUrl ?? null,
        inviteFromName: dto.inviteFromName ?? null,
        allowRequests: dto.allowRequests ?? false,
      },
      update: {
        ...(dto.rsvpDeadline !== undefined && { rsvpDeadline: new Date(dto.rsvpDeadline) }),
        ...(dto.customMessage !== undefined && { customMessage: dto.customMessage }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.photoGalleryUrl !== undefined && { photoGalleryUrl: dto.photoGalleryUrl }),
        ...(dto.followUpMessage !== undefined && { followUpMessage: dto.followUpMessage }),
        ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
        ...(dto.inviteHeaderImageUrl !== undefined && { inviteHeaderImageUrl: dto.inviteHeaderImageUrl }),
        ...(dto.inviteFromName !== undefined && { inviteFromName: dto.inviteFromName }),
        ...(dto.allowRequests !== undefined && { allowRequests: dto.allowRequests }),
      },
    });
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async importGuests(dto: ImportGuestsDto) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const skippedReasons: string[] = [];
    const valid: { name: string; email: string; phone: string; tableNumber?: string }[] = [];

    for (const g of dto.guests) {
      const name = g.name?.trim();
      const email = g.email?.toLowerCase().trim();
      const phone = g.phone?.trim();

      if (!name) { skippedReasons.push(`Row with email "${g.email}" — missing name`); continue; }
      if (!email || !email.includes('@')) { skippedReasons.push(`"${g.name}" — invalid email`); continue; }
      if (!phone) { skippedReasons.push(`"${g.name}" — missing phone`); continue; }
      valid.push({ name, email, phone, tableNumber: g.tableNumber?.trim() || undefined });
    }

    if (!valid.length) {
      return { imported: 0, duplicates: 0, skipped: skippedReasons.length, skippedReasons };
    }

    const data = valid.map((g) => ({
      eventId: dto.eventId,
      token: crypto.randomUUID(),
      guestName: g.name,
      guestEmail: g.email,
      guestPhone: g.phone,
      tableNumber: g.tableNumber ?? null,
    }));

    const result = await this.prisma.guestInvitation.createMany({ data, skipDuplicates: true });
    const duplicates = valid.length - result.count;

    return { imported: result.count, duplicates, skipped: skippedReasons.length, skippedReasons };
  }

  async addGuest(dto: AddGuestDto) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.guestInvitation.findUnique({
      where: { eventId_guestEmail: { eventId: dto.eventId, guestEmail: dto.email.toLowerCase().trim() } },
    });
    if (existing) throw new BadRequestException('This guest is already on the list');

    return this.prisma.guestInvitation.create({
      data: {
        eventId: dto.eventId,
        token: crypto.randomUUID(),
        guestName: dto.name.trim(),
        guestEmail: dto.email.toLowerCase().trim(),
        guestPhone: dto.phone.trim(),
        tableNumber: dto.tableNumber?.trim() ?? null,
      },
    });
  }

  async sendInvites(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const config = await this.prisma.guestEventConfig.findUnique({ where: { eventId } });
    const guests = await this.prisma.guestInvitation.findMany({
      where: { eventId, status: GuestRsvpStatus.PENDING, usedAt: null, dataDeletedAt: null },
    });
    if (!guests.length) return { sent: 0 };

    const eventDate = formatEventDate(event.date);
    const frontendUrl = process.env.FRONTEND_URL ?? '';
    const rsvpDeadline = config?.rsvpDeadline ? formatEventDate(config.rsvpDeadline) : undefined;
    const fromName = senderName(config);

    await chunkProcess(guests, 50, async (chunk) => {
      const messages = chunk.map((g) => ({
        From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: fromName },
        To: [{ Email: g.guestEmail, Name: g.guestName }],
        Subject: `You're Invited: ${event.title}`,
        HTMLPart: GuestInvitationEmail({
          guestName: g.guestName, eventTitle: event.title, eventDate,
          venueName: event.venueName, rsvpLink: `${frontendUrl}/rsvp/${g.token}`,
          rsvpDeadline, customMessage: config?.customMessage ?? undefined,
          eventImageUrl: config?.inviteHeaderImageUrl ?? event.coverImage ?? undefined,
          accentColor: config?.accentColor ?? undefined,
        }),
      }));
      try {
        await getMailjet().post('send', { version: 'v3.1' }).request({ Messages: messages });
      } catch (e) {
        this.logger.error('Email batch failed', e);
      }
    });

    await chunkProcess(guests, 10, async (chunk) => {
      await Promise.allSettled(
        chunk.map((g) =>
          this.termii.sendInvitation(
            g.guestPhone, g.guestName, event.title, eventDate,
            event.venueName, `${frontendUrl}/rsvp/${g.token}`, rsvpDeadline,
          ),
        ),
      );
    }, 1000);

    return { sent: guests.length };
  }

  async testSend(eventId: string, dto: { email: string; phone: string }) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const config = await this.prisma.guestEventConfig.findUnique({ where: { eventId } });

    const eventDate = formatEventDate(event.date);
    const testToken = `TEST-${crypto.randomUUID()}`;
    const rsvpLink = `${process.env.FRONTEND_URL}/rsvp/${testToken}`;
    const rsvpDeadline = config?.rsvpDeadline ? formatEventDate(config.rsvpDeadline) : undefined;
    const fromName = senderName(config);

    try {
      await getMailjet().post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: fromName },
          To: [{ Email: dto.email, Name: 'Test Guest' }],
          Subject: `[TEST] You're Invited: ${event.title}`,
          HTMLPart: GuestInvitationEmail({
            guestName: 'Test Guest', eventTitle: event.title, eventDate,
            venueName: event.venueName, rsvpLink, rsvpDeadline,
            customMessage: config?.customMessage ?? undefined,
            eventImageUrl: config?.inviteHeaderImageUrl ?? event.coverImage ?? undefined,
            accentColor: config?.accentColor ?? undefined,
          }),
        }],
      });
    } catch (e) {
      this.logger.error('Test email failed', e);
    }

    if (dto.phone) {
      this.termii.sendInvitation(dto.phone, 'Test Guest', event.title, eventDate, event.venueName, rsvpLink, rsvpDeadline).catch(() => {});
    }

    return { message: 'Test invite sent' };
  }

  async getGuests(eventId: string, query: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 100, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { eventId };
    if (status && ['PENDING', 'CONFIRMED', 'DECLINED'].includes(status)) {
      where.status = status as GuestRsvpStatus;
    }

    const [guests, total] = await Promise.all([
      this.prisma.guestInvitation.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        select: {
          id: true, guestName: true, guestEmail: true, guestPhone: true,
          tableNumber: true, status: true, isCheckedIn: true, checkedInAt: true,
          dataDeletedAt: true, createdAt: true,
        },
      }),
      this.prisma.guestInvitation.count({ where }),
    ]);

    const [confirmed, declined, pending, checkedIn] = await Promise.all([
      this.prisma.guestInvitation.count({ where: { eventId, status: GuestRsvpStatus.CONFIRMED } }),
      this.prisma.guestInvitation.count({ where: { eventId, status: GuestRsvpStatus.DECLINED } }),
      this.prisma.guestInvitation.count({ where: { eventId, status: GuestRsvpStatus.PENDING } }),
      this.prisma.guestInvitation.count({ where: { eventId, isCheckedIn: true } }),
    ]);

    return {
      data: guests,
      meta: {
        total, page, limit,
        totalPages: Math.ceil(total / limit),
        stats: { confirmed, declined, pending, checkedIn },
      },
    };
  }

  async exportGuests(eventId: string): Promise<string> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const guests = await this.prisma.guestInvitation.findMany({
      where: { eventId },
      orderBy: [{ status: 'asc' }, { guestName: 'asc' }],
    });

    const rows = [
      'Name,Email,Phone,Table,Status,Checked In,Checked In At',
      ...guests.map((g) =>
        [
          `"${g.dataDeletedAt ? 'DELETED' : g.guestName}"`,
          g.dataDeletedAt ? 'DELETED' : g.guestEmail,
          g.dataDeletedAt ? 'DELETED' : g.guestPhone,
          g.tableNumber ?? '',
          g.status,
          g.isCheckedIn ? 'Yes' : 'No',
          g.checkedInAt ? new Date(g.checkedInAt).toISOString() : '',
        ].join(','),
      ),
    ];

    return rows.join('\n');
  }

  async resendInvite(guestId: string) {
    const guest = await this.prisma.guestInvitation.findUnique({
      where: { id: guestId },
      include: { event: true },
    });
    if (!guest) throw new NotFoundException('Guest not found');
    if (guest.dataDeletedAt) throw new BadRequestException('Guest data has been deleted');
    if (guest.status !== GuestRsvpStatus.PENDING) {
      throw new BadRequestException('Guest has already responded');
    }

    const config = await this.prisma.guestEventConfig.findUnique({ where: { eventId: guest.eventId } });
    const eventDate = formatEventDate(guest.event.date);
    const rsvpLink = `${process.env.FRONTEND_URL}/rsvp/${guest.token}`;
    const rsvpDeadline = config?.rsvpDeadline ? formatEventDate(config.rsvpDeadline) : undefined;
    const fromName = senderName(config);

    try {
      await getMailjet().post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: fromName },
          To: [{ Email: guest.guestEmail, Name: guest.guestName }],
          Subject: `Reminder: You're Invited to ${guest.event.title}`,
          HTMLPart: GuestInvitationEmail({
            guestName: guest.guestName, eventTitle: guest.event.title, eventDate,
            venueName: guest.event.venueName, rsvpLink, rsvpDeadline,
            customMessage: config?.customMessage ?? undefined,
            eventImageUrl: config?.inviteHeaderImageUrl ?? guest.event.coverImage ?? undefined,
            accentColor: config?.accentColor ?? undefined, isReminder: true,
          }),
        }],
      });
    } catch {}

    this.termii.sendInvitation(
      guest.guestPhone, guest.guestName, guest.event.title, eventDate,
      guest.event.venueName, rsvpLink, rsvpDeadline,
    ).catch(() => {});

    return { message: 'Invite resent' };
  }

  async deleteGuest(guestId: string) {
    const guest = await this.prisma.guestInvitation.findUnique({ where: { id: guestId } });
    if (!guest) throw new NotFoundException('Guest not found');
    await this.prisma.guestInvitation.delete({ where: { id: guestId } });
    return { message: 'Guest removed' };
  }

  // ── Public RSVP ─────────────────────────────────────────────────────────────

  async getRsvpByToken(token: string) {
    const guest = await this.prisma.guestInvitation.findUnique({
      where: { token },
      include: {
        event: {
          select: { title: true, date: true, venueName: true, venueAddress: true, coverImage: true },
          include: { guestConfig: true },
        },
      },
    });
    if (!guest) throw new NotFoundException('Invitation not found');
    if (guest.dataDeletedAt) throw new NotFoundException('Invitation not found');

    const now = new Date();
    const config = (guest.event as any).guestConfig as {
      rsvpDeadline: Date | null; customMessage: string | null; capacity: number | null;
      accentColor: string | null; inviteHeaderImageUrl: string | null;
    } | null;

    const deadlinePassed = config?.rsvpDeadline != null && config.rsvpDeadline < now;
    const expired = deadlinePassed && guest.status === GuestRsvpStatus.PENDING;

    return {
      status: guest.status,
      expired,
      guestName: guest.guestName,
      tableNumber: guest.tableNumber,
      qrCode: guest.status === GuestRsvpStatus.CONFIRMED ? guest.qrCode : null,
      customMessage: config?.customMessage ?? null,
      rsvpDeadline: config?.rsvpDeadline ?? null,
      accentColor: config?.accentColor ?? null,
      event: {
        title: guest.event.title,
        date: guest.event.date,
        venueName: guest.event.venueName,
        venueAddress: guest.event.venueAddress,
        coverImage: guest.event.coverImage,
      },
    };
  }

  async submitRsvp(token: string, dto: SubmitRsvpDto) {
    const guest = await this.prisma.guestInvitation.findUnique({
      where: { token },
      include: {
        event: {
          select: { title: true, date: true, venueName: true, coverImage: true },
          include: { guestConfig: true },
        },
      },
    });

    if (!guest) throw new NotFoundException('Invitation not found');
    if (guest.dataDeletedAt) throw new NotFoundException('Invitation not found');
    if (guest.usedAt) throw new BadRequestException('This invitation has already been used');

    const config = (guest.event as any).guestConfig as {
      rsvpDeadline: Date | null; capacity: number | null;
      accentColor: string | null; inviteFromName: string | null;
    } | null;

    if (config?.rsvpDeadline && config.rsvpDeadline < new Date()) {
      throw new BadRequestException('The RSVP deadline for this event has passed');
    }

    const eventDate = formatEventDate(guest.event.date);

    if (dto.action === 'confirm') {
      if (config?.capacity != null) {
        const confirmed = await this.prisma.guestInvitation.count({
          where: { eventId: guest.eventId, status: GuestRsvpStatus.CONFIRMED },
        });
        if (confirmed >= config.capacity) {
          throw new BadRequestException('This event is at full capacity');
        }
      }

      const qrCode = generateGuestQR();
      await this.prisma.guestInvitation.update({
        where: { id: guest.id },
        data: {
          status: GuestRsvpStatus.CONFIRMED,
          usedAt: new Date(),
          qrCode,
          consentGivenAt: new Date(),
        },
      });

      // Upsert to contact book
      this.contacts.upsert({
        email: guest.guestEmail,
        name: guest.guestName,
        phone: guest.guestPhone,
        eventTitle: guest.event.title,
      }).catch(() => {});

      const fromName = senderName(config);

      getMailjet().post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: fromName },
          To: [{ Email: guest.guestEmail, Name: guest.guestName }],
          Subject: `RSVP Confirmed — ${guest.event.title}`,
          HTMLPart: GuestRsvpConfirmationEmail({
            guestName: guest.guestName, eventTitle: guest.event.title, eventDate,
            venueName: guest.event.venueName, qrCode,
            tableNumber: guest.tableNumber ?? undefined,
            eventImageUrl: guest.event.coverImage ?? undefined,
          }),
        }],
      }).catch(() => {});

      this.termii.sendRsvpConfirmation(
        guest.guestPhone, guest.guestName, guest.event.title, eventDate, guest.event.venueName, qrCode,
      ).catch(() => {});

      return {
        confirmed: true, guestName: guest.guestName, qrCode,
        event: { title: guest.event.title, date: guest.event.date, venueName: guest.event.venueName },
      };
    } else {
      await this.prisma.guestInvitation.update({
        where: { id: guest.id },
        data: { status: GuestRsvpStatus.DECLINED, usedAt: new Date() },
      });
      return { confirmed: false, guestName: guest.guestName };
    }
  }

  // ── NDPA: Forget-me & Data Export ────────────────────────────────────────────

  async forgetMe(token: string) {
    const guest = await this.prisma.guestInvitation.findUnique({ where: { token } });
    if (!guest) throw new NotFoundException('Invitation not found');
    if (guest.dataDeletedAt) return { message: 'Data already deleted' };

    await this.prisma.guestInvitation.update({
      where: { id: guest.id },
      data: {
        guestName: '[DELETED]',
        guestEmail: `deleted-${guest.id}@redacted`,
        guestPhone: '[DELETED]',
        dataDeletedAt: new Date(),
      },
    });

    return { message: 'Your data has been anonymised in compliance with the NDPA.' };
  }

  async getMyData(token: string) {
    const guest = await this.prisma.guestInvitation.findUnique({
      where: { token },
      include: { event: { select: { title: true, date: true, venueName: true } } },
    });
    if (!guest) throw new NotFoundException('Invitation not found');
    if (guest.dataDeletedAt) throw new NotFoundException('Data has been deleted');

    return {
      name: guest.guestName,
      email: guest.guestEmail,
      phone: guest.guestPhone,
      tableNumber: guest.tableNumber,
      rsvpStatus: guest.status,
      consentGivenAt: guest.consentGivenAt,
      event: {
        title: guest.event.title,
        date: guest.event.date,
        venueName: guest.event.venueName,
      },
    };
  }

  // ── Request-to-Attend ────────────────────────────────────────────────────────

  async submitRequest(slug: string, dto: SubmitRequestDto) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { guestConfig: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.guestConfig?.allowRequests) {
      throw new BadRequestException('This event is not accepting attendance requests');
    }

    const existing = await this.prisma.attendanceRequest.findUnique({
      where: { eventId_guestEmail: { eventId: event.id, guestEmail: dto.email.toLowerCase().trim() } },
    });
    if (existing) throw new BadRequestException('You have already submitted a request for this event');

    return this.prisma.attendanceRequest.create({
      data: {
        eventId: event.id,
        guestName: dto.name.trim(),
        guestEmail: dto.email.toLowerCase().trim(),
        guestPhone: dto.phone.trim(),
        message: dto.message?.trim() ?? null,
      },
    });
  }

  async getRequests(eventId: string, query: { page?: number; status?: string }) {
    const { page = 1, status } = query;
    const skip = (page - 1) * 50;

    const where: any = { eventId };
    if (status && Object.values(RequestStatus).includes(status as RequestStatus)) {
      where.status = status as RequestStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.attendanceRequest.findMany({
        where, skip, take: 50, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.attendanceRequest.count({ where }),
    ]);

    const [pending, approved, declined] = await Promise.all([
      this.prisma.attendanceRequest.count({ where: { eventId, status: RequestStatus.PENDING } }),
      this.prisma.attendanceRequest.count({ where: { eventId, status: RequestStatus.APPROVED } }),
      this.prisma.attendanceRequest.count({ where: { eventId, status: RequestStatus.DECLINED } }),
    ]);

    return {
      data,
      meta: { total, page, totalPages: Math.ceil(total / 50), stats: { pending, approved, declined } },
    };
  }

  async approveRequest(requestId: string) {
    const req = await this.prisma.attendanceRequest.findUnique({
      where: { id: requestId },
      include: { event: true },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request has already been processed');
    }

    // Check for existing guest
    const existing = await this.prisma.guestInvitation.findUnique({
      where: { eventId_guestEmail: { eventId: req.eventId, guestEmail: req.guestEmail } },
    });

    const token = crypto.randomUUID();
    if (!existing) {
      await this.prisma.guestInvitation.create({
        data: {
          eventId: req.eventId,
          token,
          guestName: req.guestName,
          guestEmail: req.guestEmail,
          guestPhone: req.guestPhone,
        },
      });
    }

    await this.prisma.attendanceRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.APPROVED, processedAt: new Date() },
    });

    const config = await this.prisma.guestEventConfig.findUnique({ where: { eventId: req.eventId } });
    const eventDate = formatEventDate(req.event.date);
    const rsvpLink = `${process.env.FRONTEND_URL}/rsvp/${existing?.token ?? token}`;
    const rsvpDeadline = config?.rsvpDeadline ? formatEventDate(config.rsvpDeadline) : undefined;
    const fromName = senderName(config);

    getMailjet().post('send', { version: 'v3.1' }).request({
      Messages: [{
        From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: fromName },
        To: [{ Email: req.guestEmail, Name: req.guestName }],
        Subject: `You're Invited: ${req.event.title}`,
        HTMLPart: GuestInvitationEmail({
          guestName: req.guestName, eventTitle: req.event.title, eventDate,
          venueName: req.event.venueName, rsvpLink, rsvpDeadline,
          customMessage: config?.customMessage ?? undefined,
          eventImageUrl: config?.inviteHeaderImageUrl ?? req.event.coverImage ?? undefined,
          accentColor: config?.accentColor ?? undefined,
        }),
      }],
    }).catch(() => {});

    this.termii.sendInvitation(
      req.guestPhone, req.guestName, req.event.title, eventDate,
      req.event.venueName, rsvpLink, rsvpDeadline,
    ).catch(() => {});

    return { message: 'Request approved and invite sent' };
  }

  async declineRequest(requestId: string) {
    const req = await this.prisma.attendanceRequest.findUnique({
      where: { id: requestId },
      include: { event: true },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request has already been processed');
    }

    await this.prisma.attendanceRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.DECLINED, processedAt: new Date() },
    });

    const eventDate = formatEventDate(req.event.date);

    getMailjet().post('send', { version: 'v3.1' }).request({
      Messages: [{
        From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: 'Ekovibe' },
        To: [{ Email: req.guestEmail, Name: req.guestName }],
        Subject: `Your Request for ${req.event.title}`,
        HTMLPart: GuestRequestDeclinedEmail({
          guestName: req.guestName, eventTitle: req.event.title, eventDate,
          venueName: req.event.venueName, eventImageUrl: req.event.coverImage ?? undefined,
        }),
      }],
    }).catch(() => {});

    return { message: 'Request declined' };
  }

  // ── QR scanner extension ─────────────────────────────────────────────────────

  async scanGuestQR(qrCode: string) {
    const guest = await this.prisma.guestInvitation.findUnique({
      where: { qrCode },
      include: { event: { select: { title: true } } },
    });

    if (!guest || guest.status !== GuestRsvpStatus.CONFIRMED) {
      throw new NotFoundException('Invalid ticket code');
    }

    const tier = `Guest${guest.tableNumber ? ` — Table ${guest.tableNumber}` : ''}`;

    if (guest.isCheckedIn) {
      return { valid: false, reason: 'ALREADY_USED', usedAt: guest.checkedInAt, holder: guest.guestName, tier, event: guest.event.title };
    }

    await this.prisma.guestInvitation.update({
      where: { id: guest.id },
      data: { isCheckedIn: true, checkedInAt: new Date() },
    });

    return { valid: true, holder: guest.guestName, tier, event: guest.event.title };
  }

  // ── Auto-reminders (cron) ────────────────────────────────────────────────────

  @Cron('0 8 * * *') // 9am WAT daily
  async sendScheduledReminders() {
    this.logger.log('Running scheduled RSVP reminders');
    const now = new Date();
    const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

    const guests3 = await this.prisma.guestInvitation.findMany({
      where: {
        status: GuestRsvpStatus.PENDING, usedAt: null, reminder3SentAt: null, dataDeletedAt: null,
        event: { date: { gte: addDays(now, 2), lte: addDays(now, 4) } },
      },
      include: { event: { include: { guestConfig: true } } },
    });

    const guests1 = await this.prisma.guestInvitation.findMany({
      where: {
        status: GuestRsvpStatus.PENDING, usedAt: null, reminder1SentAt: null, dataDeletedAt: null,
        event: { date: { gte: now, lte: addDays(now, 2) } },
      },
      include: { event: { include: { guestConfig: true } } },
    });

    await this.sendReminderBatch(guests3, '3');
    await this.sendReminderBatch(guests1, '1');
  }

  // ── Post-event follow-up (cron) ──────────────────────────────────────────────

  @Cron('0 10 * * *') // 11am WAT daily
  async sendPostEventFollowUps() {
    this.logger.log('Running post-event follow-up sends');
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);

    const guests = await this.prisma.guestInvitation.findMany({
      where: {
        status: GuestRsvpStatus.CONFIRMED,
        followUpSentAt: null,
        dataDeletedAt: null,
        event: { date: { gte: twoDaysAgo, lte: yesterday } },
      },
      include: { event: { include: { guestConfig: true } } },
    });

    if (!guests.length) return;

    const frontendUrl = process.env.FRONTEND_URL ?? '';

    await chunkProcess(guests, 50, async (chunk) => {
      const messages = chunk.map((g) => {
        const config = (g.event as any).guestConfig as { photoGalleryUrl?: string | null; followUpMessage?: string | null } | null;
        const eventDate = formatEventDate(g.event.date);
        return {
          From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: 'Ekovibe' },
          To: [{ Email: g.guestEmail, Name: g.guestName }],
          Subject: `Thanks for the vibes — ${g.event.title}`,
          HTMLPart: GuestPostEventEmail({
            guestName: g.guestName, eventTitle: g.event.title, eventDate,
            photoGalleryUrl: config?.photoGalleryUrl ?? undefined,
            followUpMessage: config?.followUpMessage ?? undefined,
            eventImageUrl: g.event.coverImage ?? undefined,
          }),
        };
      });

      try {
        await getMailjet().post('send', { version: 'v3.1' }).request({ Messages: messages });
      } catch (e) {
        this.logger.error('Post-event follow-up email batch failed', e);
      }

      await Promise.allSettled(
        chunk.map((g) => {
          const config = (g.event as any).guestConfig as { photoGalleryUrl?: string | null } | null;
          return this.termii.sendPostEventFollowUp(
            g.guestPhone, g.guestName, g.event.title, config?.photoGalleryUrl ?? undefined,
          );
        }),
      );
    });

    await this.prisma.guestInvitation.updateMany({
      where: { id: { in: guests.map((g) => g.id) } },
      data: { followUpSentAt: new Date() },
    });

    this.logger.log(`Sent post-event follow-ups to ${guests.length} guests`);
  }

  // ── Admin: trigger post-event follow-up manually ─────────────────────────────

  async sendFollowUpNow(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { guestConfig: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const config = event.guestConfig;
    const eventDate = formatEventDate(event.date);
    const frontendUrl = process.env.FRONTEND_URL ?? '';

    const guests = await this.prisma.guestInvitation.findMany({
      where: { eventId, status: GuestRsvpStatus.CONFIRMED, dataDeletedAt: null },
    });

    if (!guests.length) return { sent: 0 };

    await chunkProcess(guests, 50, async (chunk) => {
      const messages = chunk.map((g) => ({
        From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: 'Ekovibe' },
        To: [{ Email: g.guestEmail, Name: g.guestName }],
        Subject: `Thanks for the vibes — ${event.title}`,
        HTMLPart: GuestPostEventEmail({
          guestName: g.guestName, eventTitle: event.title, eventDate,
          photoGalleryUrl: config?.photoGalleryUrl ?? undefined,
          followUpMessage: config?.followUpMessage ?? undefined,
          eventImageUrl: event.coverImage ?? undefined,
        }),
      }));

      try {
        await getMailjet().post('send', { version: 'v3.1' }).request({ Messages: messages });
      } catch (e) {
        this.logger.error('Manual follow-up batch failed', e);
      }

      await Promise.allSettled(
        chunk.map((g) =>
          this.termii.sendPostEventFollowUp(g.guestPhone, g.guestName, event.title, config?.photoGalleryUrl ?? undefined),
        ),
      );
    });

    await this.prisma.guestInvitation.updateMany({
      where: { eventId, status: GuestRsvpStatus.CONFIRMED },
      data: { followUpSentAt: new Date() },
    });

    return { sent: guests.length };
  }

  private async sendReminderBatch(
    guests: Array<{ id: string; guestName: string; guestEmail: string; guestPhone: string; token: string; event: any }>,
    type: '3' | '1',
  ) {
    if (!guests.length) return;

    const field = type === '3' ? 'reminder3SentAt' : 'reminder1SentAt';
    const frontendUrl = process.env.FRONTEND_URL ?? '';

    await chunkProcess(guests, 50, async (chunk) => {
      const messages = chunk.map((g) => {
        const config = g.event.guestConfig;
        const eventDate = formatEventDate(g.event.date);
        return {
          From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: senderName(config) },
          To: [{ Email: g.guestEmail, Name: g.guestName }],
          Subject: `Reminder: RSVP for ${g.event.title}`,
          HTMLPart: GuestInvitationEmail({
            guestName: g.guestName, eventTitle: g.event.title, eventDate,
            venueName: g.event.venueName, rsvpLink: `${frontendUrl}/rsvp/${g.token}`,
            rsvpDeadline: config?.rsvpDeadline ? formatEventDate(config.rsvpDeadline) : undefined,
            customMessage: config?.customMessage ?? undefined,
            eventImageUrl: config?.inviteHeaderImageUrl ?? g.event.coverImage ?? undefined,
            accentColor: config?.accentColor ?? undefined,
            isReminder: true,
          }),
        };
      });

      try {
        await getMailjet().post('send', { version: 'v3.1' }).request({ Messages: messages });
      } catch (e) {
        this.logger.error(`Reminder email batch (${type}-day) failed`, e);
      }

      await Promise.allSettled(
        chunk.map((g) => {
          const eventDate = formatEventDate(g.event.date);
          return this.termii.sendInvitation(
            g.guestPhone, g.guestName, g.event.title, eventDate,
            g.event.venueName, `${frontendUrl}/rsvp/${g.token}`,
          );
        }),
      );
    });

    await this.prisma.guestInvitation.updateMany({
      where: { id: { in: guests.map((g) => g.id) } },
      data: { [field]: new Date() },
    });

    this.logger.log(`Sent ${type}-day reminders to ${guests.length} guests`);
  }
}
