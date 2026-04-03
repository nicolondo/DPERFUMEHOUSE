import { Injectable, Logger } from '@nestjs/common';
import {
  OrderStatus,
  CommissionStatus,
  PaymentStatus,
  PayoutStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  /**
   * Build seller dashboard data.
   */
  async getSellerDashboard(
    userId: string,
    period: 'week' | 'month' = 'month',
    offset: number = 0,
  ) {
    const { startDate, endDate, labels } = this.buildPeriodRange(
      period,
      offset,
    );

    const paidStatuses = [
      OrderStatus.PAID,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    // Total revenue from all completed orders
    const [totalRevenueAgg, totalOrders] = await Promise.all([
      this.prisma.order.aggregate({
        where: { sellerId: userId, status: { in: paidStatuses } },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { sellerId: userId, status: { in: paidStatuses } },
      }),
    ]);

    const totalRevenue = totalRevenueAgg._sum.total?.toNumber() ?? 0;

    // Period revenue
    const periodRevenueAgg = await this.prisma.order.aggregate({
      where: {
        sellerId: userId,
        status: { in: paidStatuses },
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { total: true },
    });

    const periodRevenue = periodRevenueAgg._sum.total?.toNumber() ?? 0;

    // Period data breakdown (daily or weekly)
    const periodOrders = await this.prisma.order.findMany({
      where: {
        sellerId: userId,
        status: { in: paidStatuses },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { total: true, createdAt: true },
    });

    const periodData = this.aggregateByPeriod(periodOrders, labels, period);

    // Build revenueByDay for the frontend chart
    const revenueByDay = this.buildRevenueByDay(periodOrders, startDate, endDate);

    // Commissions by day for the frontend chart toggle
    const periodCommissions = await this.prisma.commission.findMany({
      where: {
        userId,
        status: { in: [CommissionStatus.PENDING, CommissionStatus.APPROVED, CommissionStatus.PAID] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { amount: true, createdAt: true },
    });
    const commissionsByDay = this.buildCommissionsByDay(periodCommissions, startDate, endDate);

    // Total commissions (all time)
    const totalCommissionsAllTime = await this.prisma.commission.aggregate({
      where: {
        userId,
        status: { in: [CommissionStatus.PENDING, CommissionStatus.APPROVED, CommissionStatus.PAID] },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    // Pending balance = approved commissions - all non-failed payouts
    const [totalCommissionsAgg, paidPayoutsAgg] = await Promise.all([
      this.prisma.commission.aggregate({
        where: {
          userId,
          status: CommissionStatus.APPROVED,
        },
        _sum: { amount: true },
      }),
      this.prisma.sellerPayout.aggregate({
        where: {
          userId,
          status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING, PayoutStatus.COMPLETED] },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalEarned = totalCommissionsAgg._sum.amount?.toNumber() ?? 0;
    const totalPaidOut = paidPayoutsAgg._sum.amount?.toNumber() ?? 0;
    const pendingBalance = Math.max(0, totalEarned - totalPaidOut);

    // Recent payments (last 10 payouts)
    const recentPayments = await this.prisma.sellerPayout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        processedAt: true,
        createdAt: true,
      },
    });

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalRevenue,
      totalOrders,
      periodRevenue,
      periodData,
      revenueByDay,
      commissionsByDay,
      totalCommissions: totalCommissionsAllTime._sum.amount?.toNumber() ?? 0,
      totalCommissionsCount: totalCommissionsAllTime._count.id,
      pendingBalance,
      recentPayments: recentPayments.map((p) => ({
        ...p,
        amount: p.amount.toNumber(),
      })),
    };
  }

  /**
   * Build admin dashboard data.
   */
  async getAdminDashboard(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    activeSellers: number;
    pendingCommissions: number;
    revenueChart: { date: string; value: number }[];
    recentOrders: any[];
    topSellers: any[];
  }> {
    const paidStatuses = [
      OrderStatus.PAID,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    // Total revenue
    const totalRevenueAgg = await this.prisma.order.aggregate({
      where: { status: { in: paidStatuses } },
      _sum: { total: true },
    });
    const totalRevenue = totalRevenueAgg._sum.total?.toNumber() ?? 0;

    // Total orders
    const totalOrders = await this.prisma.order.count({
      where: { status: { in: paidStatuses } },
    });

    // Active sellers
    const activeSellers = await this.prisma.user.count({
      where: {
        role: { in: [UserRole.SELLER_L1, UserRole.SELLER_L2] },
        isActive: true,
      },
    });

    // Pending commissions total
    const pendingCommAgg = await this.prisma.commission.aggregate({
      where: { status: CommissionStatus.PENDING },
      _sum: { amount: true },
    });
    const pendingCommissions = pendingCommAgg._sum.amount?.toNumber() ?? 0;

    // Revenue chart: last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueOrders = await this.prisma.order.findMany({
      where: {
        status: { in: paidStatuses },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { total: true, createdAt: true },
    });

    const revenueChart = this.buildDailyChart(revenueOrders, 30);

    // Recent orders (last 10)
    const recentOrders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        seller: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    // Top sellers by revenue (last 30 days)
    const topSellersRaw = await this.prisma.order.groupBy({
      by: ['sellerId'],
      where: {
        status: { in: paidStatuses },
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });

    // Enrich with user data
    const sellerIds = topSellersRaw.map((s) => s.sellerId);
    const sellers = await this.prisma.user.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true, email: true },
    });

    const sellerMap = new Map(sellers.map((s) => [s.id, s]));

    const topSellers = topSellersRaw.map((s) => ({
      seller: sellerMap.get(s.sellerId) ?? {
        id: s.sellerId,
        name: 'Unknown',
        email: '',
      },
      totalRevenue: s._sum.total?.toNumber() ?? 0,
      orderCount: s._count.id,
    }));

    return {
      totalRevenue,
      totalOrders,
      activeSellers,
      pendingCommissions,
      revenueChart,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total.toNumber(),
        seller: o.seller,
        customer: o.customer,
        createdAt: o.createdAt.toISOString(),
      })),
      topSellers,
    };
  }

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build date range and labels for a given period.
   */
  private buildPeriodRange(
    period: 'week' | 'month',
    offset: number,
  ): { startDate: Date; endDate: Date; labels: string[] } {
    const now = new Date();
    const labels: string[] = [];

    if (period === 'week') {
      const startDate = new Date(now);
      startDate.setDate(
        startDate.getDate() - startDate.getDay() - offset * 7,
      );
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i < 7; i++) {
        labels.push(dayNames[i]);
      }

      return { startDate, endDate, labels };
    }

    // month
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1,
    );
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth() - offset + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const daysInMonth = endDate.getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      labels.push(String(i));
    }

    return { startDate, endDate, labels };
  }

  /**
   * Aggregate order data into period buckets.
   */
  private aggregateByPeriod(
    orders: { total: any; createdAt: Date }[],
    labels: string[],
    period: 'week' | 'month',
  ): { label: string; value: number }[] {
    const buckets = new Map<string, number>();
    for (const label of labels) {
      buckets.set(label, 0);
    }

    for (const order of orders) {
      const date = new Date(order.createdAt);
      let key: string;

      if (period === 'week') {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        key = dayNames[date.getDay()];
      } else {
        key = String(date.getDate());
      }

      const current = buckets.get(key) ?? 0;
      buckets.set(key, current + (order.total?.toNumber?.() ?? Number(order.total)));
    }

    return labels.map((label) => ({
      label,
      value: buckets.get(label) ?? 0,
    }));
  }

  /**
   * Build daily revenue chart for the last N days.
   */
  private buildDailyChart(
    orders: { total: any; createdAt: Date }[],
    days: number,
  ): { date: string; value: number }[] {
    const chart: { date: string; value: number }[] = [];
    const now = new Date();

    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      buckets.set(key, 0);
    }

    for (const order of orders) {
      const key = new Date(order.createdAt).toISOString().split('T')[0];
      const current = buckets.get(key) ?? 0;
      buckets.set(key, current + (order.total?.toNumber?.() ?? Number(order.total)));
    }

    for (const [date, value] of buckets) {
      chart.push({ date, value });
    }

    return chart;
  }

  /**
   * Build revenue-by-day array matching frontend DashboardStats shape.
   */
  private buildRevenueByDay(
    orders: { total: any; createdAt: Date }[],
    startDate: Date,
    endDate: Date,
  ): { date: string; revenue: number; orders: number }[] {
    const buckets = new Map<string, { revenue: number; orders: number }>();

    const current = new Date(startDate);
    while (current <= endDate) {
      const key = current.toISOString().split('T')[0];
      buckets.set(key, { revenue: 0, orders: 0 });
      current.setDate(current.getDate() + 1);
    }

    for (const order of orders) {
      const key = new Date(order.createdAt).toISOString().split('T')[0];
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue += order.total?.toNumber?.() ?? Number(order.total);
        bucket.orders += 1;
      }
    }

    return Array.from(buckets.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  /**
   * Build commissions-by-day array for the frontend chart.
   */
  private buildCommissionsByDay(
    commissions: { amount: any; createdAt: Date }[],
    startDate: Date,
    endDate: Date,
  ): { date: string; commission: number; count: number }[] {
    const buckets = new Map<string, { commission: number; count: number }>();

    const current = new Date(startDate);
    while (current <= endDate) {
      const key = current.toISOString().split('T')[0];
      buckets.set(key, { commission: 0, count: 0 });
      current.setDate(current.getDate() + 1);
    }

    for (const c of commissions) {
      const key = new Date(c.createdAt).toISOString().split('T')[0];
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.commission += c.amount?.toNumber?.() ?? Number(c.amount);
        bucket.count += 1;
      }
    }

    return Array.from(buckets.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }
}
