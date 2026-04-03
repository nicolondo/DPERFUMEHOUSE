import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProductRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
const PAGINATION = { DEFAULT_PAGE: 1, DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 };

export interface CreateProductRequestDto {
  variantId: string;
  quantity: number;
  notes?: string;
}

export interface ProductRequestFilters {
  sellerId?: string;
  status?: ProductRequestStatus;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductRequestsService {
  private readonly logger = new Logger(ProductRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a product stock request from a seller.
   */
  async create(sellerId: string, dto: CreateProductRequestDto) {
    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
    });

    if (!variant) {
      throw new NotFoundException(
        `Product variant ${dto.variantId} not found`,
      );
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const request = await this.prisma.productRequest.create({
      data: {
        sellerId,
        variantId: dto.variantId,
        quantity: dto.quantity,
        notes: dto.notes,
        status: ProductRequestStatus.PENDING,
      },
      include: {
        variant: {
          select: { id: true, name: true, sku: true, stock: true },
        },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(
      `Product request created by seller ${sellerId} for variant ${dto.variantId} (qty: ${dto.quantity})`,
    );

    return request;
  }

  /**
   * Get all product requests with filters and pagination.
   */
  async findAll(
    filters: ProductRequestFilters,
  ): Promise<any> {
    const page = Number(filters.page) || 1;
    const pageSize = Math.min(Number(filters.pageSize) || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductRequestWhereInput = {};

    if (filters.sellerId) {
      where.sellerId = filters.sellerId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.productRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          variant: {
            select: { id: true, name: true, sku: true, stock: true },
          },
          seller: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.productRequest.count({ where }),
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

  /**
   * Update the status of a product request (admin action).
   */
  async updateStatus(
    requestId: string,
    status: ProductRequestStatus,
  ) {
    const request = await this.prisma.productRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(
        `Product request ${requestId} not found`,
      );
    }

    // Validate status transitions
    const validTransitions: Record<ProductRequestStatus, ProductRequestStatus[]> =
      {
        [ProductRequestStatus.PENDING]: [
          ProductRequestStatus.NOTIFIED,
          ProductRequestStatus.FULFILLED,
          ProductRequestStatus.CANCELLED,
        ],
        [ProductRequestStatus.NOTIFIED]: [
          ProductRequestStatus.FULFILLED,
          ProductRequestStatus.CANCELLED,
        ],
        [ProductRequestStatus.FULFILLED]: [],
        [ProductRequestStatus.CANCELLED]: [],
      };

    if (!validTransitions[request.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${request.status} to ${status}`,
      );
    }

    const updated = await this.prisma.productRequest.update({
      where: { id: requestId },
      data: { status },
      include: {
        variant: {
          select: { id: true, name: true, sku: true, stock: true },
        },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(
      `Product request ${requestId} status updated: ${request.status} -> ${status}`,
    );

    return updated;
  }
}
