import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreateDirectTransactionDto } from './dto/create-direct-transaction.dto';

class CreatePaymentLinkBodyDto {
  orderId: string;
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-link')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPaymentLink(
    @Body() body: CreatePaymentLinkBodyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentsService.createPaymentLink(body.orderId, user.sub);
  }

  /**
   * MyxSpend webhook callback - GET request with query params:
   * customerOrderId, status, dateTime, amount, currency
   * Signature in X-Signature header
   */
  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Query('customerOrderId') customerOrderId: string,
    @Query('status') status: string,
    @Query('dateTime') dateTime: string,
    @Query('amount') amount: string,
    @Query('currency') currency: string,
    @Headers('x-signature') signature: string,
  ) {
    this.logger.log(
      `Received payment webhook for order ${customerOrderId}, status: ${status}`,
    );

    // Reconstruct the full URL for signature verification
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    await this.paymentsService.handleWebhook({
      customerOrderId,
      status,
      dateTime,
      amount: parseFloat(amount),
      currency,
      signature,
      fullUrl,
    });

    return { received: true };
  }

  @Get(':orderId/status')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.getPaymentStatus(orderId);
  }

  /**
   * Wompi webhook - POST request with JSON body containing event data.
   * Wompi sends transaction.updated events when payment status changes.
   */
  @Post('wompi-webhook')
  @HttpCode(HttpStatus.OK)
  async handleWompiWebhook(@Body() body: any) {
    this.logger.log(
      `Received Wompi webhook: ${body?.event}, transaction: ${body?.data?.transaction?.id}`,
    );

    await this.paymentsService.handleWompiWebhook(body);

    return { received: true };
  }

  /**
   * Public endpoint: get Wompi widget config for an order.
   * Returns public key, reference, amount, integrity signature,
   * and pre-filled customer/shipping data.
   */
  @Get('widget-config/:orderId')
  async getWidgetConfig(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.getWidgetConfig(orderId);
  }

  /**
   * Public endpoint: get Wompi public key + acceptance token for an order.
   * Frontend uses the acceptance_token in the direct-transaction body.
   */
  @Get('wompi-public-data/:orderId')
  async getWompiPublicData(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.getWompiPublicData(orderId);
  }

  /**
   * Public endpoint: return the cached list of PSE financial institutions.
   */
  @Get('pse/banks')
  async getPseBanks() {
    return this.paymentsService.getPseBanks();
  }

  /**
   * Public endpoint: create a direct Wompi transaction for an order.
   * Supports CARD, PSE, NEQUI, BANCOLOMBIA_TRANSFER, BANCOLOMBIA_COLLECT, DAVIPLATA.
   */
  @Post('direct-transaction/:orderId')
  @HttpCode(HttpStatus.CREATED)
  async createDirectTransaction(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateDirectTransactionDto,
  ) {
    return this.paymentsService.createDirectTransaction(orderId, dto);
  }

  /**
   * Public endpoint: poll current transaction status for an order.
   * Proxies to Wompi API — use for NEQUI polling and post-redirect status checks.
   */
  @Get('transaction-status/:orderId')
  async getTransactionStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.pollTransactionStatus(orderId);
  }
}
