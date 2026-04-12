import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  UpdateUserDto,
  UpdateBankInfoDto,
  ChangePasswordDto,
} from './dto/update-user.dto';
import { Prisma, UserRole } from '@prisma/client';

type CommissionScaleTier = {
  minSales: number;
  maxSales?: number;
  ratePercent: number;
};

const USER_SELECT: Prisma.UserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  parentId: true,
  commissionRate: true,
  commissionRateL2: true,
  commissionScaleEnabled: true,
  commissionScaleUseGlobal: true,
  commissionScaleOverride: true,
  bankName: true,
  bankAccountType: true,
  bankAccountNumber: true,
  bankAccountHolder: true,
  bankCertificateUrl: true,
  usdtWalletTrc20: true,
  canManageSellers: true,
  odooCompanyId: true,
  isActive: true,
  pendingApproval: true,
  allowedCategories: {
    select: { categoryName: true },
    orderBy: { categoryName: 'asc' },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  private parseCommissionSetting(value?: string | null, fallback = 0): number {
    if (!value) return fallback;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    // Backward-compatible: supports decimal storage (0.1) and percentage storage (10)
    return parsed <= 1 ? parsed : parsed / 100;
  }

  private normalizeCategories(categories?: string[] | null): string[] {
    if (!Array.isArray(categories)) return [];
    return [...new Set(categories.map((c) => c.trim()).filter(Boolean))];
  }

  private async getDefaultCommissionRates(): Promise<{ l1: number; l2: number }> {
    const l1Str = await this.settingsService.get('commission_l1_rate');
    const l2Str = await this.settingsService.get('commission_l2_rate');
    const l1 = this.parseCommissionSetting(l1Str, 0.10);
    const l2 = this.parseCommissionSetting(l2Str, 0.03);
    return { l1, l2 };
  }

  private normalizeCommissionScale(scale?: unknown): CommissionScaleTier[] {
    if (!Array.isArray(scale)) return [];

    const normalized = scale
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const minSales = Number(row?.minSales);
        const maxSalesRaw = row?.maxSales;
        const maxSales =
          maxSalesRaw === null || maxSalesRaw === undefined || maxSalesRaw === ''
            ? undefined
            : Number(maxSalesRaw);
        const ratePercent = Number(row?.ratePercent);

        if (!Number.isFinite(minSales) || minSales < 0) {
          throw new ConflictException('Escala invalida: minSales debe ser numero mayor o igual a 0');
        }
        if (maxSales !== undefined && (!Number.isFinite(maxSales) || maxSales < 0)) {
          throw new ConflictException('Escala invalida: maxSales debe ser numero mayor o igual a 0');
        }
        if (maxSales !== undefined && maxSales < minSales) {
          throw new ConflictException('Escala invalida: maxSales no puede ser menor que minSales');
        }
        if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
          throw new ConflictException('Escala invalida: ratePercent debe estar entre 0 y 100');
        }

        return {
          minSales,
          maxSales,
          ratePercent,
        };
      })
      .sort((a, b) => a.minSales - b.minSales);

    for (let i = 1; i < normalized.length; i++) {
      const prev = normalized[i - 1];
      const cur = normalized[i];
      if (prev.maxSales === undefined) {
        throw new ConflictException('Escala invalida: un tramo abierto debe ser el ultimo');
      }
      if (cur.minSales <= prev.maxSales) {
        throw new ConflictException('Escala invalida: hay solapamiento entre tramos');
      }
    }

    return normalized;
  }

  private async getGlobalCommissionScale(): Promise<CommissionScaleTier[]> {
    const raw = await this.settingsService.get('commission_scale_tiers_json');
    if (!raw) return [];
    try {
      return this.normalizeCommissionScale(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Este email ya está registrado');
    }

    if (dto.phone) {
      const phoneExists = await this.prisma.user.findFirst({
        where: { phone: dto.phone },
      });
      if (phoneExists) {
        throw new ConflictException('Este teléfono ya está registrado');
      }
    }

    if (dto.parentId) {
      const parent = await this.prisma.user.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent user not found');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Use provided rates or fall back to settings defaults
    const defaults = await this.getDefaultCommissionRates();
    const commissionRate = dto.commissionRate ?? defaults.l1;
    const commissionRateL2 = dto.commissionRateL2 ?? defaults.l2;
    const commissionScaleEnabled = dto.commissionScaleEnabled ?? false;
    const commissionScaleUseGlobal = dto.commissionScaleUseGlobal ?? true;
    const overrideScaleInput = this.normalizeCommissionScale(dto.commissionScaleOverride);
    const globalScale = await this.getGlobalCommissionScale();
    const commissionScaleOverride =
      commissionScaleEnabled && !commissionScaleUseGlobal
        ? (overrideScaleInput.length > 0 ? overrideScaleInput : globalScale)
        : undefined;
    const normalizedCategories = this.normalizeCategories(dto.allowedCategories);
    const defaultCategory = (await this.settingsService.get('default_new_user_category'))?.trim();
    const categoriesForNewUser = normalizedCategories.length > 0
      ? normalizedCategories
      : (defaultCategory ? [defaultCategory] : []);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        parentId: dto.parentId,
        commissionRate,
        commissionRateL2,
        commissionScaleEnabled,
        commissionScaleUseGlobal,
        ...(commissionScaleOverride ? { commissionScaleOverride } : {}),
        canManageSellers: dto.canManageSellers,
        odooCompanyId: dto.odooCompanyId,
        sellerCode: (dto.role === 'SELLER_L1' || dto.role === 'SELLER_L2')
          ? `${dto.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20)}-${crypto.randomBytes(2).toString('hex')}`
          : undefined,
        allowedCategories: categoriesForNewUser.length > 0
          ? {
              create: categoriesForNewUser.map((categoryName) => ({ categoryName })),
            }
          : undefined,
      },
      select: USER_SELECT,
    });

    return user;
  }

  async findAll(filters?: {
    role?: UserRole;
    parentId?: string;
    isActive?: boolean;
    pendingApproval?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters?.role) where.role = filters.role;
    if (filters?.parentId) where.parentId = filters.parentId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.pendingApproval !== undefined) where.pendingApproval = filters.pendingApproval;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const { OrderStatus } = await import('@prisma/client');
    const paidStatuses = [
      OrderStatus.PAID,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const [user, totalRevenueAgg, totalOrders, totalCommissionsAgg] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        select: {
          ...USER_SELECT,
          parent: {
            select: { id: true, name: true, email: true },
          },
          children: {
            select: { id: true, name: true, email: true, role: true },
          },
          commissions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              amount: true,
              status: true,
              level: true,
              rate: true,
              createdAt: true,
              order: {
                select: { id: true, orderNumber: true, total: true },
              },
            },
          },
        },
      }),
      this.prisma.order.aggregate({
        where: { sellerId: id, status: { in: paidStatuses } },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { sellerId: id, status: { in: paidStatuses } },
      }),
      this.prisma.commission.aggregate({
        where: { userId: id },
        _sum: { amount: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      totalRevenue: (totalRevenueAgg._sum as any).total?.toNumber() ?? 0,
      totalOrders,
      totalCommissions: (totalCommissionsAgg._sum as any).amount?.toNumber() ?? 0,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const previousState = await this.prisma.user.findUnique({
      where: { id },
      select: {
        email: true,
        name: true,
        pendingApproval: true,
        isActive: true,
      },
    });

    await this.findOne(id);

    if (dto.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (emailExists) {
        throw new ConflictException('Este email ya está registrado');
      }
    }

    if (dto.phone) {
      const phoneExists = await this.prisma.user.findFirst({
        where: { phone: dto.phone, id: { not: id } },
      });
      if (phoneExists) {
        throw new ConflictException('Este teléfono ya está registrado');
      }
    }

    if (dto.parentId) {
      const parent = await this.prisma.user.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent user not found');
      }
      if (dto.parentId === id) {
        throw new ConflictException('User cannot be their own parent');
      }
    }

    const normalizedCategories =
      dto.allowedCategories === undefined
        ? undefined
        : this.normalizeCategories(dto.allowedCategories);

    const hasScaleConfigChange =
      dto.commissionScaleEnabled !== undefined ||
      dto.commissionScaleUseGlobal !== undefined ||
      dto.commissionScaleOverride !== undefined;

    const currentUserForScale = hasScaleConfigChange
      ? await this.prisma.user.findUnique({
          where: { id },
          select: {
            commissionScaleEnabled: true,
            commissionScaleUseGlobal: true,
            commissionScaleOverride: true,
          },
        })
      : null;

    const globalScale = hasScaleConfigChange ? await this.getGlobalCommissionScale() : [];
    const overrideScaleInput =
      dto.commissionScaleOverride !== undefined
        ? this.normalizeCommissionScale(dto.commissionScaleOverride)
        : undefined;

    const nextCommissionScaleEnabled =
      dto.commissionScaleEnabled ?? currentUserForScale?.commissionScaleEnabled ?? false;
    const nextCommissionScaleUseGlobal =
      dto.commissionScaleUseGlobal ?? currentUserForScale?.commissionScaleUseGlobal ?? true;

    let nextCommissionScaleOverride: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined =
      undefined;

    if (hasScaleConfigChange) {
      if (!nextCommissionScaleEnabled || nextCommissionScaleUseGlobal) {
        nextCommissionScaleOverride = Prisma.JsonNull;
      } else if (overrideScaleInput !== undefined) {
        nextCommissionScaleOverride =
          overrideScaleInput.length > 0 ? (overrideScaleInput as Prisma.InputJsonValue) : (globalScale as Prisma.InputJsonValue);
      } else {
        const currentOverride = Array.isArray(currentUserForScale?.commissionScaleOverride)
          ? this.normalizeCommissionScale(currentUserForScale?.commissionScaleOverride)
          : [];
        nextCommissionScaleOverride =
          (currentOverride.length > 0 ? currentOverride : globalScale) as Prisma.InputJsonValue;
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          role: dto.role,
          parentId: dto.parentId,
          commissionRate: dto.commissionRate,
          commissionRateL2: dto.commissionRateL2,
          commissionScaleEnabled: nextCommissionScaleEnabled,
          commissionScaleUseGlobal: nextCommissionScaleUseGlobal,
          ...(hasScaleConfigChange ? { commissionScaleOverride: nextCommissionScaleOverride } : {}),
          isActive: dto.isActive,
          pendingApproval: dto.pendingApproval,
          canManageSellers: dto.canManageSellers,
          odooCompanyId: dto.odooCompanyId,
          bankName: dto.bankName,
          bankAccountType: dto.bankAccountType,
          bankAccountNumber: dto.bankAccountNumber,
          bankAccountHolder: dto.bankAccountHolder,
          bankCertificateUrl: dto.bankCertificateUrl,
          usdtWalletTrc20: dto.usdtWalletTrc20,
          sellerCode: dto.sellerCode !== undefined ? dto.sellerCode || null : undefined,
        },
        select: USER_SELECT,
      });

      if (normalizedCategories !== undefined) {
        await tx.userAllowedCategory.deleteMany({ where: { userId: id } });
        if (normalizedCategories.length > 0) {
          await tx.userAllowedCategory.createMany({
            data: normalizedCategories.map((categoryName) => ({
              userId: id,
              categoryName,
            })),
          });
        }

        return tx.user.findUniqueOrThrow({
          where: { id },
          select: USER_SELECT,
        });
      }

      return updated;
    });

    const wasPending = previousState?.pendingApproval === true;
    const nowApprovedAndActive = user.pendingApproval === false && user.isActive === true;

    if (wasPending && nowApprovedAndActive) {
      const loginUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000') + '/login';
      await this.emailService.sendRegistrationApprovedWelcome(
        user.email,
        user.name,
        loginUrl,
      );
    }

    return user;
  }

  async updateBankInfo(userId: string, dto: UpdateBankInfoDto) {
    await this.findOne(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        bankName: dto.bankName,
        bankAccountType: dto.bankAccountType,
        bankAccountNumber: dto.bankAccountNumber,
        bankAccountHolder: dto.bankAccountHolder,
        bankCertificateUrl: dto.bankCertificateUrl,
        usdtWalletTrc20: dto.usdtWalletTrc20,
      },
      select: USER_SELECT,
    });

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash, refreshToken: null },
    });

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string) {
    const profile = await this.findOne(userId);
    if (profile.commissionScaleEnabled) {
      const tiers = profile.commissionScaleUseGlobal
        ? await this.getGlobalCommissionScale()
        : (Array.isArray(profile.commissionScaleOverride) ? profile.commissionScaleOverride as CommissionScaleTier[] : []);
      return { ...profile, effectiveScaleTiers: tiers };
    }
    return profile;
  }

  async getDownline(userId: string) {
    const directChildren = await this.prisma.user.findMany({
      where: { parentId: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        commissionRate: true,
        commissionRateL2: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { children: true, orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return directChildren;
  }

  async getDownlineSeller(parentId: string, childId: string) {
    const child = await this.prisma.user.findFirst({
      where: { id: childId, parentId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        commissionRate: true,
        commissionRateL2: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!child) {
      throw new NotFoundException('Vendedor no encontrado en tu equipo');
    }

    // Get summary stats
    const [totalRevenue, ordersByStatus] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          sellerId: childId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { sellerId: childId },
        _count: true,
      }),
    ]);

    return {
      ...child,
      stats: {
        totalRevenue: totalRevenue._sum.total?.toNumber() || 0,
        ordersByStatus: ordersByStatus.reduce(
          (acc, item) => ({ ...acc, [item.status]: item._count }),
          {} as Record<string, number>,
        ),
      },
    };
  }

  async createSubSeller(parentId: string, dto: { name: string; email: string; phone?: string; phoneCode?: string }) {
    const parent = await this.prisma.user.findUnique({
      where: { id: parentId },
      select: { id: true, canManageSellers: true, role: true, name: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent user not found');
    }

    if (!parent.canManageSellers) {
      throw new ForbiddenException('No tienes permiso para gestionar vendedores');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Este email ya está registrado');
    }

    if (dto.phone) {
      const phoneExists = await this.prisma.user.findFirst({
        where: { phone: dto.phone },
      });
      if (phoneExists) {
        throw new ConflictException('Este teléfono ya está registrado');
      }
    }

    // Auto-generate a random temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Generate a reset token so the user can set their own password
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const tokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    const defaultCategory = (await this.settingsService.get('default_new_user_category'))?.trim();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        phoneCode: dto.phoneCode,
        role: 'SELLER_L2',
        parentId,
        isActive: true,
        resetToken: hashedToken,
        resetTokenExpiry: tokenExpiry,
        sellerCode: `${dto.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20)}-${crypto.randomBytes(2).toString('hex')}`,
        allowedCategories: defaultCategory
          ? {
              create: [{ categoryName: defaultCategory }],
            }
          : undefined,
      },
      select: USER_SELECT,
    });

    // Send welcome email with set-password link
    const frontendUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3000');
    const setPasswordUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.emailService.sendWelcomeEmail(
      dto.email,
      dto.name,
      parent.name,
      setPasswordUrl,
    );

    return user;
  }

  async delete(userId: string) {
    const user = await this.findOne(userId);

    // Cannot delete yourself (implicit — admin can't delete admin easily)
    // Check for orders
    const orderCount = await this.prisma.order.count({ where: { sellerId: userId } });
    if (orderCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el usuario porque tiene ${orderCount} pedido(s) asociado(s)`,
      );
    }

    // Check for customers
    const customerCount = await this.prisma.customer.count({ where: { sellerId: userId } });
    if (customerCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el usuario porque tiene ${customerCount} cliente(s) asociado(s)`,
      );
    }

    // Check for child sellers
    const childCount = await this.prisma.user.count({ where: { parentId: userId } });
    if (childCount > 0) {
      throw new ConflictException(
        `No se puede eliminar el usuario porque tiene ${childCount} sub-vendedor(es) asociado(s)`,
      );
    }

    // Clean up related data
    await this.prisma.$transaction(async (tx) => {
      await tx.userAllowedCategory.deleteMany({ where: { userId } });
      await tx.commission.deleteMany({ where: { userId } });
      await tx.lead.deleteMany({ where: { sellerId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { deleted: true };
  }
}
