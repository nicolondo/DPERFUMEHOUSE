import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProviderFactory } from './payment-provider.factory';
import { WompiWebhookEvent } from './wompi.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface WebhookData {
  customerOrderId: string;
  status: string;
  dateTime: string;
  amount: number;
  currency: string;
  signature: string;
  fullUrl: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly successUrl: string;
  private readonly failureUrl: string;
  private readonly webhookApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue('payment-process')
    private readonly paymentQueue: Queue,
  ) {
    const sellerUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000');
    this.successUrl = this.configService.get<string>(
      'PAYMENT_SUCCESS_URL',
      `${sellerUrl}/orders/{{orderId}}?payment=success`,
    );
    this.failureUrl = this.configService.get<string>(
      'PAYMENT_FAILURE_URL',
      `${sellerUrl}/orders/{{orderId}}?payment=failed`,
    );
    this.webhookApiKey = this.configService.get<string>(
      'MYXSPEND_API_KEY',
      '',
    );
  }

  async createPaymentLink(orderId: string, sellerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { variant: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.sellerId !== sellerId) {
      throw new ForbiddenException('You do not own this order');
    }

    if (order.status !== 'DRAFT' && order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        `Cannot create payment link for order in status ${order.status}`,
      );
    }

    // Check if there's already an active payment link - always regenerate
    // to avoid "Link de pago no disponible" errors when Wompi deactivates
    // a link on their side (e.g. after a sandbox test approval)
    const existingLink = await this.prisma.paymentLink.findUnique({
      where: { orderId },
    });

    // Parse customer name into first/last
    const nameParts = order.customer.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // Get the active payment provider
    const { provider, name: providerName } = await this.providerFactory.getActiveProvider();

    const successUrl = this.successUrl.replace('{{orderId}}', order.id) + `&order=${order.orderNumber}`;
    const failureUrl = this.failureUrl.replace('{{orderId}}', order.id) + `&order=${order.orderNumber}`;

    const result = await provider.createPaymentLink({
      orderId: order.id,
      amount: Number(order.total),
      currency: 'COP',
      customerEmail: order.customer.email || '',
      customerFirstName: firstName,
      customerLastName: lastName,
      customerPhone: order.customer.phone || undefined,
      successUrl,
      failureUrl,
    });

    // Upsert payment link record
    const paymentLink = existingLink
      ? await this.prisma.paymentLink.update({
          where: { id: existingLink.id },
          data: {
            externalId: result.externalId,
            url: result.url,
            amount: order.total,
            currency: 'COP',
            provider: providerName,
            status: 'ACTIVE',
            metadata: { code: result.code },
          },
        })
      : await this.prisma.paymentLink.create({
          data: {
            orderId: order.id,
            externalId: result.externalId,
            url: result.url,
            amount: order.total,
            currency: 'COP',
            provider: providerName,
            status: 'ACTIVE',
            metadata: { code: result.code },
          },
        });

    // Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
      },
    });

    this.logger.log(
      `Payment link created for order ${order.orderNumber}: ${result.url}`,
    );

    return { paymentLink, paymentUrl: result.url };
  }

  async handleWebhook(data: WebhookData): Promise<void> {
    const {
      customerOrderId,
      status,
      dateTime,
      amount,
      currency,
      signature,
      fullUrl,
    } = data;

    // Verify signature using MyxSpend provider
    const myxSpendProvider = this.providerFactory.getProviderByName('myxspend');
    const isValid = myxSpendProvider.verifyWebhookSignature(
      fullUrl,
      signature,
      this.webhookApiKey,
    );

    if (!isValid) {
      this.logger.error(
        `Invalid webhook signature for order ${customerOrderId}`,
      );
      throw new ForbiddenException('Invalid webhook signature');
    }

    // Find the payment link by orderId (customerOrderId is the order UUID)
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { orderId: customerOrderId },
      include: { order: true },
    });

    if (!paymentLink) {
      this.logger.error(
        `Payment link not found for order ${customerOrderId}`,
      );
      throw new NotFoundException(
        `Payment link not found for order ${customerOrderId}`,
      );
    }

    // Create payment event
    await this.prisma.paymentEvent.create({
      data: {
        paymentLinkId: paymentLink.id,
        eventType: 'webhook',
        status,
        amount,
        currency,
        rawPayload: data as any,
        processedAt: new Date(),
      },
    });

    const normalizedStatus = status.toUpperCase();

    if (
      normalizedStatus === 'SUCCESSFUL' ||
      normalizedStatus === 'SUCCESS' ||
      normalizedStatus === 'COMPLETED'
    ) {
      // Update payment link
      await this.prisma.paymentLink.update({
        where: { id: paymentLink.id },
        data: { status: 'COMPLETED' },
      });

      // Update order
      await this.prisma.order.update({
        where: { id: paymentLink.orderId },
        data: {
          status: 'PAID',
          paymentStatus: 'COMPLETED',
        },
      });

      // Queue Odoo confirmation + commission calculation
      await this.paymentQueue.add(
        'payment-confirmed',
        {
          orderId: paymentLink.orderId,
          amount,
          currency,
          paidAt: dateTime,
        },
        {
          removeOnComplete: 10,
          removeOnFail: 20,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      // Push notification
      this.notificationsService.notifyPaymentReceived(
        paymentLink.order.sellerId,
        paymentLink.order.orderNumber,
        `$${Number(paymentLink.order.total).toLocaleString('es-CO')}`,
      ).catch((err) => this.logger.error(`Push notify failed: ${err.message}`));

      this.logger.log(
        `Payment confirmed for order ${paymentLink.order.orderNumber}`,
      );
    } else if (
      normalizedStatus === 'FAILED' ||
      normalizedStatus === 'DECLINED'
    ) {
      await this.prisma.paymentLink.update({
        where: { id: paymentLink.id },
        data: { status: 'FAILED' },
      });

      await this.prisma.order.update({
        where: { id: paymentLink.orderId },
        data: { paymentStatus: 'FAILED' },
      });

      this.logger.warn(
        `Payment failed for order ${paymentLink.order.orderNumber}`,
      );
    } else {
      this.logger.log(
        `Received webhook status "${status}" for order ${paymentLink.order.orderNumber}`,
      );
    }
  }

  async getPaymentStatus(orderId: string) {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { orderId },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!paymentLink) {
      throw new NotFoundException(
        `No payment link found for order ${orderId}`,
      );
    }

    return {
      status: paymentLink.status,
      url: paymentLink.url,
      provider: paymentLink.provider,
      events: paymentLink.events,
    };
  }

  /**
   * Handle Wompi webhook event (POST).
   * Wompi sends transaction.updated events when payment status changes.
   */
  async handleWompiWebhook(eventBody: WompiWebhookEvent): Promise<void> {
    const { event, data, timestamp } = eventBody;

    this.logger.log(
      `Received Wompi webhook: ${event}, transaction: ${data?.transaction?.id}, status: ${data?.transaction?.status}`,
    );

    // Verify checksum
    const eventsSecret = await this.settingsService.get('wompi_events_secret');
    if (!eventsSecret) {
      this.logger.error('Wompi events secret not configured');
      throw new ForbiddenException('Wompi events secret not configured');
    }

    const wompiService = this.providerFactory.getWompiService();
    const isValid = wompiService.verifyEventChecksum(eventBody, eventsSecret);

    if (!isValid) {
      this.logger.error('Invalid Wompi webhook checksum');
      throw new ForbiddenException('Invalid Wompi webhook checksum');
    }

    const transaction = data?.transaction;
    if (!transaction) {
      this.logger.warn('Wompi webhook missing transaction data');
      return;
    }

    // Find payment link by payment_link_id or by reference
    type PaymentLinkWithOrder = Awaited<ReturnType<typeof this.prisma.paymentLink.findFirst<{ include: { order: true } }>>>;
    let paymentLink: PaymentLinkWithOrder = null;

    if (transaction.payment_link_id) {
      paymentLink = await this.prisma.paymentLink.findFirst({
        where: { externalId: transaction.payment_link_id },
        include: { order: true },
      });
    }

    if (!paymentLink) {
      // Try finding by reference which may contain the orderId
      const reference = transaction.reference || '';
      // Wompi payment link transactions include the link ID as reference
      paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          provider: 'wompi',
          externalId: reference,
        },
        include: { order: true },
      });
    }

    if (!paymentLink) {
      this.logger.error(
        `Payment link not found for Wompi transaction ${transaction.id}`,
      );
      // Don't throw - return 200 to avoid Wompi retries for unknown transactions
      return;
    }

    // Create payment event
    await this.prisma.paymentEvent.create({
      data: {
        paymentLinkId: paymentLink.id,
        eventType: event,
        status: transaction.status,
        amount: transaction.amount_in_cents
          ? transaction.amount_in_cents / 100
          : null,
        currency: transaction.currency || 'COP',
        rawPayload: eventBody as any,
        processedAt: new Date(),
      },
    });

    const wompiStatus = transaction.status?.toUpperCase();

    if (wompiStatus === 'APPROVED') {
      await this.prisma.paymentLink.update({
        where: { id: paymentLink.id },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.order.update({
        where: { id: paymentLink.orderId },
        data: {
          status: 'PAID',
          paymentStatus: 'COMPLETED',
        },
      });

      // Queue Odoo confirmation + commission calculation
      await this.paymentQueue.add(
        'payment-confirmed',
        {
          orderId: paymentLink.orderId,
          amount: transaction.amount_in_cents
            ? transaction.amount_in_cents / 100
            : Number(paymentLink.amount),
          currency: transaction.currency || 'COP',
          paidAt: new Date(timestamp).toISOString(),
        },
        {
          removeOnComplete: 10,
          removeOnFail: 20,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      // Push notification
      this.notificationsService.notifyPaymentReceived(
        paymentLink.order.sellerId,
        paymentLink.order.orderNumber,
        `$${Number(paymentLink.order.total).toLocaleString('es-CO')}`,
      ).catch((err) => this.logger.error(`Push notify failed: ${err.message}`));

      this.logger.log(
        `Wompi payment APPROVED for order ${paymentLink.order.orderNumber}`,
      );
    } else if (
      wompiStatus === 'DECLINED' ||
      wompiStatus === 'VOIDED' ||
      wompiStatus === 'ERROR'
    ) {
      await this.prisma.paymentLink.update({
        where: { id: paymentLink.id },
        data: { status: 'FAILED' },
      });

      await this.prisma.order.update({
        where: { id: paymentLink.orderId },
        data: { paymentStatus: 'FAILED' },
      });

      this.logger.warn(
        `Wompi payment ${wompiStatus} for order ${paymentLink.order.orderNumber}`,
      );
    } else {
      this.logger.log(
        `Received Wompi status "${transaction.status}" for order ${paymentLink.order.orderNumber}`,
      );
    }
  }
}
