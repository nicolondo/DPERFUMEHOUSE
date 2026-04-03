import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';

export interface FindAllProductsParams {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  onlyActive?: boolean;
  status?: 'active' | 'inactive' | 'all';
  currentUserId: string;
  currentUserRole: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooService: OdooService,
  ) {}

  private async getAllowedCategoriesForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.userAllowedCategory.findMany({
      where: { userId },
      select: { categoryName: true },
      orderBy: { categoryName: 'asc' },
    });
    return rows.map((row) => row.categoryName);
  }

  async findAll(params: FindAllProductsParams) {
    const {
      page,
      pageSize,
      search,
      category,
      onlyActive,
      status = 'active',
      currentUserId,
      currentUserRole,
    } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductVariantWhereInput = {};
    const isAdmin = currentUserRole === UserRole.ADMIN;
    const allowedCategories = isAdmin
      ? []
      : await this.getAllowedCategoriesForUser(currentUserId);

    if (!isAdmin) {
      if (allowedCategories.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page,
            limit: pageSize,
            totalPages: 0,
          },
        };
      }
      where.categoryName = { in: allowedCategories };
    }

    // Use status param if provided, fallback to onlyActive for backwards compat
    const effectiveStatus = onlyActive !== undefined
      ? (onlyActive ? 'active' : 'all')
      : status;

    if (effectiveStatus === 'active') {
      where.isActive = true;
      where.isBlocked = false;
    } else if (effectiveStatus === 'inactive') {
      where.OR = [
        { isActive: false },
        { isBlocked: true },
      ];
    }

    if (category) {
      if (!isAdmin) {
        if (!allowedCategories.includes(category)) {
          return {
            data: [],
            meta: {
              total: 0,
              page,
              limit: pageSize,
              totalPages: 0,
            },
          };
        }
        where.categoryName = category;
      } else {
        where.categoryName = { startsWith: category, mode: 'insensitive' };
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { categoryName: { contains: search, mode: 'insensitive' } },
        // Search inside JSON attributes using raw SQL (case-insensitive)
        {
          id: {
            in: await this.prisma.$queryRaw<{ id: string }[]>`
              SELECT id FROM product_variants
              WHERE CAST(attributes AS TEXT) ILIKE ${'%' + search + '%'}
            `.then((rows) => rows.map((r) => r.id)),
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string, currentUserId: string, currentUserRole: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${id} not found`);
    }

    if (currentUserRole !== UserRole.ADMIN) {
      const allowedCategories = await this.getAllowedCategoriesForUser(currentUserId);
      if (
        allowedCategories.length === 0 ||
        !variant.categoryName ||
        !allowedCategories.includes(variant.categoryName)
      ) {
        throw new NotFoundException(`Product variant ${id} not found`);
      }
    }

    // Optionally fetch real-time stock from Odoo
    try {
      const stockMap = await this.odooService.getStock([variant.odooProductId]);
      const liveStock = stockMap.get(variant.odooProductId);
      if (liveStock !== undefined) {
        return { ...variant, stock: Math.max(0, Math.floor(liveStock)) };
      }
    } catch (error) {
      this.logger.warn(
        `Could not fetch live stock for product ${id}, using cached value`,
      );
    }

    return variant;
  }

  async toggleBlock(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${id} not found`);
    }

    // If product is inactive, reactivate it; otherwise toggle blocked
    const data = !variant.isActive
      ? { isActive: true, isBlocked: false }
      : { isBlocked: !variant.isBlocked };

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data,
    });

    this.logger.log(
      `Product ${id}: isActive=${updated.isActive}, isBlocked=${updated.isBlocked}`,
    );

    return updated;
  }

  async getCategories(currentUserId: string, currentUserRole: string): Promise<string[]> {
    const isAdmin = currentUserRole === UserRole.ADMIN;
    const allowedCategories = isAdmin
      ? []
      : await this.getAllowedCategoriesForUser(currentUserId);

    if (!isAdmin && allowedCategories.length === 0) {
      return [];
    }

    const categories = await this.prisma.productVariant.findMany({
      where: {
        isActive: true,
        categoryName: { not: null },
        ...(isAdmin ? {} : { categoryName: { in: allowedCategories } }),
      },
      select: { categoryName: true },
      distinct: ['categoryName'],
      orderBy: { categoryName: 'asc' },
    });

    return categories
      .map((c) => c.categoryName)
      .filter((name): name is string => name !== null);
  }

  async findByOdooProductId(odooProductId: number) {
    return this.prisma.productVariant.findUnique({
      where: { odooProductId },
      include: { images: true },
    });
  }

  async getStockForVariants(
    variantIds: string[],
  ): Promise<Map<string, number>> {
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, odooProductId: true, stock: true },
    });

    const odooIds = variants.map((v) => v.odooProductId);
    const stockMap = new Map<string, number>();

    try {
      const odooStockMap = await this.odooService.getStock(odooIds);

      for (const variant of variants) {
        const liveStock = odooStockMap.get(variant.odooProductId);
        stockMap.set(
          variant.id,
          liveStock !== undefined
            ? Math.max(0, Math.floor(liveStock))
            : variant.stock,
        );
      }
    } catch (error) {
      this.logger.warn(
        'Could not fetch live stock, using cached values',
      );
      for (const variant of variants) {
        stockMap.set(variant.id, variant.stock);
      }
    }

    return stockMap;
  }
}
