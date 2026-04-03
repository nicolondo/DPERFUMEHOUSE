import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PayoutStatus, CommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';
import { PAGINATION } from '@dperfumehouse/config';
import { PaginatedResponse } from '@dperfumehouse/types';

export interface CreatePayoutDto {
  userId: string;
  amount: number;
  method: string; // 'bank_transfer' | 'usdt'
  reference?: string;
}

export interface PayoutFilters {
  userId?: string;
  status?: PayoutStatus;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooService: OdooService,
  ) {}

  /**
   * Create a payout for a seller.
   * Validates against real available balance (total earned - all non-failed payouts).
   * Links specific APPROVED commissions to this payout.
   */
  async create(dto: CreatePayoutDto) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

    // Calculate real available balance:
    // total earned commissions - all payouts that are not FAILED
    const [totalCommissionsAgg, existingPayoutsAgg] = await Promise.all([
      this.prisma.commission.aggregate({
        where: {
          userId: dto.userId,
          status: { in: [CommissionStatus.PENDING, CommissionStatus.APPROVED, CommissionStatus.PAID] },
        },
        _sum: { amount: true },
      }),
      this.prisma.sellerPayout.aggregate({
        where: {
          userId: dto.userId,
          status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING, PayoutStatus.COMPLETED] },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalEarned = totalCommissionsAgg._sum.amount?.toNumber() ?? 0;
    const totalInPayouts = existingPayoutsAgg._sum.amount?.toNumber() ?? 0;
    const availableBalance = Math.max(0, totalEarned - totalInPayouts);

    if (dto.amount > availableBalance) {
      throw new BadRequestException(
        `El monto del pago ($${dto.amount.toLocaleString()}) excede el saldo disponible ($${availableBalance.toLocaleString()})`,
      );
    }

    // Link APPROVED commissions to this payout (FIFO by creation date)
    const unlinkedApproved = await this.prisma.commission.findMany({
      where: {
        userId: dto.userId,
        status: CommissionStatus.APPROVED,
        payoutId: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    let remaining = dto.amount;
    const commissionIdsToLink: string[] = [];
    for (const c of unlinkedApproved) {
      if (remaining <= 0) break;
      const amt = c.amount.toNumber();
      if (amt <= remaining) {
        commissionIdsToLink.push(c.id);
        remaining -= amt;
      }
    }

    const payout = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sellerPayout.create({
        data: {
          userId: dto.userId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          reference: dto.reference,
          status: PayoutStatus.PENDING,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Link commissions to this payout
      if (commissionIdsToLink.length > 0) {
        await tx.commission.updateMany({
          where: { id: { in: commissionIdsToLink } },
          data: { payoutId: created.id },
        });
      }

      return created;
    });

    this.logger.log(
      `Created payout ${payout.id} for user ${dto.userId}: ${dto.amount} via ${dto.method} (linked ${commissionIdsToLink.length} commissions)`,
    );

    return payout;
  }

  /**
   * Mark payout as processing.
   */
  async markProcessing(payoutId: string) {
    const payout = await this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(
        `Payout ${payoutId} is not PENDING (current status: ${payout.status})`,
      );
    }

    const updated = await this.prisma.sellerPayout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.PROCESSING,
        processedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Payout ${payoutId} marked as PROCESSING`);
    return updated;
  }

  /**
   * Complete a payout: mark it as COMPLETED and update associated
   * approved commissions to PAID.
   */
  async complete(payoutId: string) {
    const payout = await this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== PayoutStatus.PROCESSING) {
      throw new BadRequestException(
        `Payout ${payoutId} is not PROCESSING (current status: ${payout.status})`,
      );
    }

    // Use a transaction to complete the payout and mark commissions as paid
    const result = await this.prisma.$transaction(async (tx) => {
      // Mark payout as completed
      const updatedPayout = await tx.sellerPayout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.COMPLETED,
          processedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Mark linked commissions as PAID
      const linkedResult = await tx.commission.updateMany({
        where: {
          payoutId: payoutId,
          status: CommissionStatus.APPROVED,
        },
        data: {
          status: CommissionStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Also try to mark any remaining unlinked APPROVED commissions
      // up to the payout amount (handles legacy payouts without links)
      if (linkedResult.count === 0) {
        const approvedCommissions = await tx.commission.findMany({
          where: {
            userId: payout.userId,
            status: CommissionStatus.APPROVED,
            payoutId: null,
          },
          orderBy: { createdAt: 'asc' },
        });

        let remainingAmount = payout.amount.toNumber();
        const commissionIdsToUpdate: string[] = [];

        for (const commission of approvedCommissions) {
          if (remainingAmount <= 0) break;
          const commissionAmount = commission.amount.toNumber();
          if (commissionAmount <= remainingAmount) {
            commissionIdsToUpdate.push(commission.id);
            remainingAmount -= commissionAmount;
          }
        }

        if (commissionIdsToUpdate.length > 0) {
          await tx.commission.updateMany({
            where: { id: { in: commissionIdsToUpdate } },
            data: {
              status: CommissionStatus.PAID,
              paidAt: new Date(),
              payoutId: payoutId,
            },
          });
        }

        this.logger.log(
          `Payout ${payoutId} completed (legacy). Marked ${commissionIdsToUpdate.length} commission(s) as PAID.`,
        );
      } else {
        this.logger.log(
          `Payout ${payoutId} completed. Marked ${linkedResult.count} linked commission(s) as PAID.`,
        );
      }

      return updatedPayout;
    });

    // Create Odoo journal entry and save move ID + name
    const odooResult = await this.odooService.createCommissionPayoutJournalEntry({
      sellerName: result.user?.name ?? 'Vendedor',
      amount: payout.amount.toNumber(),
      paymentMethod: payout.method ?? 'CASH',
    });

    if (odooResult) {
      await this.prisma.sellerPayout.update({
        where: { id: payoutId },
        data: { odooMoveId: odooResult.moveId, odooMoveName: odooResult.moveName },
      });
      result.odooMoveId = odooResult.moveId;
      (result as any).odooMoveName = odooResult.moveName;
    }

    return result;
  }

  /**
   * Get all payouts with filters and pagination.
   */
  async findAll(filters: PayoutFilters): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, Number(filters.page) || PAGINATION.DEFAULT_PAGE);
    const pageSize = Math.min(
      Number(filters.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE,
      PAGINATION.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const where: Prisma.SellerPayoutWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.sellerPayout.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              bankName: true,
              bankAccountNumber: true,
              usdtWalletTrc20: true,
            },
          },
        },
      }),
      this.prisma.sellerPayout.count({ where }),
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
   * Get a single payout by ID.
   */
  async findOne(payoutId: string) {
    const payout = await this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            bankName: true,
            bankAccountType: true,
            bankAccountNumber: true,
            bankAccountHolder: true,
            usdtWalletTrc20: true,
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    return payout;
  }

  /**
   * Re-attempt Odoo journal entry for a COMPLETED payout that has no odooMoveId.
   * Useful to recover from Odoo sync failures without re-processing the payout.
   */
  async syncOdoo(payoutId: string) {
    const payout = await this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    if (payout.status !== PayoutStatus.COMPLETED) {
      throw new BadRequestException(
        `Payout ${payoutId} is not COMPLETED (status: ${payout.status}). Only completed payouts can be synced.`,
      );
    }

    if (payout.odooMoveId) {
      return { odooMoveId: payout.odooMoveId, odooMoveName: payout.odooMoveName, alreadySynced: true };
    }

    const odooResult = await this.odooService.createCommissionPayoutJournalEntry({
      sellerName: payout.user?.name ?? 'Vendedor',
      amount: payout.amount.toNumber(),
      paymentMethod: payout.method ?? 'CASH',
    });

    if (!odooResult) {
      throw new BadRequestException(
        `Failed to create Odoo journal entry for payout ${payoutId}. Check API logs for details.`,
      );
    }

    await this.prisma.sellerPayout.update({
      where: { id: payoutId },
      data: { odooMoveId: odooResult.moveId, odooMoveName: odooResult.moveName },
    });

    this.logger.log(`Payout ${payoutId} retroactively synced to Odoo: ${odooResult.moveName} (#${odooResult.moveId})`);
    return { odooMoveId: odooResult.moveId, odooMoveName: odooResult.moveName, alreadySynced: false };
  }
}
