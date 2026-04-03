import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole, ProductRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import {
  ProductRequestsService,
  CreateProductRequestDto,
} from './product-requests.service';

@ApiTags('Product Requests')
@ApiBearerAuth('access-token')
@Controller('product-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductRequestsController {
  private readonly logger = new Logger(ProductRequestsController.name);

  constructor(
    private readonly productRequestsService: ProductRequestsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a product stock request (seller)',
  })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: CreateProductRequestDto,
  ) {
    const request = await this.productRequestsService.create(user.sub, body);
    return { success: true, data: request };
  }

  @Get()
  @ApiOperation({
    summary: 'List product requests (admin: all, seller: own)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ProductRequestStatus,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: ProductRequestStatus,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const filters = {
      sellerId: user.role !== UserRole.ADMIN ? user.sub : undefined,
      status,
      page,
      pageSize,
    };

    const result = await this.productRequestsService.findAll(filters);
    return { success: true, data: result };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update product request status (admin only)',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: ProductRequestStatus },
  ) {
    const request = await this.productRequestsService.updateStatus(
      id,
      body.status,
    );
    return { success: true, data: request };
  }
}
