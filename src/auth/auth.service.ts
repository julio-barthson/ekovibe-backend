import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { plainToClass } from 'class-transformer';
import Mailjet from 'node-mailjet';
import slugify from 'slugify';
import { UserResponseDto } from './dto/user-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { notDeleted } from 'src/utils/prismaFilters';
import { RegisterUserDto } from './dto/register-user.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { WelcomeEmail } from 'emails/welcome-email';
import { ForgotPasswordEmail } from 'emails/forgot-password-email';

function getMailjet() {
  return Mailjet.apiConnect(
    process.env.MAILJET_API_PUBLIC_KEY!,
    process.env.MAILJET_API_PRIVATE_KEY!,
  );
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: UserResponseDto;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  isTwoFactorAuthenticated?: boolean;
}

// 30-day sessions: users stay logged in for 30 days of inactivity.
// Every refresh rotates the token, so active users never expire.
const SESSION_DURATION = '30d';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  getAcronym(name?: string) {
    if (!name) return 'EMS';
    const words = name.trim().split(/\s+/);
    return words
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase())
      .join('');
  }

  generatePrefix(length = 4): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  getCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  // Access tokens are short-lived (15 min) — the axios interceptor refreshes
  // them silently so the user never notices.
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET, // validated by JwtStrategy
      expiresIn: '15m',
    });
  }

  // Refresh tokens are long-lived (30 days) and rotated on every use.
  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: SESSION_DURATION,
    });
  }

  async hashRefreshToken(refreshToken: string): Promise<string> {
    return bcrypt.hash(refreshToken, 10);
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) return null;
    if (!user.password)
      throw new UnauthorizedException(
        'This account uses google sign-in. Please use "Continue with Google" button',
      );

    if (await bcrypt.compare(password, user.password)) {
      const { password, refreshToken, ...result } = user;
      return result;
    }

    return null;
  }

  async login(user: any) {
    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      isTwoFactorAuthenticated: false,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Store plain-text refresh token — refreshTokens() does a direct string
    // comparison (consistent with existing records in the DB).
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
      include: { admin: true },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: plainToClass(
        UserResponseDto,
        {
          ...updatedUser,
          isAdmin: !!updatedUser.admin,
          isVendor: updatedUser.role === 'VENDOR',
          adminPosition: updatedUser.admin?.position ?? null,
          adminModules: updatedUser.admin?.modules ?? null,
        },
        { excludeExtraneousValues: true },
      ),
    };
  }

  async register(registerUserDto: RegisterUserDto) {
    if (registerUserDto.password !== registerUserDto.confirmPassword)
      throw new ConflictException('Password do not match');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerUserDto.email },
    });

    if (existingUser) throw new ConflictException('User already exists');

    const hashedPassword = await bcrypt.hash(registerUserDto.password, 10);

    let baseUsername = slugify(
      `${registerUserDto.firstName} ${registerUserDto.lastName}`,
    );
    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}-${counter}`;
      counter++;
    }

    const user = await this.prisma.user.create({
      data: {
        firstName: registerUserDto.firstName,
        lastName: registerUserDto.lastName,
        email: registerUserDto.email,
        password: hashedPassword,
        username,
        role: 'USER',
        userTier: registerUserDto.tier,
      },
    });

    // The account already exists at this point — a mail failure must not fail
    // the signup, or the user is locked out of an account they can't re-create.
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
              To: [{ Email: user.email, Name: user.firstName }],
              Subject: `Welcome to Ekovibe, ${user.firstName}`,
              HTMLPart: WelcomeEmail({
                firstName: user.firstName,
              }),
            },
          ],
        });
    } catch (e) {
      console.error('Failed to send welcome email:', e);
    }

    const { password, refreshToken, ...result } = user;
    return this.login(result);
  }

  private async generateUniqueUsername(firstName: string, lastName: string) {
    const baseUsername =
      slugify(`${firstName} ${lastName}`.trim(), { lower: true }) || 'ekovibe';
    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}-${counter}`;
      counter++;
    }

    return username;
  }

  // Called by GoogleStrategy after Google verifies the account. Matches on
  // email so someone who registered with a password can still use the Google
  // button — we just link the provider rather than creating a duplicate.
  async validateGoogleUser(profile: {
    email: string;
    firstName: string;
    lastName: string;
    image: string | null;
    emailVerified: boolean;
  }) {
    const email = profile.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.isDeleted)
        throw new UnauthorizedException('This account is no longer active');

      const { password, refreshToken, ...user } = await this.prisma.user.update(
        {
          where: { id: existing.id },
          data: {
            // Don't clobber an uploaded avatar with the Google one.
            image: existing.image ?? profile.image,
            emailVerified: existing.emailVerified || profile.emailVerified,
          },
        },
      );

      return user;
    }

    const username = await this.generateUniqueUsername(
      profile.firstName,
      profile.lastName,
    );

    const created = await this.prisma.user.create({
      data: {
        email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        username,
        image: profile.image,
        provider: 'google',
        emailVerified: profile.emailVerified,
        role: 'USER',
      },
    });

    // A failed welcome email must never block sign-in.
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
              To: [{ Email: created.email, Name: created.firstName }],
              Subject: `Welcome to Ekovibe, ${created.firstName}`,
              HTMLPart: WelcomeEmail({ firstName: created.firstName }),
            },
          ],
        });
    } catch {
      // swallow — the account already exists at this point
    }

    const { password, refreshToken, ...user } = created;
    return user;
  }

  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, ...notDeleted() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        onboardingCompleted: true,
        userTier: true,
      },
    });

    if (!user) throw new ConflictException('Oops! User not found');

    return user;
  }

  async verifyCode(otp: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) throw new NotFoundException('No account with that email');
    if (!user.resetOTP)
      throw new UnauthorizedException('Invalid or expired OTP');
    if (user.resetOTPExpiry! < new Date())
      throw new UnauthorizedException('OTP has expired');

    const isValid = await bcrypt.compare(otp, user.resetOTP);
    if (!isValid) throw new UnauthorizedException('Invalid OTP');

    return { message: 'OTP verification successful' };
  }

  async setNewPassword({
    email,
    otp,
    newPassword,
    confirmPassword,
  }: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    if (newPassword !== confirmPassword)
      throw new BadRequestException('Passwords do not match');

    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) throw new NotFoundException('No account with that email');
    if (!user.resetOTP)
      throw new UnauthorizedException('Invalid or expired OTP');
    if (user.resetOTPExpiry! < new Date())
      throw new UnauthorizedException('OTP has expired');

    const isValid = await bcrypt.compare(otp, user.resetOTP);
    if (!isValid) throw new UnauthorizedException('Invalid OTP');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { email },
      data: { password: hashedPassword, resetOTP: null, resetOTPExpiry: null },
    });

    return { message: 'Password reset successfully.' };
  }

  async sendPasswordResetOTP(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, ...notDeleted() },
    });

    if (!user) throw new BadRequestException('No account with that email');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    const hashedOTP = await bcrypt.hash(otp, 10);

    await this.prisma.user.update({
      where: { email },
      data: { resetOTP: hashedOTP, resetOTPExpiry: expiry },
    });

    // Unlike other mail, this one is the whole point of the request — if it
    // fails, say so rather than reporting success for an email that never sent.
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
              To: [{ Email: email, Name: user.firstName }],
              Subject: `Password Reset Code`,
              HTMLPart: ForgotPasswordEmail({
                firstName: user.firstName,
                otp,
              }),
            },
          ],
        });
    } catch (e) {
      console.error('Failed to send password reset OTP:', e);
      throw new ServiceUnavailableException(
        'We could not send your reset code right now. Please try again shortly.',
      );
    }

    return { message: 'Password reset OTP sent to your email' };
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  // Verify the JWT to get the user ID directly (O(1), no full-table scan).
  // We allow expired tokens so logout still works after long inactivity.
  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
        ignoreExpiration: true,
      });

      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { refreshToken: null },
      });
    } catch {
      // Malformed / tampered token — ignore, cookies are cleared by controller
    }

    return { message: 'User logged out' };
  }

  // ── Token refresh ─────────────────────────────────────────────────────────
  // 1. Verify the refresh token JWT (checks signature + expiry)
  // 2. Fetch the user by the ID in the payload — O(1) lookup
  // 3. Confirm the stored DB token matches the incoming one (detects reuse after rotation)
  // 4. Rotate: issue a fresh access token (JWT_SECRET) + refresh token (JWT_REFRESH_SECRET)
  async refreshTokens(refreshToken: string) {
    // Step 1 — validate the JWT itself
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      return null; // expired or tampered
    }

    // Step 2 — load the user by ID embedded in the token.
    // Load the full record (not a narrow select): the response is fed straight
    // into the client's auth store, so anything missing here is silently wiped
    // from the persisted user — that's how `createdAt`, `image`, `userTier` and
    // `isAdmin` used to disappear after a Google sign-in.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { admin: true },
    });

    if (!user || !user.refreshToken) {
      return null; // deleted user or already logged out
    }

    // Step 3 — confirm the token matches what we stored (plain-text)
    if (user.refreshToken !== refreshToken) {
      // Possible refresh-token-reuse attack: revoke all tokens for this user
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });
      return null;
    }

    // Step 4 — rotate tokens
    const newPayload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.generateAccessToken(newPayload); // JWT_SECRET
    const newRefreshToken = this.generateRefreshToken(newPayload); // JWT_REFRESH_SECRET

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    // Same shape as login() — the client replaces its whole stored user with
    // this, so the two responses must not diverge.
    const { password: _pw, refreshToken: _omit, ...safeUser } = user;
    return {
      accessToken,
      newRefreshToken,
      user: plainToClass(
        UserResponseDto,
        {
          ...safeUser,
          isAdmin: !!user.admin,
          isVendor: user.role === 'VENDOR',
          adminPosition: user.admin?.position ?? null,
          adminModules: user.admin?.modules ?? null,
        },
        { excludeExtraneousValues: true },
      ),
    };
  }

  // ── Update Profile ─────────────────────────────────────────────────────────
  async updateProfile(
    userId: string,
    dto: {
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      gender?: string;
      dob?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
    },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        gender: dto.gender,
        dob: dto.dob,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country,
      },
      include: { admin: true },
    });

    const { password, refreshToken, ...safe } = user;
    return plainToClass(
      UserResponseDto,
      {
        ...safe,
        isAdmin: !!user.admin,
        isVendor: user.role === 'VENDOR',
        adminPosition: user.admin?.position ?? null,
        adminModules: user.admin?.modules ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ── Change Password ────────────────────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new BadRequestException('Cannot change password for this account');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { message: 'Password updated successfully' };
  }

  // ── Complete Onboarding ────────────────────────────────────────────────────
  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    if (dto.accountType === 'vendor') {
      if (!dto.brandName)
        throw new BadRequestException('Brand name is required');

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          role: 'VENDOR',
          onboardingCompleted: true,
          interests: dto.interests ?? [],
          vendorProfile: {
            create: {
              brandName: dto.brandName,
              brandBio: dto.brandBio,
              website: dto.website,
              instagram: dto.instagram,
            },
          },
        },
      });
    } else if (dto.accountType === 'venue_owner') {
      if (!dto.businessName)
        throw new BadRequestException('Business name is required');

      // Create profile + update role atomically. If a profile already exists
      // (e.g. created by admin), just ensure role is correct.
      const existing = await this.prisma.venueOwnerProfile.findUnique({ where: { userId } });
      if (!existing) {
        await this.prisma.$transaction([
          this.prisma.venueOwnerProfile.create({
            data: {
              userId,
              businessName: dto.businessName,
              businessEmail: dto.businessEmail,
              businessPhone: dto.businessPhone,
            },
          }),
          this.prisma.user.update({
            where: { id: userId },
            data: { role: 'VENUE_OWNER', onboardingCompleted: true },
          }),
        ]);
      } else {
        await this.prisma.user.update({
          where: { id: userId },
          data: { role: 'VENUE_OWNER', onboardingCompleted: true },
        });
      }
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          role: 'USER',
          onboardingCompleted: true,
          interests: dto.interests ?? [],
        },
      });
    }

    const updated = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { admin: true, vendorProfile: true },
    });

    return plainToClass(
      UserResponseDto,
      {
        ...updated,
        isAdmin: !!updated?.admin,
        isVendor: updated?.role === 'VENDOR',
        adminPosition: updated?.admin?.position ?? null,
        adminModules: updated?.admin?.modules ?? null,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ── Get / Update Vendor Profile ────────────────────────────────────────────
  async getVendorProfile(userId: string) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Vendor profile not found');
    return profile;
  }

  async updateVendorProfile(
    userId: string,
    dto: {
      brandName?: string;
      brandBio?: string;
      website?: string;
      instagram?: string;
      logoUrl?: string;
    },
  ) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Vendor profile not found');

    return this.prisma.vendorProfile.update({
      where: { userId },
      data: {
        ...(dto.brandName !== undefined && { brandName: dto.brandName }),
        ...(dto.brandBio !== undefined && { brandBio: dto.brandBio }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.instagram !== undefined && { instagram: dto.instagram }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      },
    });
  }

  // Expose session duration in ms so the controller can set consistent cookie maxAge
  getSessionMs(): number {
    return SESSION_MS;
  }

  // ── Admin: vendor management ───────────────────────────────────────────────
  async getAdminVendorById(id: string) {
    const vendor = await this.prisma.user.findUnique({
      where: { id },
      include: {
        vendorProfile: true,
        wallet: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
        withdrawalRequests: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!vendor || vendor.role !== 'VENDOR') {
      throw new NotFoundException('Vendor not found');
    }

    const [revenueKobo, ticketsSold] = await Promise.all([
      this.prisma.order.aggregate({
        where: { event: { createdById: id }, status: 'PAID' },
        _sum: { subtotal: true },
      }),
      this.prisma.ticketTier.aggregate({
        where: { event: { createdById: id } },
        _sum: { sold: true },
      }),
    ]);

    const eventsWithRevenue = await Promise.all(
      vendor.events.map(async (event) => {
        const [rev, sold] = await Promise.all([
          this.prisma.order.aggregate({
            where: { eventId: event.id, status: 'PAID' },
            _sum: { subtotal: true },
          }),
          this.prisma.ticketTier.aggregate({
            where: { eventId: event.id },
            _sum: { sold: true },
          }),
        ]);
        return {
          ...event,
          totalRevenue: rev._sum.subtotal ?? 0,
          totalSold: sold._sum.sold ?? 0,
        };
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...safe } = vendor as typeof vendor & Record<string, any>;
    return {
      ...safe,
      events: eventsWithRevenue,
      totalEvents: vendor.events.length,
      totalTicketsSold: ticketsSold._sum.sold ?? 0,
      totalRevenue: revenueKobo._sum.subtotal ?? 0,
      walletBalance: vendor.wallet?.balance ?? 0,
    };
  }

  async getAdminVendors(query: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { role: 'VENDOR', isDeleted: false };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { vendorProfile: { brandName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [vendors, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          vendorProfile: true,
          wallet: true,
          _count: { select: { events: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Attach total revenue per vendor
    const vendorsWithStats = await Promise.all(
      vendors.map(async (v) => {
        const [ticketsSold, revenueKobo] = await Promise.all([
          this.prisma.ticketTier.aggregate({
            where: { event: { createdById: v.id } },
            _sum: { sold: true },
          }),
          this.prisma.order.aggregate({
            where: { event: { createdById: v.id }, status: 'PAID' },
            _sum: { subtotal: true },
          }),
        ]);
        const { password, refreshToken, ...safe } = v as any;
        return {
          ...safe,
          totalEvents: v._count.events,
          totalTicketsSold: ticketsSold._sum.sold ?? 0,
          totalRevenue: revenueKobo._sum.subtotal ?? 0,
          walletBalance: v.wallet?.balance ?? 0,
        };
      }),
    );

    return {
      data: vendorsWithStats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Admin: user management ─────────────────────────────────────────────────

  async getAdminUsers(query: {
    search?: string;
    role?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, role, page = 1, limit = 30 } = query;
    const skip = (page - 1) * limit;

    const where: any = { isDeleted: false };
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          username: true,
          phoneNumber: true,
          role: true,
          userTier: true,
          image: true,
          city: true,
          state: true,
          country: true,
          onboardingCompleted: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
              tickets: true,
              reservations: true,
              ecomOrders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Attach total spend per user
    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const [ticketSpend, reservationSpend] = await Promise.all([
          this.prisma.order.aggregate({
            where: { userId: u.id, status: 'PAID' },
            _sum: { total: true },
          }),
          this.prisma.reservationPayment.aggregate({
            where: {
              reservation: { userId: u.id },
              status: 'PAID',
            },
            _sum: { amount: true },
          }),
        ]);
        return {
          ...u,
          totalTicketOrders: u._count.orders,
          totalTickets: u._count.tickets,
          totalReservations: u._count.reservations,
          totalEcomOrders: u._count.ecomOrders,
          totalSpend:
            (ticketSpend._sum.total ?? 0) +
            (reservationSpend._sum.amount ?? 0),
        };
      }),
    );

    return {
      data: usersWithStats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAdminUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        admin: true,
        vendorProfile: true,
        venueOwnerProfile: {
          include: {
            venues: {
              where: { isDeleted: false },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true, name: true, slug: true, status: true,
                city: true, coverImage: true, category: true, createdAt: true,
                _count: { select: { reservations: true } },
              },
            },
          },
        },
        wallet: true,
        events: {
          orderBy: { createdAt: 'desc' },
          include: {
            ticketTiers: { select: { name: true, price: true, quantity: true, sold: true } },
            _count: { select: { orders: true } },
          },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            event: { select: { id: true, title: true, date: true, coverImage: true } },
            items: {
              include: { ticketTier: { select: { name: true, price: true } } },
            },
          },
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
          include: {
            orderItem: {
              include: {
                ticketTier: { select: { name: true } },
                order: {
                  include: {
                    event: { select: { title: true, date: true, coverImage: true } },
                  },
                },
              },
            },
          },
        },
        reservations: {
          orderBy: { createdAt: 'desc' },
          include: {
            venue: { select: { id: true, name: true, coverImage: true, city: true } },
            payment: true,
          },
        },
        ecomOrders: {
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [ticketSpend, reservationSpend, eventRevenue] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: id, status: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.reservationPayment.aggregate({
        where: { reservation: { userId: id }, status: 'PAID' },
        _sum: { amount: true },
      }),
      // For vendors: revenue from events they created
      this.prisma.order.aggregate({
        where: { event: { createdById: id }, status: 'PAID' },
        _sum: { subtotal: true },
      }),
    ]);

    const { password, refreshToken, resetOTP, verificationCode, ...safe } =
      user as any;

    // Attach per-event revenue for vendor events
    const eventsWithRevenue = await Promise.all(
      (user.events ?? []).map(async (evt: any) => {
        const rev = await this.prisma.order.aggregate({
          where: { eventId: evt.id, status: 'PAID' },
          _sum: { subtotal: true },
        });
        const totalSold = evt.ticketTiers.reduce((s: number, t: any) => s + t.sold, 0);
        const totalCapacity = evt.ticketTiers.reduce((s: number, t: any) => s + t.quantity, 0);
        return { ...evt, totalRevenue: rev._sum.subtotal ?? 0, totalSold, totalCapacity };
      }),
    );

    return {
      ...safe,
      events: eventsWithRevenue,
      totalTicketOrders: user.orders.length,
      totalTickets: user.tickets.length,
      totalReservations: user.reservations.length,
      totalEcomOrders: user.ecomOrders.length,
      totalSpend:
        (ticketSpend._sum.total ?? 0) + (reservationSpend._sum.amount ?? 0),
      vendorTotalRevenue: eventRevenue._sum.subtotal ?? 0,
      walletBalance: (user as any).wallet?.balance ?? null,
    };
  }

  async adminCreateVenueOwnerProfile(
    userId: string,
    dto: { businessName: string; businessEmail?: string; businessPhone?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.venueOwnerProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('This user already has a venue owner profile');

    const [profile] = await this.prisma.$transaction([
      this.prisma.venueOwnerProfile.create({
        data: { userId, businessName: dto.businessName, businessEmail: dto.businessEmail, businessPhone: dto.businessPhone },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: 'VENUE_OWNER' },
      }),
    ]);

    return profile;
  }

  // ── Team Management (SUPER_ADMIN only) ────────────────────────────────────

  async getTeam() {
    const admins = await this.prisma.admin.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            username: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return admins;
  }

  async searchUsersForTeam(query: string) {
    // Find users who are NOT already admins
    const existingAdminUserIds = await this.prisma.admin
      .findMany({ select: { userId: true } })
      .then((admins) => admins.map((a) => a.userId));

    return this.prisma.user.findMany({
      where: {
        AND: [
          { id: { notIn: existingAdminUserIds } },
          {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        image: true,
        username: true,
      },
      take: 10,
    });
  }

  async addTeamMember(
    dto: { userId: string; position: string; modules?: string[] },
    currentAdminUserId: string,
  ) {
    const existing = await this.prisma.admin.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('This user is already an admin');
    }

    // Prevent adding as SUPER_ADMIN via this endpoint
    if (dto.position === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot assign SUPER_ADMIN via this endpoint');
    }

    return this.prisma.admin.create({
      data: {
        userId: dto.userId,
        position: dto.position as any,
        modules: dto.modules ?? [],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            username: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async updateTeamMember(
    adminId: string,
    dto: { position?: string; modules?: string[] },
    currentAdminUserId: string,
  ) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Team member not found');
    if (admin.position === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot modify a SUPER_ADMIN');
    }
    if (dto.position === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot promote to SUPER_ADMIN via this endpoint');
    }

    return this.prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(dto.position && { position: dto.position as any }),
        ...(dto.modules !== undefined && { modules: dto.modules }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            username: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async removeTeamMember(adminId: string, currentAdminUserId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Team member not found');
    if (admin.position === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot remove a SUPER_ADMIN');
    }
    // Prevent self-removal (shouldn't happen since SUPER_ADMIN can't be removed, but safety check)
    if (admin.userId === currentAdminUserId) {
      throw new ForbiddenException('Cannot remove yourself');
    }

    await this.prisma.admin.delete({ where: { id: adminId } });
    return { message: 'Team member removed' };
  }
}
