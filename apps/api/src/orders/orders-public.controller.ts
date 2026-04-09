import { Controller, Get, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersPublicController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('public/:orderNumber')
  async findOnePublic(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.findOnePublic(orderNumber);
  }
}
