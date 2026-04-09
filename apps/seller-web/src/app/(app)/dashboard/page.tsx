'use client';

import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, addWeeks, subWeeks, addMonths, subMonths, differenceInWeeks, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp, Wallet, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Badge, PaymentStatusBadge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/auth.store';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatCurrency, formatDate } from '@/lib/utils';

type Period = 'week' | 'month';
type ChartMode = 'ventas' | 'comisiones';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>('week');
  const [chartMode, setChartMode] = useState<ChartMode>('ventas');
  const [referenceDate, setReferenceDate] = useState(new Date());

  const offset = useMemo(() => {
    const now = new Date();
    if (period === 'week') {
      return differenceInWeeks(startOfWeek(now, { weekStartsOn: 1 }), startOfWeek(referenceDate, { weekStartsOn: 1 }));
    }
    return differenceInMonths(startOfMonth(now), startOfMonth(referenceDate));
  }, [period, referenceDate]);

  const periodLabel = useMemo(() => {
    if (period === 'week') {
      const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
      return `Semana del ${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM', { locale: es })}`;
    }
    return format(referenceDate, 'MMMM yyyy', { locale: es });
  }, [period, referenceDate]);

  const { data: stats, isLoading } = useDashboard({ period, offset });

  const navigatePeriod = (direction: 'prev' | 'next') => {
    setReferenceDate((prev) => {
      if (period === 'week') {
        return direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1);
      }
      return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
    });
  };

  const chartData = useMemo(() => {
    if (chartMode === 'comisiones') {
      if (!stats?.commissionsByDay) return [];
      return stats.commissionsByDay.map((d) => {
        const parsed = new Date(d.date);
        const isValid = !isNaN(parsed.getTime());
        return {
          name: isValid ? format(parsed, period === 'week' ? 'EEE' : 'd', { locale: es }) : '—',
          value: d.commission,
          count: d.count,
        };
      });
    }
    if (!stats?.revenueByDay) return [];
    return stats.revenueByDay.map((d) => {
      const parsed = new Date(d.date);
      const isValid = !isNaN(parsed.getTime());
      return {
        name: isValid ? format(parsed, period === 'week' ? 'EEE' : 'd', { locale: es }) : '—',
        value: d.revenue,
        count: d.orders,
      };
    });
  }, [stats, period, chartMode]);

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white font-display text-glow-gold">
          Hola, {user?.name?.split(' ')[0] || 'Vendedor'}
        </h1>
        <p className="text-sm text-white/50">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Revenue card */}
      <Card>
        <CardHeader
          action={
            <div className="flex rounded-lg bg-glass-50 p-0.5">
              <button
                onClick={() => { setPeriod('week'); setReferenceDate(new Date()); }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === 'week'
                    ? 'bg-accent-purple text-white shadow-glow-purple'
                    : 'text-white/50'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => { setPeriod('month'); setReferenceDate(new Date()); }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === 'month'
                    ? 'bg-accent-purple text-white shadow-glow-purple'
                    : 'text-white/50'
                }`}
              >
                Mes
              </button>
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent-purple" />
            <div className="flex rounded-lg bg-glass-50 p-0.5">
              <button
                onClick={() => setChartMode('ventas')}
                className={`rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                  chartMode === 'ventas'
                    ? 'bg-accent-gold text-black'
                    : 'text-white/50'
                }`}
              >
                Ventas
              </button>
              <button
                onClick={() => setChartMode('comisiones')}
                className={`rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                  chartMode === 'comisiones'
                    ? 'bg-accent-gold text-black'
                    : 'text-white/50'
                }`}
              >
                Comisiones
              </button>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          {/* Period navigator */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => navigatePeriod('prev')}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-glass-200"
            >
              <ChevronLeft className="h-4 w-4 text-white/50" />
            </button>
            <span className="text-sm font-medium text-white/70 capitalize">
              {periodLabel}
            </span>
            <button
              onClick={() => navigatePeriod('next')}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-glass-200"
            >
              <ChevronRight className="h-4 w-4 text-white/50" />
            </button>
          </div>

          {/* Revenue amount */}
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <PageSpinner />
            </div>
          ) : (
            <>
              <div className="mb-4 text-center">
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(chartMode === 'comisiones'
                    ? (stats?.commissionsByDay?.reduce((s, d) => s + d.commission, 0) ?? 0)
                    : (stats?.periodRevenue ?? 0))}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {chartMode === 'comisiones'
                    ? `${stats?.commissionsByDay?.reduce((s, d) => s + d.count, 0) ?? 0} comisiones`
                    : `${stats?.revenueByDay?.reduce((s, d) => s + d.orders, 0) ?? 0} pedidos`}
                </p>
              </div>

              {/* Bar chart */}
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#ffffff50' }}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(167, 139, 250, 0.08)' }}
                      contentStyle={{
                        borderRadius: '0.75rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                      formatter={(value: number) => [formatCurrency(value), chartMode === 'comisiones' ? 'Comisiones' : 'Ventas']}
                    />
                    <Bar
                      dataKey="value"
                      fill={chartMode === 'comisiones' ? '#a78bfa' : '#D4AF37'}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Pending balance card */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-gold-muted">
              <Wallet className="h-5 w-5 text-accent-gold" />
            </div>
            <div>
              <p className="text-xs text-white/50">Saldo Pendiente</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(stats?.pendingBalance ?? 0)}
              </p>
            </div>
          </div>
          <Badge variant="warning">Pendiente</Badge>
        </div>
      </Card>

      {/* Payment history */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
          <Clock className="h-4 w-4 text-white/30" />
          Historial de Pagos
        </h2>
        {isLoading ? (
          <PageSpinner />
        ) : !stats?.recentPayments?.length ? (
          <Card>
            <p className="py-4 text-center text-sm text-white/30">
              No hay pagos recientes
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.recentPayments.map((payment) => (
              <Card key={payment.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {(payment as any).method === 'BANK_TRANSFER' ? 'Transferencia Bancaria'
                        : (payment as any).method === 'USDT_TRC20' ? 'USDT TRC20'
                        : (payment as any).method === 'CASH' ? 'Efectivo'
                        : (payment as any).method || 'Pago'}
                    </p>
                    <p className="text-xs text-white/30">
                      {formatDate((payment as any).processedAt || (payment as any).createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency(payment.amount)}
                    </span>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
