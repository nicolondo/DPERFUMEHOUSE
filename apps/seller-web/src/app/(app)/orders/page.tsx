'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShoppingBag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { OrderStatusBadge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useOrders } from '@/hooks/use-orders';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

type FilterTab = 'all' | OrderStatus;

const tabs: { label: string; value: FilterTab }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Borrador', value: 'DRAFT' },
  { label: 'Pago Pendiente', value: 'PENDING_PAYMENT' },
  { label: 'Pagados', value: 'PAID' },
  { label: 'Enviados', value: 'SHIPPED' },
  { label: 'En Camino', value: 'IN_TRANSIT' },
  { label: 'Entregados', value: 'DELIVERED' },
  { label: 'Cancelados', value: 'CANCELLED' },
];

export default function OrdersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const { data, isLoading, refetch } = useOrders({
    status: statusFilter,
  });

  const orders = data?.data ?? [];

  return (
    <div className="pb-24">
      <PageHeader title="Pedidos" />

      <div className="px-4">
        {/* Status Filter Tabs */}
        <div className="mb-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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

        {/* Order List */}
        {isLoading ? (
          <PageSpinner />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-8 w-8" />}
            title="Sin pedidos"
            description={
              statusFilter !== 'all'
                ? 'No hay pedidos con este estado'
                : 'Crea tu primer pedido para empezar'
            }
            action={
              statusFilter === 'all'
                ? {
                    label: 'Crear Pedido',
                    onClick: () => router.push('/orders/new'),
                  }
                : undefined
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
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/orders/new')}
        className="fab !w-auto !rounded-full px-5 gap-2"
        aria-label="Crear pedido"
      >
        <Plus className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase">Crear Nuevo</span>
      </button>
    </div>
  );
}
