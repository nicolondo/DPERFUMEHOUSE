import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderBodyDto, UpdateOrderAddressDto } from './dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sellerId') sellerId?: string,
  ) {
    const isAdmin = user.role === 'ADMIN';
    let effectiveSellerId: string | undefined;

    if (isAdmin) {
      effectiveSellerId = sellerId || undefined;
    } else if (sellerId && sellerId !== user.sub) {
      // Non-admin requesting another seller's orders — only allowed for parent→child
      const isChild = await this.ordersService.isChildSeller(user.sub, sellerId);
      if (!isChild) {
        throw new ForbiddenException('No tienes permiso para ver estos pedidos');
      }
      effectiveSellerId = sellerId;
    } else {
      effectiveSellerId = user.sub;
    }

    return this.ordersService.findAll(effectiveSellerId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      status,
      search,
      from,
      to,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const isAdmin = user.role === 'ADMIN';
    return this.ordersService.findOne(id, isAdmin ? undefined : user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateOrderBodyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.createOrder(body, user.sub);
  }

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  async process(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.processOrder(id, user.sub);
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ordersService.cancelOrder(id, user.sub);
  }

  @Patch(':id/address')
  async updateAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderAddressDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const isAdmin = user.role === 'ADMIN';
    return this.ordersService.updateOrderAddress(id, body.addressId, isAdmin ? undefined : user.sub);
  }

  @Patch(':id/mark-paid')
  async markAsPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can mark orders as paid');
    }
    return this.ordersService.markAsPaid(id);
  }

  @Post(':id/sync-odoo')
  @HttpCode(HttpStatus.OK)
  async syncOdoo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can sync orders to Odoo');
    }
    return this.ordersService.syncOdoo(id);
  }

  @Patch(':id/ship')
  async markAsShipped(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can mark orders as shipped');
    }
    return this.ordersService.markAsShipped(id);
  }

  @Patch(':id/deliver')
  async markAsDelivered(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can mark orders as delivered');
    }
    return this.ordersService.markAsDelivered(id, body?.notes);
  }
}
