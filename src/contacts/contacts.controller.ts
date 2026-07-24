import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/guards/admin.guard';
import { ContactsService } from './contacts.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('a/contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.service.getAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      tag,
    });
  }

  @Get('export')
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { tags?: string[]; notes?: string; name?: string; phone?: string },
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('import-to-event')
  importToEvent(@Body() dto: { eventId: string; contactIds: string[] }) {
    return this.service.importToEvent(dto.eventId, dto.contactIds);
  }
}
