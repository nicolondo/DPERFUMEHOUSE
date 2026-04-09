import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { OdooModule } from '../odoo/odoo.module';
import { SellerProductLinksController } from './seller-product-links.controller';
import { SellerProductLinksService } from './seller-product-links.service';

@Module({
  imports: [PrismaModule, OrdersModule, OdooModule],
  controllers: [SellerProductLinksController],
  providers: [SellerProductLinksService],
})
export class SellerProductLinksModule {}
