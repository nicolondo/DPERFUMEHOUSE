import {
  Controller, Get, Post, Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ShippingService } from './shipping.service';
import { QuoteRatesDto, CreateLabelDto, SchedulePickupDto } from './dto';

@Controller('shipping')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private shippingService: ShippingService) {}

  @Get('rates/:orderId')
  async getRates(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: QuoteRatesDto,
  ) {
    return this.shippingService.quoteRates(orderId, dto.carrier);
  }

  @Post('labels/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createLabel(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.shippingService.generateLabel(orderId, dto.carrier, dto.service);
  }

  @Get('track/:orderId')
  async trackOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.shippingService.trackOrder(orderId);
  }

  @Post('pickup/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async schedulePickup(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SchedulePickupDto,
  ) {
    return this.shippingService.schedulePickup(orderId, dto.date, dto.timeFrom, dto.timeTo);
  }

  @Post('cancel/:orderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async cancelShipment(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.shippingService.cancelShipment(orderId);
  }

  @Get('carriers')
  async listCarriers() {
    return this.shippingService.listCarriers();
  }
}
