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

    // --- Commissions first (independent of Odoo) ---
    // Create and auto-approve commissions (payment confirmed by provider)
    await this.commissionsService.calculateForOrder(orderId, CommissionStatus.APPROVED);

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
        // Distribute promo discount proportionally across line items
        const promoDiscount = Number(order.promoDiscount) || 0;
        const totalItemsNet = order.items.reduce((sum, item) => sum + Number(item.total), 0);
        const odooLines = order.items.map((item) => {
          const itemTotal = Number(item.total);
          const promoShare = promoDiscount > 0 && totalItemsNet > 0
            ? promoDiscount * itemTotal / totalItemsNet
            : 0;
          return {
            productId: item.variant.odooProductId,
            quantity: item.quantity,
            price: (itemTotal - promoShare) / item.quantity,
          };
        });

        const odooSO = await this.odooService.createSaleOrder({
          partnerId: odooPartnerId,
          lines: odooLines,
          companyId: order.seller.odooCompanyId || undefined,
        });
        odooSaleOrderId = odooSO.id;

        await this.prisma.order.update({
          where: { id: orderId },
          data: { odooSaleOrderId },
        });
      }

      // Step 5: Confirm the sale order and register payment in Odoo
      let odooInvoiceId: number | undefined;
      let odooInvoiceName: string | undefined;
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
          `Odoo SO ${odooSaleOrderId} confirmed, invoice ${odooInvoiceName} paid`,
        );
      } catch (err) {
        this.logger.warn(
          `Could not register Odoo payment for SO ${odooSaleOrderId}: ${err.message}. Falling back to simple confirm.`,
        );
        await this.odooService.confirmSaleOrder(odooSaleOrderId);
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

    // --- Auto-update related leads ---
    try {
      await this.autoUpdateLeadsOnPurchase(order);
    } catch (leadErr) {
      this.logger.error(`Failed to auto-update leads for order ${order.orderNumber}: ${leadErr.message}`);
    }

    this.logger.log(
      `Payment processing completed for order ${order.orderNumber}`,
    );
  }

  private async autoUpdateLeadsOnPurchase(order: {
    id: string;
    customerId: string;
    sellerId: string;
    items: Array<{ variant: { id: string; name: string; categoryName: string | null } }>;
  }): Promise<void> {
    if (!order.customerId) return;

    // Find open leads for this customer (not yet purchased/converted)
    const leads = await this.prisma.lead.findMany({
      where: {
        customerId: order.customerId,
        status: { in: ['SENT', 'RESPONDED', 'APPOINTMENT', 'VISITED'] },
        purchasedOrderId: null,
      },
    });

    if (leads.length === 0) return;

    const purchasedVariantIds = new Set(order.items.map((i) => i.variant.id));
    const purchasedItems = order.items.map((i) => ({
      variantId: i.variant.id,
      name: i.variant.name,
    }));

    for (const lead of leads) {
      const recs = (lead.recommendations as any[]) || [];
      const recommended = recs.map((r: any) => ({
        variantId: r.productVariantId,
        name: r.name,
        compatibility: r.compatibility,
      }));

      const matchedRecs = recommended.filter((r) => purchasedVariantIds.has(r.variantId));
      const unmatchedRecs = recommended.filter((r) => !purchasedVariantIds.has(r.variantId));
      const extraPurchases = purchasedItems.filter((p) => !recommended.find((r) => r.variantId === p.variantId));

      const matchRate = recommended.length > 0
        ? Math.round((matchedRecs.length / recommended.length) * 100)
        : 0;

      const purchaseMatch = {
        recommended,
        purchased: purchasedItems,
        matched: matchedRecs,
        unmatched: unmatchedRecs,
        extra: extraPurchases,
        matchRate,
        boughtRecommended: matchedRecs.length > 0,
      };

      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: 'PURCHASED',
          purchasedOrderId: order.id,
          purchasedAt: new Date(),
          purchaseMatch,
        },
      });

      this.logger.log(
        `Lead ${lead.id} marked PURCHASED — matchRate: ${matchRate}%, matched: ${matchedRecs.length}/${recommended.length}`,
      );
    }
  }

}
