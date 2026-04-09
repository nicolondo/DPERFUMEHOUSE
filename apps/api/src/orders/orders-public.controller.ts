import { Controller, Get, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersPublicController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('public/:slug')
  async findOnePublic(@Param('slug') slug: string) {
    return this.ordersService.findOnePublic(slug);
  }
}
