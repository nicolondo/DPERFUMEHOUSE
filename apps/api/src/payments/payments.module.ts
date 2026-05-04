import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MyxSpendService } from './myxspend.service';
import { WompiService } from './wompi.service';
import { MonabitService } from './monabit.service';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentsProcessor } from './payments.processor';
import { OdooModule } from '../odoo/odoo.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    OdooModule,
    CommissionsModule,
    EmailModule,
    BullModule.registerQueue({
      name: 'payment-process',
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MyxSpendService,
    WompiService,
    MonabitService,
    PaymentProviderFactory,
    PaymentsProcessor,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
