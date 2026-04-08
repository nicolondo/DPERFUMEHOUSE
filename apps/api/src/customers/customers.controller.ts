import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import {
  CreateCustomerBodyDto,
  UpdateCustomerBodyDto,
  CreateAddressBodyDto,
  UpdateAddressBodyDto,
} from './dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('sellerId') sellerId?: string,
  ) {
    // Admin sees all customers (or filtered by sellerId), sellers see only their own
    const effectiveSellerId = user.role === 'ADMIN' ? (sellerId || null) : user.sub;
    return this.customersService.findAll(effectiveSellerId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      search,
    });
  }

  @Get('birthdays')
  async getUpcomingBirthdays(
    @CurrentUser() user: CurrentUserPayload,
    @Query('days') days?: string,
  ) {
    const sellerId = user.role === 'ADMIN' ? null : user.sub;
    if (!sellerId) {
      return []; // Admin doesn't have "their" customers for birthday card
    }
    return this.customersService.getUpcomingBirthdays(sellerId, days ? parseInt(days, 10) : 7);
  }

  @Get('follow-ups')
  async getFollowUpCustomers(
    @CurrentUser() user: CurrentUserPayload,
    @Query('days') days?: string,
  ) {
    const sellerId = user.role === 'ADMIN' ? null : user.sub;
    if (!sellerId) {
      return [];
    }
    return this.customersService.getFollowUpCustomers(sellerId, days ? parseInt(days, 10) : 45);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const sellerId = user.role === 'ADMIN' ? null : user.sub;
    return this.customersService.findOne(id, sellerId);
  }

  @Post()
  async create(
    @Body() body: CreateCustomerBodyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.create(body, user.sub);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCustomerBodyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const sellerId = user.role === 'ADMIN' ? null : user.sub;
    return this.customersService.update(id, body, sellerId);
  }

  @Post(':id/addresses')
  async createAddress(
    @Param('id', ParseUUIDPipe) customerId: string,
    @Body() body: CreateAddressBodyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const sellerId = user.role === 'ADMIN' ? null : user.sub;
    return this.customersService.createAddress(customerId, body, sellerId);
  }

  @Put(':id/addresses/:addressId')
  async updateAddress(
    @Param('id', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() body: UpdateAddressBodyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const sellerId = user.role === 'ADMIN' ? null : user.sub;
    return this.customersService.updateAddress(
      customerId,
      addressId,
      body,
      sellerId,
    );
  }

  @Delete(':id/addresses/:addressId')
  async deleteAddress(
    @Param('id', ParseUUIDPipe) customerId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const sellerId = user.role === 'ADMIN' ? null : user.sub;
    return this.customersService.deleteAddress(customerId, addressId, sellerId);
  }

  @Delete(':id')
  async deleteCustomer(
    @Param('id', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.delete(customerId, user.sub, user.role);
  }
}
