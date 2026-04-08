import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';
import { SellerProductLinksController } from './seller-product-links.controller';
import { SellerProductLinksService } from './seller-product-links.service';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [SellerProductLinksController],
  providers: [SellerProductLinksService],
})
export class SellerProductLinksModule {}
