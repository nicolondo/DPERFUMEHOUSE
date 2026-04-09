import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnviaService } from './envia.service';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { SettingsModule } from '../settings/settings.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    SettingsModule,
    PushModule,
    BullModule.registerQueue({ name: 'email-send' }),
  ],
  controllers: [ShippingController, ShippingWebhookController],
  providers: [EnviaService, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
