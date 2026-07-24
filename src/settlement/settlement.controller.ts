import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/guards/admin.guard';
import { SettlementService } from './settlement.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('a/settlements')
export class SettlementController {
  constructor(private readonly service: SettlementService) {}

  @Get()
  getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });
  }

  @Get(':eventId')
  getByEvent(@Param('eventId') eventId: string) {
    return this.service.getByEvent(eventId);
  }

  @Post(':eventId/generate')
  generate(@Param('eventId') eventId: string) {
    return this.service.generate(eventId);
  }

  @Patch(':eventId/mark-paid')
  markPaid(
    @Param('eventId') eventId: string,
    @Body() dto: { accountName?: string; accountNumber?: string; bankName?: string; notes?: string },
  ) {
    return this.service.markPaid(eventId, dto);
  }

  @Patch(':eventId/bank-details')
  updateBankDetails(
    @Param('eventId') eventId: string,
    @Body() dto: { accountName?: string; accountNumber?: string; bankName?: string; notes?: string },
  ) {
    return this.service.updateBankDetails(eventId, dto);
  }
}
