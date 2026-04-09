import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnviaService } from './envia.service';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { SettingsModule } from '../settings/settings.module';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [
    SettingsModule,
    OdooModule,
    BullModule.registerQueue({ name: 'email-send' }),
  ],
  controllers: [ShippingController, ShippingWebhookController],
  providers: [EnviaService, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
