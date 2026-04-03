import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('seller')
  @ApiOperation({ summary: "Get seller's dashboard data" })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month'],
    description: 'Period granularity',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Period offset (0 = current, 1 = previous, etc.)',
  })
  async getSellerDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query('period') period?: 'week' | 'month',
    @Query('offset') offset?: number,
  ) {
    const safeOffset = Number(offset) || 0;
    const data = await this.dashboardService.getSellerDashboard(
      user.sub,
      period ?? 'month',
      safeOffset,
    );

    return { success: true, data };
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard data' })
  async getAdminDashboard() {
    const data = await this.dashboardService.getAdminDashboard();
    return { success: true, data };
  }
}
