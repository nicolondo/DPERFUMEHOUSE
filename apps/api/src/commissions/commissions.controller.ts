import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole, CommissionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { CommissionsService } from './commissions.service';

@ApiTags('Commissions')
@ApiBearerAuth('access-token')
@Controller('commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommissionsController {
  private readonly logger = new Logger(CommissionsController.name);

  constructor(private readonly commissionsService: CommissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List commissions (admin: all, seller: own)' })
  @ApiQuery({ name: 'status', required: false, enum: CommissionStatus })
  @ApiQuery({ name: 'level', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: CommissionStatus,
    @Query('level') level?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('sellerId') sellerId?: string,
  ) {
    const safeLevel = Number(level) || undefined;
    const safePage = Number(page) || undefined;
    const safePageSize = Number(pageSize) || undefined;

    const filters = {
      userId: user.role !== UserRole.ADMIN ? user.sub : (sellerId || undefined),
      status: status || undefined,
      level: safeLevel,
      page: safePage,
      pageSize: safePageSize,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    };

    const result = await this.commissionsService.findAll(filters);
    return { success: true, data: result };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get commission summary (admin: all or by userId, seller: own)' })
  async getSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Query('userId') queryUserId?: string,
  ) {
    let userId: string | undefined;
    if (user.role === UserRole.ADMIN) {
      userId = queryUserId || undefined; // admin can filter by seller
    } else {
      userId = user.sub; // seller always sees own
    }
    const summary = await this.commissionsService.getSellerSummary(userId);
    return { success: true, data: summary };
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a pending commission (admin only)' })
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    const commission = await this.commissionsService.approve(id);
    return { success: true, data: commission };
  }

  @Post('bulk-approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk approve pending commissions (admin only)' })
  async bulkApprove(@Body() body: { commissionIds: string[] }) {
    if (!body.commissionIds?.length) {
      return { success: true, data: { approved: 0 } };
    }

    const count = await this.commissionsService.bulkApprove(
      body.commissionIds,
    );
    return { success: true, data: { approved: count } };
  }

  @Get('monthly-bonus')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List monthly commission bonuses (admin only)' })
  async listMonthlyBonus(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('sellerId') sellerId?: string,
  ) {
    const data = await this.commissionsService.getMonthlyBonuses({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      sellerId: sellerId || undefined,
    });
    return { success: true, data };
  }

  @Post('monthly-bonus/run')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Run monthly commission bonus processing (admin only)' })
  async runMonthlyBonus(
    @Body() body: { year: number; month: number },
  ) {
    const year = Number(body?.year);
    const month = Number(body?.month);
    const data = await this.commissionsService.processMonthlyScaleBonuses(year, month);
    return { success: true, data };
  }

  @Patch('monthly-bonus/:id/retry')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Retry a FAILED monthly commission bonus (admin only)' })
  async retryMonthlyBonus(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.commissionsService.retryMonthlyBonus(id);
    return { success: true, data };
  }

  @Patch(':id/reverse')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reverse a commission (admin only)' })
  async reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const commission = await this.commissionsService.reverse(id, body.reason);
    return { success: true, data: commission };
  }
}
