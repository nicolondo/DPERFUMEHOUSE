import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { OdooSyncService } from '../odoo/odoo-sync.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
    private readonly odooSyncService: OdooSyncService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('onlyActive') onlyActive?: string,
    @Query('status') status?: string,
  ) {
    return this.productsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      search,
      category,
      onlyActive: onlyActive !== undefined ? onlyActive !== 'false' : undefined,
      status: (status as 'active' | 'inactive' | 'all') || undefined,
      currentUserId: user.sub,
      currentUserRole: user.role,
    });
  }

  @Get('categories')
  async getCategories(@CurrentUser() user: CurrentUserPayload) {
    return this.productsService.getCategories(user.sub, user.role);
  }

  @Get('sync-logs')
  @Roles(UserRole.ADMIN)
  async getSyncLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const limit = pageSize ? parseInt(pageSize, 10) : 20;
    const currentPage = page ? parseInt(page, 10) : 1;
    const skip = (currentPage - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.syncLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.syncLog.count(),
    ]);

    return {
      data,
      meta: {
        total,
        page: currentPage,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':id/images')
  async getImages(@Param('id', ParseUUIDPipe) id: string) {
    const images = await this.prisma.productImage.findMany({
      where: { variantId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return { data: images };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.findOne(id, user.sub, user.role);
  }

  @Post('sync')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async triggerSync() {
    const syncLog = await this.prisma.syncLog.create({
      data: { type: 'sync-products', status: 'running' },
    });

    const startTime = Date.now();
    try {
      const result = await this.odooSyncService.syncAllProducts();
      const duration = Math.round((Date.now() - startTime) / 1000);

      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: result.errors.length === 0 ? 'completed' : 'completed',
          result: result as any,
          error: result.errors.length > 0 ? result.errors.join('; ') : null,
          finishedAt: new Date(),
          duration,
        },
      });

      return {
        success: result.errors.length === 0,
        message: `Sync completed: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated`,
        ...result,
      };
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
          duration,
        },
      });
      throw error;
    }
  }

  @Post('refresh-stock')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async refreshStock() {
    const syncLog = await this.prisma.syncLog.create({
      data: { type: 'sync-stock', status: 'running' },
    });

    const startTime = Date.now();
    try {
      const result = await this.odooSyncService.syncStock();
      const duration = Math.round((Date.now() - startTime) / 1000);

      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: result.errors.length === 0 ? 'completed' : 'completed',
          result: result as any,
          error: result.errors.length > 0 ? result.errors.join('; ') : null,
          finishedAt: new Date(),
          duration,
        },
      });

      return {
        success: result.errors.length === 0,
        message: `Stock refresh completed: ${result.updated} updated`,
        ...result,
      };
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
          duration,
        },
      });
      throw error;
    }
  }

  @Patch(':id/block')
  @Roles(UserRole.ADMIN)
  async toggleBlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.toggleBlock(id);
  }

  @Post('bulk-deactivate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkDeactivate(@Body() body: { ids: string[] }) {
    const result = await this.prisma.productVariant.updateMany({
      where: { id: { in: body.ids } },
      data: { isBlocked: true },
    });
    return { success: true, count: result.count };
  }

  @Post('bulk-activate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkActivate(@Body() body: { ids: string[] }) {
    const result = await this.prisma.productVariant.updateMany({
      where: { id: { in: body.ids } },
      data: { isBlocked: false },
    });
    return { success: true, count: result.count };
  }
}
