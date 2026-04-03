'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStockRequests, updateStockRequestStatus } from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { Bell, CheckCircle, XCircle } from 'lucide-react';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  NOTIFIED: 'info',
  FULFILLED: 'success',
  CANCELLED: 'danger',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  NOTIFIED: 'Notificado',
  FULFILLED: 'Cumplido',
  CANCELLED: 'Cancelado',
};

export default function StockRequestsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-requests', page, statusFilter],
    queryFn: () =>
      fetchStockRequests({
        page,
        pageSize: 20,
        status: statusFilter || undefined,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateStockRequestStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-requests'] }),
  });

  const columns: Column<any>[] = [
    {
      key: 'productName',
      header: 'Producto',
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.variant?.name || item.productName || '-'}</p>
        </div>
      ),
    },
    {
      key: 'sellerName',
      header: 'Vendedor',
      render: (item) => (
        <span className="text-sm">{item.sellerName || item.seller?.name || '-'}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (item) => (
        <span className="text-sm font-medium">{item.quantity ?? 0}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => (
        <Badge variant={statusVariant[item.status] || 'default'}>
          {statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (item) => (
        <span className="text-sm text-white/50">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Solicitudes de Stock</h1>
        <p className="page-description">Solicitudes de productos sin stock realizadas por vendedores</p>
      </div>

      <div className="filter-bar">
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="NOTIFIED">Notificado</option>
          <option value="FULFILLED">Cumplido</option>
          <option value="CANCELLED">Cancelado</option>
        </Select>
      </div>

      {updateMutation.error && (
        <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
          Error al actualizar la solicitud.
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={data?.meta?.total || 0}
        onPageChange={setPage}
        keyExtractor={(item) => item.id}
        emptyMessage="No hay solicitudes de stock"
        rowActions={(item) => {
          if (item.status === 'FULFILLED' || item.status === 'CANCELLED') return null;
          return (
            <div className="flex items-center gap-1">
              {item.status === 'PENDING' && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Bell className="h-3.5 w-3.5" />}
                  onClick={() => updateMutation.mutate({ id: item.id, status: 'NOTIFIED' })}
                  loading={updateMutation.isPending}
                >
                  Notificar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={<CheckCircle className="h-3.5 w-3.5 text-success-600" />}
                onClick={() => updateMutation.mutate({ id: item.id, status: 'FULFILLED' })}
                loading={updateMutation.isPending}
              >
                Cumplir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<XCircle className="h-3.5 w-3.5 text-danger-600" />}
                onClick={() => updateMutation.mutate({ id: item.id, status: 'CANCELLED' })}
                loading={updateMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          );
        }}
      />
    </div>
  );
}
