'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { fetchOrders, fetchUsers } from '@/lib/api';
import api from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Trash2 } from 'lucide-react';

const orderStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange' | 'brown'> = {
  DRAFT: 'default',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'orange',
  DELIVERED: 'brown',
  CANCELLED: 'danger',
  RETURNED: 'danger',
};

const paymentStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'danger',
  PARTIAL: 'warning',
};

const orderStatusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_PAYMENT: 'Pago Pendiente',
  PAID: 'Pagado',
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Procesando',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devuelto',
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  COMPLETED: 'Completado',
  PAID: 'Pagado',
  FAILED: 'Fallido',
  REFUNDED: 'Reembolsado',
  PARTIAL: 'Parcial',
};

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.delete(`/orders/${orderId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const [status, setStatus] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, status, sellerId, dateFrom, dateTo],
    queryFn: () =>
      fetchOrders({
        page,
        pageSize: 20,
        status: status || undefined,
        sellerId: sellerId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers-dropdown'],
    queryFn: () => fetchUsers({ role: 'SELLER_L1', pageSize: 200 }),
  });

  const columns: Column<any>[] = [
    {
      key: 'orderNumber',
      header: 'N. Pedido',
      render: (item) => (
        <span className="font-medium text-white">#{item.orderNumber || item.id?.slice(0, 8)}</span>
      ),
    },
    {
      key: 'customerName',
      header: 'Cliente',
      render: (item) => (
        <div>
          {(item.customer?.id || item.customerId) ? (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/customers/${item.customer?.id || item.customerId}`); }}
              className="text-sm font-medium text-accent-purple hover:underline text-left"
            >
              {item.customerName || item.customer?.name || '-'}
            </button>
          ) : (
            <p className="text-sm">{item.customerName || item.customer?.name || '-'}</p>
          )}
          <p className="text-xs text-white/50">{item.customerEmail || item.customer?.email || ''}</p>
        </div>
      ),
    },
    {
      key: 'sellerName',
      header: 'Vendedor',
      render: (item) => (
        (item.seller?.id || item.sellerId) ? (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/users/${item.seller?.id || item.sellerId}`); }}
            className="text-sm text-accent-purple hover:underline"
          >
            {item.sellerName || item.seller?.name || '-'}
          </button>
        ) : (
          <span className="text-sm text-white/70">{item.sellerName || item.seller?.name || '-'}</span>
        )
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => (
        <Badge variant={orderStatusVariant[item.status] || 'default'}>
          {orderStatusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Pago',
      render: (item) => (
        <Badge variant={paymentStatusVariant[item.paymentStatus] || 'default'}>
          {paymentStatusLabels[item.paymentStatus] || item.paymentStatus || '-'}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (item) => <span className="font-medium">{formatCurrency(item.total || 0)}</span>,
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (item) => <span className="text-sm text-white/50">{formatDate(item.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (item) =>
        (item.status === 'PENDING' || item.status === 'PENDING_PAYMENT') ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`¿Eliminar pedido #${item.orderNumber || item.id?.slice(0, 8)}? Esta acción no se puede deshacer.`)) {
                deleteOrderMutation.mutate(item.id);
              }
            }}
            disabled={deleteOrderMutation.isPending}
            className="p-1.5 rounded-lg text-status-danger/60 hover:text-status-danger hover:bg-status-danger/10 transition-colors disabled:opacity-40"
            title="Eliminar pedido"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Pedidos</h1>
        <p className="page-description">Todos los pedidos del sistema</p>
      </div>

      <div className="filter-bar">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="w-44"
        >
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="PENDING_PAYMENT">Pago Pendiente</option>
          <option value="PAID">Pagado</option>
          <option value="SHIPPED">Enviado</option>
          <option value="DELIVERED">Entregado</option>
          <option value="CANCELLED">Cancelado</option>
        </Select>
        <Select
          value={sellerId}
          onChange={(e) => {
            setSellerId(e.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">Todos los vendedores</option>
          {(sellers?.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
          <span className="text-sm text-white/30">a</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={data?.meta?.total || 0}
        onPageChange={setPage}
        onRowClick={(item) => router.push(`/orders/${item.id}`)}
        keyExtractor={(item) => item.id}
        emptyMessage="No se encontraron pedidos"
      />
    </div>
  );
}
