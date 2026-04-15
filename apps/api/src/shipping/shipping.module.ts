import { Module } from '@nestjs/common';
import { EnviaService } from './envia.service';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { ShippingTrackingScheduler } from './shipping-tracking.scheduler';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [ShippingController, ShippingWebhookController],
  providers: [EnviaService, ShippingService, ShippingTrackingScheduler],
  exports: [ShippingService],
})
export class ShippingModule {}
