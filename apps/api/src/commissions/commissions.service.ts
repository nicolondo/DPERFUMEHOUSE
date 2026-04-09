import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  CommissionStatus,
  MonthlyCommissionBonusStatus,
  OrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OdooService } from '../odoo/odoo.service';
import { COMMISSION, PAGINATION } from '@dperfumehouse/config';
import { PaginatedResponse } from '@dperfumehouse/types';

export interface CommissionFilters {
  userId?: string;
  orderId?: string;
  status?: CommissionStatus;
  level?: number;
  page?: number;
  pageSize?: number;
  fromDate?: Date;
  toDate?: Date;
}

type CommissionScaleTier = {
  minSales: number;
  maxSales?: number;
  ratePercent: number;
};

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly odooService: OdooService,
  ) {}

  /**
   * Calculate commissions for a paid order.
   * L1: direct seller gets their commissionRate * order total.
   * L2: if the seller has a parent, parent gets the L2 rate * order total.
   */
  /**
   * Create commissions for an order. Use initialStatus = PENDING when order is confirmed,
   * and call approveCommissionsForOrder() when payment is received.
   */
  async calculateForOrder(orderId: string, initialStatus: CommissionStatus = CommissionStatus.PENDING): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: {
          include: {
            parent: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Check if commissions already exist for this order
    const existingCommissions = await this.prisma.commission.count({
      where: { orderId, status: { not: CommissionStatus.REVERSED } },
    });

    if (existingCommissions > 0) {
      this.logger.warn(`Commissions already exist for order ${orderId}. Skipping creation.`);
      return;
    }

    const orderTotal = order.total.toNumber();
    const commissionsToCreate: Prisma.CommissionCreateManyInput[] = [];

    // Resolve L1 rate: use scale tier if enabled, otherwise flat base rate
    const seller = order.seller as any;
    let l1Rate = seller.commissionRate.toNumber();

    if (seller.commissionScaleEnabled) {
      // Get seller's total sales for the current month (paid/shipped/delivered)
      const now = order.createdAt ?? new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      const salesAgg = await this.prisma.order.aggregate({
        where: {
          sellerId: order.sellerId,
          status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        _sum: { total: true },
      });

      const monthlySales = (salesAgg._sum.total?.toNumber() ?? 0) + orderTotal;

      let scaleTiers: CommissionScaleTier[];
      if (seller.commissionScaleUseGlobal !== false) {
        scaleTiers = await this.getGlobalScaleTiers();
      } else {
        const override = this.normalizeScaleTiers(seller.commissionScaleOverride);
        scaleTiers = override.length > 0 ? override : await this.getGlobalScaleTiers();
      }

      const tierRate = this.pickTierRate(monthlySales, scaleTiers);
      if (tierRate > 0) {
        l1Rate = tierRate;
        this.logger.log(
          `L1 scale rate for seller ${order.sellerId}: ${l1Rate} (monthly sales: ${monthlySales})`,
        );
      }
    }

    const l1Amount = Math.round(orderTotal * l1Rate * 100) / 100;

    commissionsToCreate.push({
      orderId,
      userId: order.sellerId,
      level: 1,
      rate: new Prisma.Decimal(l1Rate),
      baseAmount: order.total,
      amount: new Prisma.Decimal(l1Amount),
      status: initialStatus,
    });

    this.logger.log(
      `L1 commission for seller ${order.sellerId}: ${l1Amount} (rate: ${l1Rate})`,
    );

    // L2 commission: parent seller (if exists)
    if (order.seller.parentId && order.seller.parent) {
      const l2Rate = order.seller.parent.commissionRateL2
        ? order.seller.parent.commissionRateL2.toNumber()
        : COMMISSION.DEFAULT_L2_RATE / 100;
      const l2Amount = Math.round(orderTotal * l2Rate * 100) / 100;

      commissionsToCreate.push({
        orderId,
        userId: order.seller.parentId,
        level: 2,
        rate: new Prisma.Decimal(l2Rate),
        baseAmount: order.total,
        amount: new Prisma.Decimal(l2Amount),
        status: initialStatus,
      });

      this.logger.log(
        `L2 commission for parent ${order.seller.parentId}: ${l2Amount} (rate: ${l2Rate})`,
      );
    }

    await this.prisma.commission.createMany({ data: commissionsToCreate });

    this.logger.log(
      `Created ${commissionsToCreate.length} commission(s) for order ${orderId}`,
    );
  }

  /**
   * Approve all PENDING commissions for a specific order (called when payment is received).
   */
  async approveCommissionsForOrder(orderId: string): Promise<void> {
    const result = await this.prisma.commission.updateMany({
      where: { orderId, status: CommissionStatus.PENDING },
      data: { status: CommissionStatus.APPROVED },
    });
    if (result.count > 0) {
      this.logger.log(`Approved ${result.count} commission(s) for order ${orderId}`);
    }
  }

  /**
   * Approve a pending commission.
   */
  async approve(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) {
      throw new NotFoundException(
        `Commission ${commissionId} not found`,
      );
    }

    if (commission.status !== CommissionStatus.PENDING) {
      throw new BadRequestException(
        `Commission ${commissionId} is not PENDING (current status: ${commission.status})`,
      );
    }

    const updated = await this.prisma.commission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.APPROVED },
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { name: true, email: true } },
      },
    });

    this.logger.log(`Commission ${commissionId} approved`);
    return updated;
  }

  /**
   * Bulk approve multiple pending commissions.
   */
  async bulkApprove(commissionIds: string[]): Promise<number> {
    if (!commissionIds.length) {
      return 0;
    }

    const result = await this.prisma.commission.updateMany({
      where: {
        id: { in: commissionIds },
        status: CommissionStatus.PENDING,
      },
      data: { status: CommissionStatus.APPROVED },
    });

    this.logger.log(`Bulk approved ${result.count} commissions`);
    return result.count;
  }

  /**
   * Reverse a commission (e.g., on order refund/cancellation).
   */
  async reverse(commissionId: string, reason?: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) {
      throw new NotFoundException(
        `Commission ${commissionId} not found`,
      );
    }

    if (commission.status === CommissionStatus.PAID) {
      throw new BadRequestException(
        `Cannot reverse a PAID commission. Commission ${commissionId} must be handled via payout adjustment.`,
      );
    }

    if (commission.status === CommissionStatus.REVERSED) {
      throw new BadRequestException(
        `Commission ${commissionId} is already reversed`,
      );
    }

    const updated = await this.prisma.commission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.REVERSED },
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { name: true, email: true } },
      },
    });

    this.logger.log(
      `Commission ${commissionId} reversed${reason ? `: ${reason}` : ''}`,
    );
    return updated;
  }

  /**
   * Reverse all commissions for an order (e.g., on full refund).
   */
  async reverseAllForOrder(orderId: string, reason?: string): Promise<number> {
    const result = await this.prisma.commission.updateMany({
      where: {
        orderId,
        status: { in: [CommissionStatus.PENDING, CommissionStatus.APPROVED] },
      },
      data: { status: CommissionStatus.REVERSED },
    });

    this.logger.log(
      `Reversed ${result.count} commission(s) for order ${orderId}${reason ? `: ${reason}` : ''}`,
    );
    return result.count;
  }

  /**
   * Get commission summary for a seller.
   */
  async getSellerSummary(userId?: string): Promise<{
    pending: number;
    approved: number;
    paid: number;
    totalPaidOut: number;
    availableForPayout: number;
    total: number;
  }> {
    const whereBase: Prisma.CommissionWhereInput = {
      status: { not: CommissionStatus.REVERSED },
    };
    if (userId) {
      whereBase.userId = userId;
    }

    const payoutWhere: Prisma.SellerPayoutWhereInput = {
      status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
    };
    if (userId) {
      payoutWhere.userId = userId;
    }

    const [aggregations, payoutAgg] = await Promise.all([
      this.prisma.commission.groupBy({
        by: ['status'],
        where: whereBase,
        _sum: { amount: true },
      }),
      this.prisma.sellerPayout.aggregate({
        where: payoutWhere,
        _sum: { amount: true },
      }),
    ]);

    const result = { pending: 0, approved: 0, paid: 0, totalPaidOut: 0, availableForPayout: 0, total: 0 };

    for (const agg of aggregations) {
      const amount = agg._sum.amount?.toNumber() ?? 0;
      switch (agg.status) {
        case CommissionStatus.PENDING:
          result.pending = amount;
          break;
        case CommissionStatus.APPROVED:
          result.approved = amount;
          break;
        case CommissionStatus.PAID:
          result.paid = amount;
          break;
      }
    }

    result.total = result.pending + result.approved + result.paid;
    result.totalPaidOut = payoutAgg._sum.amount?.toNumber() ?? 0;
    result.availableForPayout = Math.max(0, result.total - result.totalPaidOut);
    return result;
  }

  private normalizeScaleTiers(raw: unknown): CommissionScaleTier[] {
    if (!Array.isArray(raw)) return [];

    const tiers: CommissionScaleTier[] = [];

    for (const tier of raw) {
      const row = tier as Record<string, unknown>;
      const minSales = Number(row?.minSales);
      const maxRaw = row?.maxSales;
      const maxSales =
        maxRaw === null || maxRaw === undefined || maxRaw === ''
          ? undefined
          : Number(maxRaw);
      const ratePercent = Number(row?.ratePercent);

      if (!Number.isFinite(minSales) || !Number.isFinite(ratePercent)) continue;
      if (minSales < 0 || ratePercent < 0 || ratePercent > 100) continue;
      if (maxSales !== undefined && (!Number.isFinite(maxSales) || maxSales < minSales)) continue;

      tiers.push({ minSales, maxSales, ratePercent });
    }

    tiers.sort((a, b) => a.minSales - b.minSales);

    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const cur = tiers[i];
      if (prev.maxSales === undefined || cur.minSales <= prev.maxSales) {
        throw new BadRequestException('Escala de comisiones invalida (solapamiento de tramos)');
      }
    }

    return tiers;
  }

  private async getGlobalScaleTiers(): Promise<CommissionScaleTier[]> {
    const raw = await this.settingsService.get('commission_scale_tiers_json');
    if (!raw) return [];
    try {
      return this.normalizeScaleTiers(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  private pickTierRate(salesBase: number, tiers: CommissionScaleTier[]): number {
    if (tiers.length === 0) return 0;

    const tier = tiers.find((row) => {
      const meetsMin = salesBase >= row.minSales;
      const meetsMax = row.maxSales === undefined ? true : salesBase <= row.maxSales;
      return meetsMin && meetsMax;
    });

    return tier ? tier.ratePercent / 100 : 0;
  }

  async getMonthlyBonuses(params?: { year?: number; month?: number; sellerId?: string }) {
    return this.prisma.monthlyCommissionBonus.findMany({
      where: {
        year: params?.year,
        month: params?.month,
        sellerId: params?.sellerId,
      },
      include: {
        seller: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async retryMonthlyBonus(id: string) {
    const record = await this.prisma.monthlyCommissionBonus.findUnique({
      where: { id },
      include: { seller: { select: { id: true, name: true } } },
    });

    if (!record) {
      throw new NotFoundException('Bono mensual no encontrado');
    }

    if (record.status !== MonthlyCommissionBonusStatus.FAILED) {
      throw new BadRequestException('Solo se pueden reintentar bonos con estado FAILED');
    }

    const odooEntry = await this.odooService.createMonthlyCommissionBonusJournalEntry({
      sellerName: record.seller.name,
      amount: record.bonusAmount.toNumber(),
      year: record.year,
      month: record.month,
    });

    return this.prisma.monthlyCommissionBonus.update({
      where: { id },
      data: {
        status: odooEntry
          ? MonthlyCommissionBonusStatus.POSTED
          : MonthlyCommissionBonusStatus.FAILED,
        odooMoveId: odooEntry?.moveId ?? record.odooMoveId,
        odooMoveName: odooEntry?.moveName ?? record.odooMoveName,
        errorMessage: odooEntry ? null : 'Reintento fallido: no se pudo crear el asiento en Odoo',
        processedAt: new Date(),
      },
      include: { seller: { select: { id: true, name: true, email: true } } },
    });
  }

  async processMonthlyScaleBonuses(year: number, month: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('Mes invalido');
    }

    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const eligibleStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const [sellers, globalScale] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: { in: [UserRole.SELLER_L1, UserRole.SELLER_L2] },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          commissionRate: true,
          commissionScaleEnabled: true,
          commissionScaleUseGlobal: true,
          commissionScaleOverride: true,
        },
      }),
      this.getGlobalScaleTiers(),
    ]);

    const results: Array<{ sellerId: string; status: string; bonusAmount: number }> = [];

    for (const seller of sellers) {
      const existing = await this.prisma.monthlyCommissionBonus.findUnique({
        where: {
          sellerId_year_month: {
            sellerId: seller.id,
            year,
            month,
          },
        },
      });

      if (existing) {
        results.push({
          sellerId: seller.id,
          status: `SKIPPED_EXISTING_${existing.status}`,
          bonusAmount: existing.bonusAmount.toNumber(),
        });
        continue;
      }

      const salesAgg = await this.prisma.order.aggregate({
        where: {
          sellerId: seller.id,
          status: { in: eligibleStatuses },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        _sum: { total: true },
      });

      const salesBase = salesAgg._sum.total?.toNumber() ?? 0;
      const baseRate = seller.commissionRate.toNumber();

      if (!seller.commissionScaleEnabled) {
        await this.prisma.monthlyCommissionBonus.create({
          data: {
            sellerId: seller.id,
            year,
            month,
            salesBase: new Prisma.Decimal(salesBase),
            baseRate: new Prisma.Decimal(baseRate),
            tierRate: new Prisma.Decimal(baseRate),
            deltaRate: new Prisma.Decimal(0),
            bonusAmount: new Prisma.Decimal(0),
            scaleSource: 'GLOBAL',
            scaleSnapshot: globalScale as Prisma.InputJsonValue,
            status: MonthlyCommissionBonusStatus.SKIPPED_DISABLED,
            processedAt: new Date(),
          },
        });

        results.push({ sellerId: seller.id, status: 'SKIPPED_DISABLED', bonusAmount: 0 });
        continue;
      }

      const overrideScale = this.normalizeScaleTiers(seller.commissionScaleOverride);
      const effectiveScale = seller.commissionScaleUseGlobal
        ? globalScale
        : (overrideScale.length > 0 ? overrideScale : globalScale);
      const source = seller.commissionScaleUseGlobal ? 'GLOBAL' : 'SELLER_OVERRIDE';

      const tierRate = this.pickTierRate(salesBase, effectiveScale);
      const deltaRate = Math.max(0, tierRate - baseRate);
      const bonusAmount = Math.round(salesBase * deltaRate * 100) / 100;

      if (bonusAmount <= 0) {
        await this.prisma.monthlyCommissionBonus.create({
          data: {
            sellerId: seller.id,
            year,
            month,
            salesBase: new Prisma.Decimal(salesBase),
            baseRate: new Prisma.Decimal(baseRate),
            tierRate: new Prisma.Decimal(tierRate),
            deltaRate: new Prisma.Decimal(deltaRate),
            bonusAmount: new Prisma.Decimal(0),
            scaleSource: source,
            scaleSnapshot: effectiveScale as Prisma.InputJsonValue,
            status: MonthlyCommissionBonusStatus.SKIPPED_NO_DELTA,
            processedAt: new Date(),
          },
        });

        results.push({ sellerId: seller.id, status: 'SKIPPED_NO_DELTA', bonusAmount: 0 });
        continue;
      }

      const odooEntry = await this.odooService.createMonthlyCommissionBonusJournalEntry({
        sellerName: seller.name,
        amount: bonusAmount,
        year,
        month,
      });

      await this.prisma.monthlyCommissionBonus.create({
        data: {
          sellerId: seller.id,
          year,
          month,
          salesBase: new Prisma.Decimal(salesBase),
          baseRate: new Prisma.Decimal(baseRate),
          tierRate: new Prisma.Decimal(tierRate),
          deltaRate: new Prisma.Decimal(deltaRate),
          bonusAmount: new Prisma.Decimal(bonusAmount),
          scaleSource: source,
          scaleSnapshot: effectiveScale as Prisma.InputJsonValue,
          status: odooEntry ? MonthlyCommissionBonusStatus.POSTED : MonthlyCommissionBonusStatus.FAILED,
          odooMoveId: odooEntry?.moveId,
          odooMoveName: odooEntry?.moveName,
          errorMessage: odooEntry ? null : 'No se pudo crear el asiento en Odoo',
          processedAt: new Date(),
        },
      });

      results.push({
        sellerId: seller.id,
        status: odooEntry ? 'POSTED' : 'FAILED',
        bonusAmount,
      });
    }

    return {
      year,
      month,
      total: results.length,
      posted: results.filter((r) => r.status === 'POSTED').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      skipped: results.filter((r) => r.status.startsWith('SKIPPED')).length,
      results,
    };
  }

  /**
   * Get all commissions with filters and pagination.
   */
  async findAll(filters: CommissionFilters): Promise<PaginatedResponse<any>> {
    const page = filters.page ?? PAGINATION.DEFAULT_PAGE;
    const pageSize = Math.min(
      filters.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE,
      PAGINATION.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const where: Prisma.CommissionWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.orderId) {
      where.orderId = filters.orderId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.level) {
      where.level = filters.level;
    }
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.createdAt.lte = filters.toDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, total: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      this.prisma.commission.count({ where }),
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
}
