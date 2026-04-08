import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersPublicController } from './orders-public.controller';
import { OrdersService } from './orders.service';
import { PaymentSyncService } from './payment-sync.service';
import { OdooModule } from '../odoo/odoo.module';
import { PaymentsModule } from '../payments/payments.module';
import { EmailModule } from '../email/email.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [
    OdooModule,
    PaymentsModule,
    EmailModule,
    CommissionsModule,
    BullModule.registerQueue({
      name: 'email-send',
    }),
  ],
  controllers: [OrdersPublicController, OrdersController],
  providers: [OrdersService, PaymentSyncService],
  exports: [OrdersService],
})
export class OrdersModule {}
