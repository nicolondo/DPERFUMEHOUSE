'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  ShoppingBag,
  TrendingUp,
  Package,
  DollarSign,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge, OrderStatusBadge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import api, { unwrap } from '@/lib/api';
import { formatCurrency, formatDate, formatPhone, getInitials } from '@/lib/utils';

type FilterTab = 'all' | string;

const tabs: { label: string; value: FilterTab }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Pago Pendiente', value: 'PENDING_PAYMENT' },
  { label: 'Pagados', value: 'PAID' },
  { label: 'Enviados', value: 'SHIPPED' },
  { label: 'Entregados', value: 'DELIVERED' },
];

export default function SellerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params.id as string;
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');

  const { data: seller, isLoading: sellerLoading } = useQuery({
    queryKey: ['downline-seller', sellerId],
    queryFn: async () => {
      const { data } = await api.get(`/users/me/downline/${sellerId}`);
      return data;
    },
    enabled: !!sellerId,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['seller-orders', sellerId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('sellerId', sellerId);
      params.set('pageSize', '50');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const { data } = await api.get(`/orders?${params}`);
      return unwrap(data);
    },
    enabled: !!sellerId,
  });

  const orders = ordersData?.data ?? [];

  if (sellerLoading) return <PageSpinner />;

  if (!seller) {
    return (
      <div>
        <PageHeader title="Vendedor" backHref="/sellers" />
        <div className="px-4">
          <Card className="p-6 text-center">
            <p className="text-sm text-white/50">Vendedor no encontrado</p>
          </Card>
        </div>
      </div>
    );
  }

  const totalOrders = seller._count?.orders || 0;
  const totalRevenue = seller.stats?.totalRevenue || 0;
  const statusMap = seller.stats?.ordersByStatus || {};

  return (
    <div>
      <PageHeader title={seller.name} backHref="/sellers" />

      <div className="px-4 space-y-4">
        {/* Seller Profile Card */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-accent-purple-muted text-lg font-bold text-accent-purple">
              {getInitials(seller.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate">{seller.name}</h2>
                <Badge variant={seller.isActive ? 'success' : 'danger'}>
                  {seller.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="mt-1 flex flex-col gap-0.5 text-xs text-white/40">
                {seller.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {seller.email}
                  </span>
                )}
                {seller.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {formatPhone(seller.phone)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 text-center">
            <ShoppingBag className="mx-auto h-5 w-5 text-accent-purple mb-1" />
            <p className="text-lg font-bold text-white">{totalOrders}</p>
            <p className="text-xs text-white/40">Pedidos</p>
          </Card>
          <Card className="p-3 text-center">
            <DollarSign className="mx-auto h-5 w-5 text-accent-gold mb-1" />
            <p className="text-lg font-bold text-white">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-white/40">Ventas</p>
          </Card>
        </div>

        {/* Mini status breakdown */}
        {Object.keys(statusMap).length > 0 && (
          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusMap).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <OrderStatusBadge status={status} />
                  <span className="text-xs font-medium text-white/60">{count as number}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Orders Section */}
        <div>
          <h3 className="text-sm font-semibold text-white/70 mb-3">Pedidos</h3>

          {/* Filter Tabs */}
          <div className="mb-3 -mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-1">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-accent-purple text-white shadow-glow-purple'
                      : 'bg-glass-50 text-white/50 hover:bg-glass-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          {ordersLoading ? (
            <PageSpinner />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-7 w-7" />}
              title="Sin pedidos"
              description={
                statusFilter !== 'all'
                  ? 'No hay pedidos con este estado'
                  : 'Este vendedor aun no tiene pedidos'
              }
            />
          ) : (
            <div className="space-y-3">
              {orders.map((order: any) => (
                <Card
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-accent-purple">
                      #{order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {order.customer?.name || 'Cliente'}
                      </p>
                      <p className="text-xs text-white/30">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="pl-3 text-right">
                      <p className="text-base font-bold text-white">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="text-xs text-white/30">
                        {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
