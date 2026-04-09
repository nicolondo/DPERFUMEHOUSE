import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';
import { CommissionsService } from '../commissions/commissions.service';
import { EmailService } from '../email/email.service';
import { CommissionStatus } from '@prisma/client';

@Processor('payment-process')
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooService: OdooService,
    private readonly commissionsService: CommissionsService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(
      `Processing payment job ${job.id} of type ${job.name}`,
    );

    switch (job.name) {
      case 'payment-confirmed':
        return this.handlePaymentConfirmed(job.data);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async handlePaymentConfirmed(data: {
    orderId: string;
    amount: number;
    currency: string;
    paidAt: string;
  }): Promise<void> {
    const { orderId } = data;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { variant: true } },
        customer: true,
        seller: true,
      },
    });

    if (!order) {
      this.logger.error(`Order ${orderId} not found for payment processing`);
      throw new Error(`Order ${orderId} not found`);
    }

    // --- Decrement local inventory on confirmed payment ---
    for (const item of order.items) {
      await this.prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }
    this.logger.log(`Stock decremented for order ${order.orderNumber}`);

    // --- Commissions first (independent of Odoo) ---
    // Step 1: Calculate commissions
    await this.calculateCommissions(order);

    // Step 2: Auto-approve commissions (payment confirmed by provider)
    await this.commissionsService.approveCommissionsForOrder(orderId);

    this.logger.log(
      `Commissions created and approved for order ${order.orderNumber}`,
    );

    // --- Odoo sync (best-effort, does not block commissions) ---
    try {
      // Step 3: Ensure Odoo partner exists
      let odooPartnerId = order.customer.odooPartnerId;
      if (!odooPartnerId) {
        odooPartnerId = await this.odooService.upsertPartner({
          name: order.customer.name,
          email: order.customer.email || '',
          phone: order.customer.phone || '',
        });

        await this.prisma.customer.update({
          where: { id: order.customerId },
          data: { odooPartnerId },
        });
      }

      // Step 4: Create sale order in Odoo if not already created
      let odooSaleOrderId = order.odooSaleOrderId;
      if (!odooSaleOrderId) {
        const odooSO = await this.odooService.createSaleOrder({
          partnerId: odooPartnerId,
          lines: order.items.map((item) => ({
            productId: item.variant.odooProductId,
            quantity: item.quantity,
            price: Number(item.unitPrice),
          })),
          companyId: order.seller.odooCompanyId || undefined,
        });
        odooSaleOrderId = odooSO.id;

        await this.prisma.order.update({
          where: { id: orderId },
          data: { odooSaleOrderId },
        });
      }

      // Step 5: Confirm the sale order and register payment in Odoo (with retry)
      let odooInvoiceId: number | undefined;
      let odooInvoiceName: string | undefined;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.odooService.confirmAndRegisterPayment(
            odooSaleOrderId,
            Number(order.total),
            'Wompi',
            'bank',
          );
          odooInvoiceId = result.invoiceId;
          odooInvoiceName = result.invoiceName;
          this.logger.log(
            `Odoo SO ${odooSaleOrderId} confirmed, invoice ${odooInvoiceName} paid (attempt ${attempt})`,
          );
          break;
        } catch (err) {
          this.logger.warn(
            `Attempt ${attempt}/${maxRetries} — Could not register Odoo payment for SO ${odooSaleOrderId}: ${err.message}`,
          );
          if (attempt < maxRetries) {
            const delay = attempt * 2000;
            await new Promise((r) => setTimeout(r, delay));
          } else {
            this.logger.error(
              `All ${maxRetries} attempts failed for SO ${odooSaleOrderId}. Falling back to simple confirm (no invoice).`,
            );
            try {
              await this.odooService.confirmSaleOrder(odooSaleOrderId);
            } catch (_) {}
          }
        }
      }

      // Step 6: Create delivery
      const deliveryId =
        await this.odooService.createDelivery(odooSaleOrderId);
      const updateData: any = {};
      if (deliveryId) updateData.odooDeliveryId = deliveryId;
      if (odooInvoiceId) updateData.odooInvoiceId = odooInvoiceId;
      if (odooInvoiceName) updateData.odooInvoiceName = odooInvoiceName;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: updateData,
        });
      }

      this.logger.log(
        `Odoo sync completed for order ${order.orderNumber}`,
      );
    } catch (odooErr) {
      this.logger.error(
        `Odoo sync failed for order ${order.orderNumber}: ${odooErr.message}. Commissions were already created. Odoo sync can be retried manually.`,
      );
    }

    // --- Email notification to ordenes@dperfumehouse.com ---
    try {
      await this.emailService.sendNewOrderNotification({
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        customerEmail: order.customer.email || '',
        customerPhone: order.customer.phone || '',
        sellerName: order.seller.name,
        items: order.items.map((item: any) => ({
          name: item.variant.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        paidAt: data.paidAt,
      });
      this.logger.log(`Order notification email sent for ${order.orderNumber}`);
    } catch (emailErr) {
      this.logger.error(`Failed to send order notification email for ${order.orderNumber}: ${emailErr.message}`);
    }

    this.logger.log(
      `Payment processing completed for order ${order.orderNumber}`,
    );
  }

  private async calculateCommissions(order: any): Promise<void> {
    const seller = await this.prisma.user.findUnique({
      where: { id: order.sellerId },
      include: { parent: true },
    });

    if (!seller) return;

    const baseAmount = Number(order.subtotal);

    // Level 1 commission: direct seller
    const l1Rate = Number(seller.commissionRate);
    const l1Amount = baseAmount * l1Rate;

    await this.prisma.commission.create({
      data: {
        orderId: order.id,
        userId: seller.id,
        level: 1,
        rate: l1Rate,
        baseAmount,
        amount: l1Amount,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `L1 commission of ${l1Amount} created for seller ${seller.name} on order ${order.orderNumber}`,
    );

    // Level 2 commission: parent seller (if exists)
    if (seller.parent) {
      const l2Rate = Number(seller.parent.commissionRate);
      const l2Amount = baseAmount * l2Rate;

      await this.prisma.commission.create({
        data: {
          orderId: order.id,
          userId: seller.parent.id,
          level: 2,
          rate: l2Rate,
          baseAmount,
          amount: l2Amount,
          status: 'PENDING',
        },
      });

      this.logger.log(
        `L2 commission of ${l2Amount} created for parent seller ${seller.parent.name} on order ${order.orderNumber}`,
      );
    }
  }
}
