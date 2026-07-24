import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from 'src/decorators/public.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/guards/admin.guard';
import { GuestsService } from './guests.service';
import { ImportGuestsDto } from './dto/import-guests.dto';
import { SubmitRsvpDto } from './dto/submit-rsvp.dto';
import { AddGuestDto } from './dto/add-guest.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SubmitRequestDto } from './dto/submit-request.dto';

@Controller()
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  // ── Public RSVP ───────────────────────────────────────────────────────────

  @Public()
  @Get('rsvp/:token')
  getRsvp(@Param('token') token: string) {
    return this.guestsService.getRsvpByToken(token);
  }

  @Public()
  @Post('rsvp/:token')
  submitRsvp(@Param('token') token: string, @Body() dto: SubmitRsvpDto) {
    return this.guestsService.submitRsvp(token, dto);
  }

  // ── NDPA ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('rsvp/forget/:token')
  forgetMe(@Param('token') token: string) {
    return this.guestsService.forgetMe(token);
  }

  @Public()
  @Get('rsvp/data/:token')
  getMyData(@Param('token') token: string) {
    return this.guestsService.getMyData(token);
  }

  // ── Public: Request to Attend ─────────────────────────────────────────────

  @Public()
  @Post('events/:slug/request-access')
  submitRequest(@Param('slug') slug: string, @Body() dto: SubmitRequestDto) {
    return this.guestsService.submitRequest(slug, dto);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/guests/import')
  importGuests(@Body() dto: ImportGuestsDto) {
    return this.guestsService.importGuests(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/guests/add')
  addGuest(@Body() dto: AddGuestDto) {
    return this.guestsService.addGuest(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/guests/:eventId/send-invites')
  sendInvites(@Param('eventId') eventId: string) {
    return this.guestsService.sendInvites(eventId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/guests/:eventId/test-invite')
  testSend(
    @Param('eventId') eventId: string,
    @Body() dto: { email: string; phone?: string },
  ) {
    return this.guestsService.testSend(eventId, { email: dto.email, phone: dto.phone ?? '' });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/guests/:eventId/send-followup')
  sendFollowUp(@Param('eventId') eventId: string) {
    return this.guestsService.sendFollowUpNow(eventId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('a/guests/:eventId')
  getGuests(
    @Param('eventId') eventId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.guestsService.getGuests(eventId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('a/guests/:eventId/export')
  async exportGuests(@Param('eventId') eventId: string, @Res() res: Response) {
    const csv = await this.guestsService.exportGuests(eventId);
    const filename = `guests-${eventId}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('a/guests/:eventId/config')
  getConfig(@Param('eventId') eventId: string) {
    return this.guestsService.getConfig(eventId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('a/guests/:eventId/config')
  updateConfig(@Param('eventId') eventId: string, @Body() dto: UpdateConfigDto) {
    return this.guestsService.updateConfig(eventId, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/guests/resend/:guestId')
  resendInvite(@Param('guestId') guestId: string) {
    return this.guestsService.resendInvite(guestId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('a/guests/:guestId')
  deleteGuest(@Param('guestId') guestId: string) {
    return this.guestsService.deleteGuest(guestId);
  }

  // ── Admin: Attendance Requests ────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('a/requests/:eventId')
  getRequests(
    @Param('eventId') eventId: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    return this.guestsService.getRequests(eventId, {
      page: page ? Number(page) : undefined,
      status,
    });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/requests/:requestId/approve')
  approveRequest(@Param('requestId') requestId: string) {
    return this.guestsService.approveRequest(requestId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('a/requests/:requestId/decline')
  declineRequest(@Param('requestId') requestId: string) {
    return this.guestsService.declineRequest(requestId);
  }
}
