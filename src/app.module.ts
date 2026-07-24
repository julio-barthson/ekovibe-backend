import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { OrdersModule } from './orders/orders.module';
import { UploadModule } from './upload/upload.module';
import { MembershipModule } from './membership/membership.module';
import { WalletModule } from './wallet/wallet.module';
import { ReservationsModule } from './reservations/reservations.module';
import { MediaModule } from './media/media.module';
import { VaultModule } from './vault/vault.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { GuestsModule } from './guests/guests.module';
import { SettlementModule } from './settlement/settlement.module';
import { ContactsModule } from './contacts/contacts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    EventsModule,
    OrdersModule,
    UploadModule,
    MembershipModule,
    WalletModule,
    ReservationsModule,
    MediaModule,
    VaultModule,
    NewsletterModule,
    GuestsModule,
    SettlementModule,
    ContactsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
