import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';
import { CommissionsService } from '../commissions/commissions.service';

@Injectable()
export class PaymentSyncService {
  private readonly logger = new Logger(PaymentSyncService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooService: OdooService,
    private readonly commissionsService: CommissionsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncPaymentsFromOdoo() {
    if (this.isRunning) {
      this.logger.debug('Payment sync already running, skipping');
      return;
    }

    this.isRunning = true;
    try {
      const pendingOrders = await this.prisma.order.findMany({
        where: {
          status: 'DRAFT',
          paymentMethod: 'CASH',
          odooSaleOrderId: { not: null },
        },
        select: {
          id: true,
          orderNumber: true,
          odooSaleOrderId: true,
        },
      });

      if (pendingOrders.length === 0) {
        return;
      }

      this.logger.log(
        `Checking payment status for ${pendingOrders.length} CASH orders`,
      );

      let paidCount = 0;
      for (const order of pendingOrders) {
        try {
          const isPaid = await this.odooService.checkSaleOrderPayment(
            order.odooSaleOrderId!,
          );

          if (isPaid) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: {
                status: 'PAID',
                paymentStatus: 'COMPLETED',
              },
            });

            // Calculate commissions
            try {
              await this.commissionsService.approveCommissionsForOrder(order.id);
              await this.commissionsService.calculateForOrder(order.id, 'APPROVED' as any);
            } catch (err) {
              this.logger.warn(
                `Failed to calculate commissions for order ${order.orderNumber}: ${err.message}`,
              );
            }

            paidCount++;
            this.logger.log(
              `Order ${order.orderNumber} marked as PAID (Odoo payment confirmed)`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Failed to check payment for order ${order.orderNumber}: ${err.message}`,
          );
        }
      }

      if (paidCount > 0) {
        this.logger.log(
          `Payment sync complete: ${paidCount}/${pendingOrders.length} orders marked as PAID`,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }
}
