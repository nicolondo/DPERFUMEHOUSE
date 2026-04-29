import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller('webhooks')
export class ShippingWebhookController {
  constructor(private shippingService: ShippingService) {}

  @Post('envia')
  @HttpCode(200)
  async handleEnviaWebhook(@Body() payload: any) {
    // Respond immediately, process async
    this.shippingService.handleWebhook(payload).catch(() => {});
    return { received: true };
  }

  @Post('mensajeros-urbanos')
  @HttpCode(200)
  async handleMUWebhook(@Body() payload: any) {
    this.shippingService.handleMUWebhook(payload).catch(() => {});
    return { received: true };
  }
}
