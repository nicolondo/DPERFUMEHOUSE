import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from './shipping.service';

@Injectable()
export class ShippingTrackingScheduler {
  private readonly logger = new Logger(ShippingTrackingScheduler.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingService: ShippingService,
  ) {}

  @Cron('*/30 * * * *') // every 30 minutes
  async pollShippedOrders() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const shippedOrders = await this.prisma.order.findMany({
        where: {
          status: 'SHIPPED',
          shipment: { trackingNumber: { not: null } },
        },
        select: { id: true, orderNumber: true },
      });

      if (shippedOrders.length === 0) return;
      this.logger.log(`Polling tracking for ${shippedOrders.length} SHIPPED order(s)`);

      for (const order of shippedOrders) {
        try {
          await this.shippingService.trackOrder(order.id);
        } catch (err: any) {
          this.logger.warn(`Failed to track order ${order.orderNumber}: ${err.message}`);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
