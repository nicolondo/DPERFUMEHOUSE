import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@dperfumehouse/config';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ODOO_SYNC },
      { name: QUEUE_NAMES.PAYMENT_PROCESS },
      { name: QUEUE_NAMES.EMAIL_SEND },
      { name: QUEUE_NAMES.IMAGE_PROCESS },
      { name: QUEUE_NAMES.COMMISSION_CALC },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
