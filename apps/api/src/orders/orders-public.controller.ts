import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersPublicController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('public/:id')
  async findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOnePublic(id);
  }
}
