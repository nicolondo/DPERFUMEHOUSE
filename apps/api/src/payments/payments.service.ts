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
import { WompiService, WompiWebhookEvent } from './wompi.service';
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
    private readonly wompiService: WompiService,
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

    // Platform URL — always point customers to our own payment page
    const sellerUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000');
    const platformUrl = `${sellerUrl}/pay/${order.orderNumber}`;

    // Upsert payment link record — store platform URL, keep provider URL in metadata
    const paymentLink = existingLink
      ? await this.prisma.paymentLink.update({
          where: { id: existingLink.id },
          data: {
            externalId: result.externalId,
            url: platformUrl,
            amount: order.total,
            currency: 'COP',
            provider: providerName,
            status: 'ACTIVE',
            metadata: { code: result.code, providerUrl: result.url },
          },
        })
      : await this.prisma.paymentLink.create({
          data: {
            orderId: order.id,
            externalId: result.externalId,
            url: platformUrl,
            amount: order.total,
            currency: 'COP',
            provider: providerName,
            status: 'ACTIVE',
            metadata: { code: result.code, providerUrl: result.url },
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
      `Payment link created for order ${order.orderNumber}: ${platformUrl}`,
    );

    return { paymentLink, paymentUrl: platformUrl };
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
      // Reference can be the orderId (UUID) or the payment link ID
      paymentLink = await this.prisma.paymentLink.findFirst({
        where: {
          provider: 'wompi',
          OR: [
            { externalId: reference },
            { orderId: reference },
          ],
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

  /* ---------------------------------------------------------------- */
  /*  Wompi widget & direct payment methods                            */
  /* ---------------------------------------------------------------- */

  private async findOrderByIdOrNumber(idOrNumber: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrNumber,
      );

    // Normalize: if not UUID and missing PH- prefix, try both variants
    const candidates: string[] = isUuid
      ? []
      : [
          idOrNumber,
          idOrNumber.startsWith('PH-') ? idOrNumber : `PH-${idOrNumber}`,
        ].filter((v, i, arr) => arr.indexOf(v) === i);

    const include = {
      customer: true,
      items: {
        include: {
          variant: { include: { images: true } },
        },
      },
    };

    const order = isUuid
      ? await this.prisma.order.findFirst({ where: { id: idOrNumber }, include })
      : await this.prisma.order.findFirst({
          where: { orderNumber: { in: candidates } },
          include,
        });

    if (!order) {
      throw new NotFoundException(`Order ${idOrNumber} not found`);
    }

    return order;
  }

  async getWidgetConfig(orderId: string) {
    const order = await this.findOrderByIdOrNumber(orderId);
    const sellerUrl = this.configService.get<string>(
      'SELLER_APP_URL',
      'http://localhost:3000',
    );

    const amountInCents = Math.round(Number(order.total) * 100);
    const currency = 'COP';
    const reference = order.orderNumber;
    const redirectUrl = `${sellerUrl}/pay/${order.orderNumber}`;

    const publicKey = await this.wompiService.getPublicKey();
    const signature = await this.wompiService.generateSignature(
      reference,
      amountInCents,
      currency,
    );

    return {
      publicKey,
      amountInCents,
      reference,
      currency,
      redirectUrl,
      signature,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        customerPhone: order.customer.phone || '',
        total: Number(order.total),
        items: order.items.map((item) => {
          const primaryImg = item.variant.images?.find((img) => img.isPrimary) || item.variant.images?.[0];
          return {
            productName: item.variant.name,
            quantity: item.quantity,
            price: Number(item.unitPrice),
            imageUrl: primaryImg?.thumbnailUrl || primaryImg?.url || undefined,
          };
        }),
      },
    };
  }

  async getWompiPublicData(orderId: string) {
    const order = await this.findOrderByIdOrNumber(orderId);
    const publicKey = await this.wompiService.getPublicKey();
    const { acceptanceToken, permalink } =
      await this.wompiService.getAcceptanceToken();

    const amountInCents = Math.round(Number(order.total) * 100);

    return {
      publicKey,
      amountInCents,
      reference: order.orderNumber,
      currency: 'COP',
      acceptanceToken,
      permalink,
      orderId: order.id,
    };
  }

  async getPseBanks() {
    const banks = await this.wompiService.getPseBanks();
    return { data: banks };
  }

  async createDirectTransaction(
    orderId: string,
    body: {
      paymentMethod: string;
      acceptanceToken: string;
      token?: string;
      installments?: number;
      customerEmail?: string;
      phoneNumber?: string;
      financialInstitutionCode?: string;
      userType?: number;
      userLegalIdType?: string;
      userLegalId?: string;
      documentType?: string;
      documentNumber?: string;
    },
  ) {
    const order = await this.findOrderByIdOrNumber(orderId);

    const amountInCents = Math.round(Number(order.total) * 100);
    const currency = 'COP';
    // Wompi requires unique reference per transaction attempt — append timestamp suffix
    const reference = `${order.orderNumber}-${Date.now()}`;
    const sellerUrl = this.configService.get<string>(
      'SELLER_APP_URL',
      'http://localhost:3000',
    );
    const redirectUrl = `${sellerUrl}/pay/${order.orderNumber}`;

    const signature = await this.wompiService.generateSignature(
      reference,
      amountInCents,
      currency,
    );

    let paymentMethodPayload: Record<string, any>;

    switch (body.paymentMethod) {
      case 'CARD':
        paymentMethodPayload = {
          type: 'CARD',
          token: body.token,
          installments: body.installments || 1,
        };
        break;
      case 'NEQUI':
        paymentMethodPayload = {
          type: 'NEQUI',
          phone_number: body.phoneNumber,
        };
        break;
      case 'PSE': {
        const b = body as any;
        const instCode = body.financialInstitutionCode || b.financial_institution_code;
        const uType = parseInt(String(body.userType ?? b.user_type ?? 0), 10);
        const uIdType = body.userLegalIdType || b.user_legal_id_type || 'CC';
        const uId = body.userLegalId || b.user_legal_id || '';
        paymentMethodPayload = {
          type: 'PSE',
          user_type: uType,
          user_legal_id_type: uIdType,
          user_legal_id: uId,
          financial_institution_code: instCode,
          payment_description: `Pago pedido ${reference}`.substring(0, 64),
        };
        break;
      }      case 'BANCOLOMBIA_TRANSFER':
        paymentMethodPayload = {
          type: 'BANCOLOMBIA_TRANSFER',
          user_type: 'PERSON',
          payment_description: `Pago pedido ${reference}`,
        };
        break;
      case 'BANCOLOMBIA_COLLECT':
        paymentMethodPayload = {
          type: 'BANCOLOMBIA_COLLECT',
          payment_description: `Pago pedido ${reference}`,
        };
        break;
      case 'DAVIPLATA':
        paymentMethodPayload = {
          type: 'DAVIPLATA',
          phone_number: body.phoneNumber,
          document_type: body.documentType || 'CC',
          document_number: body.documentNumber || '',
        };
        break;
      default:
        throw new BadRequestException(
          `Unsupported payment method: ${body.paymentMethod}`,
        );
    }

    const customerEmail =
      body.customerEmail || order.customer?.email || '';

    const customerData =
      body.paymentMethod === 'PSE'
        ? {
            full_name: order.customer?.name || '',
            phone_number: (order.customer as any)?.phone || '',
          }
        : undefined;

    const result = await this.wompiService.createTransaction({
      amountInCents,
      currency,
      reference,
      customerEmail,
      acceptanceToken: body.acceptanceToken,
      signature,
      paymentMethod: paymentMethodPayload,
      redirectUrl,
      customerData,
    });

    // Store a reference in our system
    await this.prisma.paymentLink.upsert({
      where: { orderId: order.id },
      update: {
        externalId: result.id,
        provider: 'wompi',
        status: 'ACTIVE',
        metadata: {
          wompiTransactionId: result.id,
          method: body.paymentMethod,
        },
      },
      create: {
        orderId: order.id,
        externalId: result.id,
        amount: order.total,
        currency,
        provider: 'wompi',
        status: 'ACTIVE',
        metadata: {
          wompiTransactionId: result.id,
          method: body.paymentMethod,
        },
      },
    });

    // Update order status
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
      },
    });

    return { data: result };
  }

  async getWompiTransactionStatus(
    orderId: string,
    transactionId: string,
  ) {
    if (!transactionId) {
      throw new BadRequestException('transactionId is required');
    }

    const result =
      await this.wompiService.getTransactionStatus(transactionId);

    // Update local records if terminal status
    const status = result.status?.toUpperCase();
    if (
      status === 'APPROVED' ||
      status === 'DECLINED' ||
      status === 'ERROR' ||
      status === 'VOIDED'
    ) {
      const order = await this.findOrderByIdOrNumber(orderId);

      if (status === 'APPROVED') {
        await this.prisma.paymentLink.updateMany({
          where: { orderId: order.id },
          data: { status: 'COMPLETED' },
        });

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paymentStatus: 'COMPLETED',
          },
        });

        await this.paymentQueue.add(
          'payment-confirmed',
          {
            orderId: order.id,
            amount: Number(order.total),
            currency: 'COP',
            paidAt: new Date().toISOString(),
          },
          {
            removeOnComplete: 10,
            removeOnFail: 20,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );

        this.notificationsService.notifyPaymentReceived(
          order.sellerId,
          order.orderNumber,
          `$${Number(order.total).toLocaleString('es-CO')}`,
        ).catch((err) => this.logger.error(`Push notify failed: ${err.message}`));

        this.logger.log(
          `Wompi payment APPROVED for order ${order.orderNumber}`,
        );
      } else {
        await this.prisma.paymentLink.updateMany({
          where: { orderId: order.id },
          data: { status: 'FAILED' },
        });

        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'FAILED' },
        });

        this.logger.warn(
          `Wompi payment ${status} for order ${order.orderNumber}`,
        );
      }
    }

    return {
      status: result.status,
      id: result.id,
      asyncPaymentUrl: result.payment_method?.extra?.async_payment_url || null,
      collectReference:
        result.payment_method?.type === 'BANCOLOMBIA_COLLECT' &&
        result.payment_method?.extra?.business_agreement_code
          ? {
              businessAgreementCode:
                result.payment_method.extra.business_agreement_code,
              paymentIntentionIdentifier:
                result.payment_method.extra.payment_intention_identifier,
            }
          : null,
    };
  }
}
