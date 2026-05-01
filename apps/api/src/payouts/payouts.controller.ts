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
import { UserRole, PayoutStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { PayoutsService, CreatePayoutDto } from './payouts.service';

@ApiTags('Payouts')
@ApiBearerAuth('access-token')
@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  private readonly logger = new Logger(PayoutsController.name);

  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @ApiOperation({ summary: 'List payouts (admin: all, seller: own)' })
  @ApiQuery({ name: 'status', required: false, enum: PayoutStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: PayoutStatus,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const filters = {
      userId: user.role !== UserRole.ADMIN ? user.sub : undefined,
      status,
      page,
      pageSize,
    };

    const result = await this.payoutsService.findAll(filters);
    return { success: true, data: result };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a payout for a seller (admin only)' })
  async create(@Body() body: CreatePayoutDto) {
    const payout = await this.payoutsService.create(body);
    return { success: true, data: payout };
  }

  @Patch(':id/process')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark payout as processing (admin only)' })
  async markProcessing(@Param('id', ParseUUIDPipe) id: string) {
    const payout = await this.payoutsService.markProcessing(id);
    return { success: true, data: payout };
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Mark payout as completed and commissions as paid (admin only)',
  })
  async complete(@Param('id', ParseUUIDPipe) id: string) {
    const payout = await this.payoutsService.complete(id);
    return { success: true, data: payout };
  }

  @Patch(':id/sync-odoo')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Retry Odoo journal entry sync for a completed payout with no asiento (admin only)',
  })
  async syncOdoo(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.payoutsService.syncOdoo(id);
    return { success: true, data: result };
  }

  @Get('wompi/preview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Preview Wompi batch (eligible/excluded) for all PENDING payouts (admin only)' })
  async wompiPreview() {
    const data = await this.payoutsService.previewPendingForWompi();
    return { success: true, data };
  }

  @Post('wompi/pay-pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create Wompi batch and pay all eligible PENDING payouts (admin only)' })
  async wompiPayPending() {
    const data = await this.payoutsService.payAllPendingViaWompi();
    return { success: true, data };
  }
}
