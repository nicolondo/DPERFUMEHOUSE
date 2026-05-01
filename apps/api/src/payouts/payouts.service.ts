import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PayoutStatus, CommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';
import { WompiService } from '../wompi/wompi.service';
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
    private readonly wompi: WompiService,
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

  // ========================================================================
  // Wompi Third-Party Payments — Pay all pending payouts in a single batch
  // ========================================================================

  /**
   * Aggregates pending amounts per seller from APPROVED unlinked commissions only.
   * Validates bank data and Wompi bank mapping. Returns eligible/excluded.
   */
  async previewPendingForWompi() {
    // APPROVED & unlinked commissions grouped by user
    const approvedAgg = await this.prisma.commission.groupBy({
      by: ['userId'],
      where: {
        status: CommissionStatus.APPROVED,
        payoutId: null,
      },
      _sum: { amount: true },
    });

    const userIds = approvedAgg.map((a) => a.userId);

    if (userIds.length === 0) {
      return {
        eligible: [],
        excluded: [],
        totalEligible: 0,
        totalEligibleCount: 0,
        totalExcludedCount: 0,
      };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        bankName: true,
        bankAccountType: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
        identificationNumber: true,
      },
    });

    const approvedByUser = new Map<string, number>();
    for (const a of approvedAgg) {
      approvedByUser.set(a.userId, a._sum.amount?.toNumber() ?? 0);
    }

    // Compute "available for payout" per user (same logic as commission summary):
    // available = (sum of all non-REVERSED commissions) - (sum of payouts in PENDING/PROCESSING/COMPLETED)
    const [allCommissionsAgg, payoutsAgg] = await Promise.all([
      this.prisma.commission.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          status: { not: CommissionStatus.REVERSED },
        },
        _sum: { amount: true },
      }),
      this.prisma.sellerPayout.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalCommByUser = new Map<string, number>();
    for (const a of allCommissionsAgg) {
      totalCommByUser.set(a.userId, a._sum.amount?.toNumber() ?? 0);
    }
    const totalPaidOutByUser = new Map<string, number>();
    for (const a of payoutsAgg) {
      totalPaidOutByUser.set(a.userId, a._sum.amount?.toNumber() ?? 0);
    }

    type Eligible = {
      userId: string;
      userName: string | null;
      userEmail: string | null;
      bankName: string | null;
      bankId: string;
      accountType: string | null;
      accountNumber: string | null;
      accountHolder: string | null;
      identificationNumber: string | null;
      approvedAmount: number;
      totalAmount: number;
    };
    type Excluded = {
      userId: string;
      userName: string | null;
      userEmail: string | null;
      amount: number;
      reason: string;
    };

    const eligible: Eligible[] = [];
    const excluded: Excluded[] = [];

    for (const u of users) {
      const approvedAmount = approvedByUser.get(u.id) ?? 0;
      if (approvedAmount <= 0) continue;

      // Cap payable amount by availableForPayout (matches manual "Crear Pago" modal logic)
      const totalComm = totalCommByUser.get(u.id) ?? 0;
      const totalPaidOut = totalPaidOutByUser.get(u.id) ?? 0;
      const availableForPayout = Math.max(0, totalComm - totalPaidOut);
      const payableAmount = Math.min(approvedAmount, availableForPayout);

      if (payableAmount <= 0) {
        excluded.push({
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          amount: approvedAmount,
          reason: `Sin saldo disponible (ya pagado ${totalPaidOut.toLocaleString('es-CO')} de ${totalComm.toLocaleString('es-CO')})`,
        });
        continue;
      }

      const missing: string[] = [];
      if (!u.bankName) missing.push('banco');
      if (!u.bankAccountNumber) missing.push('cuenta');
      if (!u.bankAccountType) missing.push('tipo cuenta');
      if (!u.bankAccountHolder) missing.push('titular');
      if (!u.identificationNumber) missing.push('cédula');
      if (!u.email) missing.push('email');
      if (missing.length > 0) {
        excluded.push({
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          amount: payableAmount,
          reason: `Faltan datos bancarios: ${missing.join(', ')}`,
        });
        continue;
      }

      let bankId: string | null = null;
      try {
        bankId = await this.wompi.resolveBankId(u.bankName!);
      } catch (err: any) {
        excluded.push({
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          amount: payableAmount,
          reason: `Error consultando bancos Wompi: ${err.message}`,
        });
        continue;
      }
      if (!bankId) {
        excluded.push({
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          amount: payableAmount,
          reason: `Banco "${u.bankName}" no se pudo mapear a Wompi`,
        });
        continue;
      }

      eligible.push({
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        bankName: u.bankName,
        bankId,
        accountType: u.bankAccountType,
        accountNumber: u.bankAccountNumber,
        accountHolder: u.bankAccountHolder,
        identificationNumber: u.identificationNumber,
        approvedAmount: payableAmount,
        totalAmount: payableAmount,
      });
    }

    const totalEligible = eligible.reduce((acc, e) => acc + e.totalAmount, 0);

    return {
      eligible,
      excluded,
      totalEligible,
      totalEligibleCount: eligible.length,
      totalExcludedCount: excluded.length,
    };
  }

  /**
   * Creates a single Wompi batch with one transaction per eligible seller,
   * paying their APPROVED unlinked commissions. Creates a new SellerPayout
   * per seller, links the commissions to it, and marks it PROCESSING.
   */
  async payAllPendingViaWompi() {
    const preview = await this.previewPendingForWompi();
    if (preview.eligible.length === 0) {
      throw new BadRequestException(
        'No hay comisiones aprobadas elegibles para pagar con Wompi',
      );
    }

    const accountId = await this.wompi.getAccountId();

    const normalizeAccountType = (t: string): 'AHORROS' | 'CORRIENTE' => {
      const v = (t || '').toLowerCase();
      if (v.includes('corr') || v.includes('check')) return 'CORRIENTE';
      return 'AHORROS';
    };

    const detectLegalIdType = (id: string): 'CC' | 'NIT' | 'CE' => {
      const digits = (id || '').replace(/\D/g, '');
      if (digits.length >= 9 && digits.length <= 10) return 'NIT';
      return 'CC';
    };

    const batchRef = `dph-${Date.now()}`;

    // Create one SellerPayout per eligible seller, linking their APPROVED commissions
    type Prepared = {
      payoutId: string;
      eligible: typeof preview.eligible[number];
    };
    const prepared: Prepared[] = [];

    for (const e of preview.eligible) {
      let payoutId: string | null = null;

      await this.prisma.$transaction(async (tx) => {
        const created = await tx.sellerPayout.create({
          data: {
            userId: e.userId,
            amount: new Prisma.Decimal(0),
            method: 'WOMPI',
            status: PayoutStatus.PENDING,
          },
        });
        payoutId = created.id;

        // Link APPROVED unlinked commissions oldest-first up to e.totalAmount (capped by availableForPayout)
        const candidates = await tx.commission.findMany({
          where: {
            userId: e.userId,
            status: CommissionStatus.APPROVED,
            payoutId: null,
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, amount: true },
        });
        const cap = e.totalAmount;
        const idsToLink: string[] = [];
        let running = 0;
        for (const c of candidates) {
          const amt = c.amount.toNumber();
          if (running + amt > cap + 0.5) break; // small epsilon to avoid float issues
          idsToLink.push(c.id);
          running += amt;
        }
        if (idsToLink.length > 0) {
          await tx.commission.updateMany({
            where: { id: { in: idsToLink } },
            data: { payoutId },
          });
        }

        // Use the capped totalAmount as the payout amount (may differ slightly from linked sum if no exact match)
        await tx.sellerPayout.update({
          where: { id: payoutId! },
          data: { amount: new Prisma.Decimal(e.totalAmount) },
        });
      });

      if (payoutId) prepared.push({ payoutId, eligible: e });
    }

    // Build Wompi transactions
    const transactions = prepared.map(({ payoutId, eligible: e }) => ({
      legalIdType: detectLegalIdType(e.identificationNumber || ''),
      legalId: (e.identificationNumber || '').replace(/\D/g, ''),
      bankId: e.bankId,
      accountType: normalizeAccountType(e.accountType || ''),
      accountNumber: (e.accountNumber || '').replace(/\D/g, ''),
      name: e.accountHolder || e.userName || '',
      email: e.userEmail || '',
      amount: Math.round(e.totalAmount * 100), // COP cents
      reference: `p-${payoutId.replace(/-/g, '')}`.slice(0, 40),
    }));

    const idempotencyKey = `dph-batch-${batchRef}`;

    let response: any;
    try {
      response = await this.wompi.createBatch(
        {
          reference: batchRef,
          accountId,
          paymentType: 'OTHER',
          transactions,
        },
        idempotencyKey,
      );
    } catch (err: any) {
      this.logger.error(
        `Wompi batch creation failed: ${JSON.stringify(err?.response ?? err?.message)}`,
      );
      throw err;
    }

    const batchId: string | undefined = response?.id || response?.data?.id;
    const txnList: Array<any> =
      response?.transactions || response?.data?.transactions || [];

    const txnByRef = new Map<string, any>();
    for (const t of txnList) {
      const ref = t?.reference || t?.transactionReference;
      if (ref) txnByRef.set(ref, t);
    }

    await this.prisma.$transaction(
      prepared.map(({ payoutId }) => {
        const txn = txnByRef.get(`payout-${payoutId}`);
        return this.prisma.sellerPayout.update({
          where: { id: payoutId },
          data: {
            status: PayoutStatus.PROCESSING,
            method: 'WOMPI',
            wompiBatchId: batchId ?? null,
            wompiTransactionId: txn?.id ?? null,
            wompiStatus: txn?.status ?? 'PENDING',
            reference: batchRef,
            processedAt: new Date(),
          },
        });
      }),
    );

    this.logger.log(
      `Wompi batch ${batchId} created with ${transactions.length} transactions (${preview.totalEligible} COP total)`,
    );

    return {
      batchId,
      batchReference: batchRef,
      response,
      processedPayouts: prepared.map((p) => p.payoutId),
      excluded: preview.excluded,
      totalAmount: preview.totalEligible,
      totalCount: prepared.length,
    };
  }
}
