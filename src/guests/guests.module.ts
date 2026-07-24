import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { TermiiService } from './termii.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { AdminGuard } from 'src/guards/admin.guard';
import { ContactsModule } from 'src/contacts/contacts.module';
import { ContactsService } from 'src/contacts/contacts.service';

@Module({
  imports: [AuthModule, ScheduleModule.forRoot(), ContactsModule],
  controllers: [GuestsController],
  providers: [GuestsService, TermiiService, PrismaService, AdminGuard, ContactsService],
  exports: [GuestsService],
})
export class GuestsModule {}
