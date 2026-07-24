import { Module } from '@nestjs/common';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { AdminGuard } from 'src/guards/admin.guard';

@Module({
  imports: [AuthModule],
  controllers: [SettlementController],
  providers: [SettlementService, PrismaService, AdminGuard],
  exports: [SettlementService],
})
export class SettlementModule {}
