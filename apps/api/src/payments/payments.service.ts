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
import { WompiWebhookEvent, WompiService, WompiTransactionPayload } from './wompi.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { CreateDirectTransactionDto } from './dto/create-direct-transaction.dto';

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
    private readonly wompiService: WompiService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
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
      // Widget-based transactions: reference format is "PH-YYYYMMDD-XXXX-N"
      // Extract orderNumber by removing the last "-N" segment
      const reference = transaction.reference || '';
      const orderNumberMatch = reference.match(/^(PH-\d{8}-\d{4})/);
      if (orderNumberMatch) {
        const order = await this.prisma.order.findFirst({
          where: { orderNumber: orderNumberMatch[1] },
        });
        if (order) {
          paymentLink = await this.prisma.paymentLink.findFirst({
            where: { orderId: order.id },
            include: { order: true },
          });
        }
      }
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

  /**
   * Return Wompi widget configuration for an order (public endpoint).
   * Generates a unique reference + integrity signature and pre-fills customer data.
   */
  async getWidgetConfig(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        address: true,
        paymentLink: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.paymentStatus === 'COMPLETED' || order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED') {
      throw new BadRequestException('Order already paid');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is cancelled');
    }

    // Generate unique reference: orderNumber-attempt
    const attempt = order.paymentLink?.metadata
      ? ((order.paymentLink.metadata as any).widgetAttempt || 0) + 1
      : 1;
    const reference = `${order.orderNumber}-${attempt}`;
    const amountInCents = Math.round(Number(order.total) * 100);

    // Get Wompi keys
    const publicKey = await this.wompiService.getPublicKey();
    const signature = await this.wompiService.generateIntegritySignature(
      reference,
      amountInCents,
      'COP',
    );

    // Upsert PaymentLink record with current reference
    const sellerUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000');
    const redirectUrl = `${sellerUrl}/pay/${orderId}?payment=done`;

    if (order.paymentLink) {
      await this.prisma.paymentLink.update({
        where: { id: order.paymentLink.id },
        data: {
          externalId: reference,
          provider: 'wompi',
          status: 'PENDING',
          metadata: {
            ...(order.paymentLink.metadata as any || {}),
            widgetAttempt: attempt,
            widgetReference: reference,
          },
        },
      });
    } else {
      await this.prisma.paymentLink.create({
        data: {
          orderId,
          externalId: reference,
          amount: order.total,
          currency: 'COP',
          provider: 'wompi',
          status: 'PENDING',
          metadata: { widgetAttempt: attempt, widgetReference: reference },
        },
      });
    }

    // Ensure order is PENDING_PAYMENT
    if (order.status === 'DRAFT') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' },
      });
    }

    // Map document type to Wompi legal-id-type
    const docTypeMap: Record<string, string> = {
      CC: 'CC', 'Cédula de Ciudadanía': 'CC',
      CE: 'CE', 'Cédula de Extranjería': 'CE',
      NIT: 'NIT',
      PP: 'PP', Pasaporte: 'PP',
      TI: 'TI', 'Tarjeta de Identidad': 'TI',
    };
    const legalIdType = docTypeMap[order.customer.documentType || ''] || undefined;

    // Build customer data for pre-fill
    const customerData: Record<string, string> = {};
    if (order.customer.email) customerData.email = order.customer.email;
    if (order.customer.name) customerData.fullName = order.customer.name;
    if (order.customer.phone) {
      const digits = order.customer.phone.replace(/\D/g, '');
      customerData.phoneNumber = digits;
      customerData.phoneNumberPrefix = '+57';
    }
    if (order.customer.documentNumber && legalIdType) {
      customerData.legalId = order.customer.documentNumber;
      customerData.legalIdType = legalIdType;
    }

    // Build shipping address for pre-fill
    let shippingAddress: Record<string, string> | undefined;
    if (order.address) {
      shippingAddress = {
        addressLine1: order.address.street,
        country: 'CO',
        city: order.address.city,
        phoneNumber: (order.address.phone || order.customer.phone || '').replace(/\D/g, ''),
        region: order.address.state || order.address.city,
      };
      if (order.address.detail) {
        shippingAddress.addressLine2 = order.address.detail;
      }
    }

    this.logger.log(
      `Widget config generated for order ${order.orderNumber}, ref: ${reference}`,
    );

    return {
      publicKey,
      currency: 'COP',
      amountInCents,
      reference,
      signature,
      redirectUrl,
      customerData,
      shippingAddress,
    };
  }

  /**
   * Return Wompi public key + acceptance token for a given order.
   * Frontend uses these to render the acceptance checkbox and send the token
   * back in the direct-transaction body.
   */
  async getWompiPublicData(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.paymentStatus === 'COMPLETED' || order.status === 'PAID') {
      throw new BadRequestException('Order already paid');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is cancelled');
    }

    const publicKey = await this.wompiService.getPublicKey();
    const { token: acceptanceToken, permalink: acceptPermalink } =
      await this.wompiService.getAcceptanceToken();

    return { publicKey, acceptanceToken, acceptPermalink };
  }

  /**
   * Return the cached list of PSE financial institutions.
   */
  async getPseBanks() {
    return this.wompiService.getFinancialInstitutions();
  }

  /**
   * Create a direct Wompi transaction for an order (bypasses widget).
   * Validates the order, builds the transaction payload, calls Wompi API,
   * and saves the transactionId + paymentMethodType to the PaymentLink record.
   */
  async createDirectTransaction(orderId: string, dto: CreateDirectTransactionDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, address: true, paymentLink: true },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.paymentStatus === 'COMPLETED' || order.status === 'PAID') {
      throw new BadRequestException('Order already paid');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is cancelled');
    }

    const amountInCents = Math.round(Number(order.total) * 100);
    // Use a timestamp-based suffix to guarantee unique references across retries
    const reference = `${order.orderNumber}-${Date.now()}`;

    const sellerUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000');
    const redirectUrl = `${sellerUrl}/pay/${orderId}?payment=done`;

    // Always fetch a fresh acceptance token — Wompi tokens are single-use
    const { token: freshAcceptanceToken } = await this.wompiService.getAcceptanceToken();

    // Generate integrity signature (required by Wompi direct API)
    const integritySignature = await this.wompiService.generateIntegritySignature(
      reference,
      amountInCents,
      'COP',
    );

    // Build payment_method object based on type
    let paymentMethod: Record<string, any>;
    switch (dto.paymentMethodType) {
      case 'CARD':
        paymentMethod = {
          type: 'CARD',
          token: dto.cardToken,
          installments: dto.installments ?? 1,
        };
        break;
      case 'PSE':
        paymentMethod = {
          type: 'PSE',
          user_type: dto.userType,
          user_legal_id: dto.legalId,
          user_legal_id_type: dto.legalIdType,
          financial_institution_code: dto.bankCode,
          payment_description: `D Perfume House - Orden ${order.orderNumber}`,
        };
        break;
      case 'NEQUI':
        paymentMethod = {
          type: 'NEQUI',
          phone_number: dto.phoneNumber!.replace(/\D/g, ''),
        };
        break;
      case 'BANCOLOMBIA_TRANSFER':
        paymentMethod = {
          type: 'BANCOLOMBIA_TRANSFER',
          user_type: 'PERSON',
          payment_description: `D Perfume House - Orden ${order.orderNumber}`,
        };
        break;
      case 'BANCOLOMBIA_COLLECT':
        paymentMethod = { type: 'BANCOLOMBIA_COLLECT' };
        break;
      case 'DAVIPLATA':
        paymentMethod = {
          type: 'DAVIPLATA',
          user_legal_id: dto.legalId,
          user_legal_id_type: dto.legalIdType,
        };
        break;
      default:
        throw new BadRequestException(`Unsupported payment method: ${dto.paymentMethodType}`);
    }

    const customerData: Record<string, any> = {
      phone_number: (order.customer.phone || '').replace(/\D/g, ''),
      full_name: order.customer.name,
    };
    if (order.customer.documentNumber && order.customer.documentType) {
      customerData.legal_id = order.customer.documentNumber;
      customerData.legal_id_type = order.customer.documentType;
    }

    const transactionPayload: WompiTransactionPayload = {
      amount_in_cents: amountInCents,
      currency: 'COP',
      customer_email: order.customer.email || '',
      reference,
      acceptance_token: freshAcceptanceToken,
      signature: integritySignature,
      payment_method: paymentMethod,
      customer_data: customerData,
      redirect_url: redirectUrl,
    };

    this.logger.log(
      `Creating direct Wompi transaction for order ${order.orderNumber}, method: ${dto.paymentMethodType}`,
    );

    const transaction = await this.wompiService.createTransaction(transactionPayload);

    // Upsert PaymentLink with transactionId + method type
    if (order.paymentLink) {
      await this.prisma.paymentLink.update({
        where: { id: order.paymentLink.id },
        data: {
          transactionId: transaction.id,
          paymentMethodType: dto.paymentMethodType,
          externalId: reference,
          provider: 'wompi',
          status: 'PENDING',
          metadata: {
            ...(order.paymentLink.metadata as any || {}),
            widgetReference: reference,
          },
        },
      });
    } else {
      await this.prisma.paymentLink.create({
        data: {
          orderId,
          transactionId: transaction.id,
          paymentMethodType: dto.paymentMethodType,
          externalId: reference,
          amount: order.total,
          currency: 'COP',
          provider: 'wompi',
          status: 'PENDING',
          metadata: { widgetReference: reference },
        },
      });
    }

    // Ensure order is PENDING_PAYMENT
    if (order.status === 'DRAFT') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PENDING_PAYMENT', paymentStatus: 'PENDING' },
      });
    }

    this.logger.log(
      `Wompi transaction ${transaction.id} created for order ${order.orderNumber}, status: ${transaction.status}`,
    );

    // For BANCOLOMBIA_COLLECT, Wompi assigns business_agreement_code and payment_intention_identifier
    // asynchronously — they are not present immediately after creation. Retry up to 4 times.
    let resolvedPaymentMethod = transaction.payment_method;
    if (dto.paymentMethodType === 'BANCOLOMBIA_COLLECT') {
      const getExtra = (pm: Record<string, any> | undefined) => pm?.extra as Record<string, any> | undefined;
      const hasCodes = (pm: Record<string, any> | undefined) => {
        const extra = getExtra(pm);
        return !!(extra?.business_agreement_code && extra?.payment_intention_identifier);
      };

      if (!hasCodes(resolvedPaymentMethod)) {
        const delays = [1500, 2000, 2500, 3000];
        for (const delay of delays) {
          await new Promise((r) => setTimeout(r, delay));
          try {
            const full = await this.wompiService.getTransactionById(transaction.id);
            resolvedPaymentMethod = full.payment_method ?? resolvedPaymentMethod;
            if (hasCodes(resolvedPaymentMethod)) {
              this.logger.log(`BANCOLOMBIA_COLLECT codes ready for ${transaction.id}: ${JSON.stringify(getExtra(resolvedPaymentMethod))}`);
              break;
            }
          } catch (e) {
            this.logger.warn(`Re-fetch attempt failed for BANCOLOMBIA_COLLECT ${transaction.id}: ${e}`);
          }
        }
      }

      if (!hasCodes(resolvedPaymentMethod)) {
        this.logger.warn(`BANCOLOMBIA_COLLECT codes not available after retries for ${transaction.id}`);
      } else {
        // Send email to customer with corresponsal payment info
        const extra = getExtra(resolvedPaymentMethod)!;
        this.emailService.sendBancolombiaCollect(
          order.customer.email || '',
          order.customer.name,
          order.orderNumber,
          String(extra.business_agreement_code),
          String(extra.payment_intention_identifier),
          Number(order.total),
        ).catch((e) => this.logger.warn(`Failed to send corresponsal email for ${order.orderNumber}: ${e}`));
      }
    }

    return {
      transactionId: transaction.id,
      status: transaction.status,
      paymentMethodType: dto.paymentMethodType,
      redirectUrl: transaction.async_payment_url || transaction.redirect_url,
      paymentMethod: resolvedPaymentMethod,
    };
  }

  /**
   * Poll the current status of a direct Wompi transaction for an order.
   * Returns live status from Wompi (does NOT update DB — webhook handles that).
   */
  async pollTransactionStatus(orderId: string) {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { orderId },
    });

    if (!paymentLink) {
      throw new NotFoundException(`No payment link found for order ${orderId}`);
    }

    if (!paymentLink.transactionId) {
      return {
        status: paymentLink.status,
        transactionId: null,
        paymentMethodType: paymentLink.paymentMethodType,
      };
    }

    const transaction = await this.wompiService.getTransactionById(paymentLink.transactionId);

    return {
      status: transaction.status,
      transactionId: transaction.id,
      paymentMethodType: transaction.payment_method_type,
      redirectUrl: transaction.redirect_url || transaction.async_payment_url,
      paymentMethod: transaction.payment_method,
    };
  }
}
