import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { AdminGuard } from 'src/guards/admin.guard';

@Module({
  imports: [AuthModule],
  controllers: [ContactsController],
  providers: [ContactsService, PrismaService, AdminGuard],
  exports: [ContactsService],
})
export class ContactsModule {}
