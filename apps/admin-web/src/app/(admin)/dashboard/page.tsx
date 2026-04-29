'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Coins,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange' | 'brown'> = {
  DRAFT: 'default',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'orange',
  IN_TRANSIT: 'warning',
  DELIVERED: 'brown',
  CANCELLED: 'danger',
  RETURNED: 'danger',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_PAYMENT: 'Pago Pendiente',
  PAID: 'Pagado',
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Procesando',
  SHIPPED: 'Enviado',
  IN_TRANSIT: 'En Camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devuelto',
};

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardStats,
  });

  if (isLoading) return <PageSpinner />;

  if (error) {
    return (
      <div className="rounded-xl border border-status-danger/30 bg-status-danger-muted p-6 text-center">
        <p className="text-sm text-status-danger">Error al cargar el dashboard. Intente nuevamente.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title font-display text-glow-gold">Dashboard</h1>
        <p className="page-description">Resumen general de D Perfume House</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos Totales"
          value={formatCurrency(data.totalRevenue ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Total Pedidos"
          value={String(data.totalOrders ?? 0)}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatCard
          label="Vendedores Activos"
          value={String(data.activeSellers ?? 0)}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Comisiones Pendientes"
          value={formatCurrency(data.pendingCommissions ?? 0)}
          icon={<Coins className="h-5 w-5" />}
        />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos (ultimos 30 dias)</CardTitle>
        </CardHeader>
        {data.revenueChart && data.revenueChart.length > 0 ? (
          <div className="h-48 sm:h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
                  labelFormatter={(label) => formatDate(label)}
                  contentStyle={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#D4AF37"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#D4AF37' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-white/50">No hay datos de ingresos disponibles.</p>
        )}
      </Card>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card padding={false}>
          <div className="border-b border-glass-border px-6 py-4">
            <h3 className="text-lg font-semibold text-white">Pedidos Recientes</h3>
          </div>
          {data.recentOrders && data.recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border bg-glass-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-white/50">Pedido</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-white/50">Cliente</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-white/50">Estado</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-white/50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {data.recentOrders.slice(0, 10).map((order: any) => (
                    <tr key={order.id} className="hover:bg-glass-50 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-white">
                        #{order.orderNumber || order.id?.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-white/70">
                        {order.customerName || order.customer?.name || '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={statusVariant[order.status] || 'default'}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-white">
                        {formatCurrency(order.total || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-white/50">No hay pedidos recientes.</p>
          )}
        </Card>

        {/* Top Sellers */}
        <Card padding={false}>
          <div className="border-b border-glass-border px-6 py-4">
            <h3 className="text-lg font-semibold text-white">Top Vendedores</h3>
          </div>
          {data.topSellers && data.topSellers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border bg-glass-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-white/50">Vendedor</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-white/50">Pedidos</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-white/50">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {data.topSellers.map((seller: any, idx: number) => (
                    <tr key={seller.id || idx} className="hover:bg-glass-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple-muted text-xs font-bold text-accent-purple">
                            {(seller.seller?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-white">{seller.seller?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-white/70">
                        {seller.orderCount ?? seller.orders ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-white">
                        {formatCurrency(seller.revenue ?? seller.totalRevenue ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-white/50">No hay datos de vendedores.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
