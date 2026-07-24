import {
  Injectable,
  NotFoundException,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import Mailjet from 'node-mailjet';
import { ApplicationStatus } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMembershipApplicationDto } from './dto/create-membership-application.dto';
import { MembershipApplicationConfirmationEmail } from 'emails/membership-application-confirmation-email';
import { MembershipApplicationAdminEmail } from 'emails/membership-application-admin-email';
import { MembershipPaymentEmail } from 'emails/membership-payment-email';

const PAYSTACK_BASE = 'https://api.paystack.co';

// Membership prices in kobo
const TIER_PRICES: Record<'GOLD' | 'BLACK', number> = {
  GOLD: 5_000_000,   // ₦50,000
  BLACK: 15_000_000, // ₦150,000
};

function getMailjet() {
  return Mailjet.apiConnect(
    process.env.MAILJET_API_PUBLIC_KEY!,
    process.env.MAILJET_API_PRIVATE_KEY!,
  );
}

@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService) {}

  async submitApplication(dto: CreateMembershipApplicationDto) {
    const application = await this.prisma.membershipApplication.create({
      data: dto,
    });

    const mj = getMailjet();

    // The application is already saved, so neither email may fail the request.
    // They are also caught separately — a failed applicant confirmation must
    // still leave the admin alert to fire, or the application goes unnoticed.

    // 1. Confirmation to applicant
    try {
      await mj.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: process.env.SENDER_EMAIL_ADDRESS,
              Name: 'Ekovibe',
            },
            To: [{ Email: application.email, Name: application.fullName }],
            Subject: `Your Ekovibe ${application.tier === 'GOLD' ? 'Gold' : 'Black'} Membership Application`,
            HTMLPart: MembershipApplicationConfirmationEmail({
              fullName: application.fullName,
              tier: application.tier as 'GOLD' | 'BLACK',
            }),
          },
        ],
      });
    } catch (e) {
      console.error('Failed to send membership confirmation email:', e);
    }

    // 2. Alert to admin team
    const adminEmail = process.env.ADMIN_EMAIL_ADDRESS || process.env.SENDER_EMAIL_ADDRESS!;
    try {
      await mj.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: process.env.SENDER_EMAIL_ADDRESS,
              Name: 'Ekovibe System',
            },
            To: [{ Email: adminEmail, Name: 'Ekovibe Team' }],
            Subject: `New ${application.tier} Membership Application — ${application.fullName}`,
            HTMLPart: MembershipApplicationAdminEmail({
              fullName: application.fullName,
              email: application.email,
              phone: application.phone,
              occupation: application.occupation,
              city: application.city,
              tier: application.tier as 'GOLD' | 'BLACK',
              referral: application.referral ?? undefined,
              message: application.message ?? undefined,
            }),
          },
        ],
      });
    } catch (e) {
      console.error('Failed to send membership admin alert:', e);
    }

    return { message: 'Application submitted successfully.' };
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getApplications(query: {
    status?: ApplicationStatus;
    page?: number;
    limit?: number;
  }) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [applications, total] = await Promise.all([
      this.prisma.membershipApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.membershipApplication.count({ where }),
    ]);

    return {
      data: applications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async approveAndSendPaymentLink(id: string) {
    const application = await this.prisma.membershipApplication.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Only PENDING applications can be approved');
    }

    const tier = application.tier as 'GOLD' | 'BLACK';
    const amount = TIER_PRICES[tier];
    const reference = `MBR-${id.slice(0, 8)}-${Date.now()}`;

    // Initialize Paystack transaction
    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: application.email,
        amount,
        reference,
        callback_url: `${process.env.FRONTEND_URL}/membership/payment/callback`,
        metadata: { applicationId: id, tier },
      }),
    });
    const data = await res.json();
    if (!data.status) {
      throw new BadGatewayException(
        `Paystack initialization failed: ${data.message}`,
      );
    }

    const paymentUrl: string = data.data.authorization_url;

    // Save reference + mark APPROVED
    await this.prisma.membershipApplication.update({
      where: { id },
      data: { status: ApplicationStatus.APPROVED, paystackRef: reference },
    });

    // Email payment link to applicant
    const tierLabel = tier === 'GOLD' ? 'Gold' : 'Black';
    const nairaAmount = tier === 'GOLD' ? '₦50,000' : '₦150,000';
    const mj = getMailjet();
    try {
      await mj.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: { Email: process.env.SENDER_EMAIL_ADDRESS, Name: 'Ekovibe' },
            To: [{ Email: application.email, Name: application.fullName }],
            Subject: `Your Ekovibe ${tierLabel} Membership — Complete Payment`,
            HTMLPart: MembershipPaymentEmail({
              fullName: application.fullName,
              tier,
              amount: nairaAmount,
              paymentUrl,
            }),
          },
        ],
      });
    } catch {
      // Email failure should not block the response
    }

    return { message: 'Approved. Payment link sent to applicant.', paymentUrl };
  }

  async rejectApplication(id: string) {
    const application = await this.prisma.membershipApplication.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Application not found');
    return this.prisma.membershipApplication.update({
      where: { id },
      data: { status: ApplicationStatus.REJECTED },
    });
  }

  // ── Payment callback ───────────────────────────────────────────────────────

  async verifyMembershipPayment(reference: string) {
    // Verify with Paystack
    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );
    const data = await res.json();
    if (!data.status || data.data.status !== 'success') {
      throw new BadRequestException('Payment not successful');
    }

    const { applicationId, tier } = data.data.metadata as {
      applicationId: string;
      tier: 'GOLD' | 'BLACK';
    };

    const application = await this.prisma.membershipApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');

    // Mark paid
    await this.prisma.membershipApplication.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.REVIEWED, paidAt: new Date() },
    });

    // Upgrade the user account by email
    await this.prisma.user.updateMany({
      where: { email: application.email },
      data: { userTier: tier === 'GOLD' ? 'gold' : 'black' },
    });

    return { success: true, tier };
  }
}
