'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerSync, refreshStock, fetchSyncLogs } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/ui/data-table';
import { PageSpinner } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/utils';
import { RefreshCw, Download, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ProductSyncPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [syncResult, setSyncResult] = useState<any>(null);

  const { data: syncLogs, isLoading } = useQuery({
    queryKey: ['sync-logs', page],
    queryFn: () => fetchSyncLogs({ page, pageSize: 20 }),
  });

  const refetchLogs = () => {
    // Refetch after a delay to give the job time to complete
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }, 3000);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
    }, 8000);
  };

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: (data) => {
      setSyncResult(data);
      refetchLogs();
    },
  });

  const stockMutation = useMutation({
    mutationFn: refreshStock,
    onSuccess: () => {
      refetchLogs();
    },
  });

  const logColumns: Column<any>[] = [
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (item) => (
        <span className="text-sm">{formatDateTime(item.createdAt)}</span>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (item) => (
        <Badge variant={item.type === 'sync-products' ? 'info' : 'default'}>
          {item.type === 'sync-products' ? 'Completa' : 'Stock'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => {
        const variant = item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning';
        const Icon = item.status === 'completed' ? CheckCircle : item.status === 'failed' ? XCircle : Clock;
        return (
          <Badge variant={variant}>
            <Icon className="mr-1 h-3 w-3" />
            {item.status === 'completed' ? 'Exitoso' : item.status === 'failed' ? 'Fallido' : 'En proceso'}
          </Badge>
        );
      },
    },
    {
      key: 'created',
      header: 'Creados',
      render: (item) => <span className="text-sm font-medium text-status-success">{item.result?.created ?? 0}</span>,
    },
    {
      key: 'updated',
      header: 'Actualizados',
      render: (item) => <span className="text-sm font-medium text-accent-purple">{item.result?.updated ?? 0}</span>,
    },
    {
      key: 'deactivated',
      header: 'Desactivados',
      render: (item) => <span className="text-sm font-medium text-status-danger">{item.result?.deactivated ?? 0}</span>,
    },
    {
      key: 'duration',
      header: 'Duracion',
      render: (item) => <span className="text-sm text-white/50">{item.duration ? `${item.duration}s` : '-'}</span>,
    },
  ];

  const lastSync = syncLogs?.data?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Sincronizacion de Productos</h1>
        <p className="page-description">Sincroniza el catalogo de productos con Odoo</p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Sincronizacion Completa</h3>
              <p className="mt-1 text-sm text-white/50">
                Sincroniza todos los productos: crea nuevos, actualiza existentes y desactiva eliminados.
              </p>
              {lastSync && (
                <p className="mt-2 text-xs text-white/30">
                  Ultima sincronizacion: {formatDateTime(lastSync.createdAt)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Button
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => syncMutation.mutate()}
              loading={syncMutation.isPending}
            >
              Iniciar Sincronizacion
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Actualizar Stock</h3>
              <p className="mt-1 text-sm text-white/50">
                Actualiza unicamente las cantidades de stock desde Odoo sin modificar otros datos.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              icon={<Download className="h-4 w-4" />}
              onClick={() => stockMutation.mutate()}
              loading={stockMutation.isPending}
            >
              Actualizar Stock
            </Button>
          </div>
        </Card>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <Card className="border-status-success/30 bg-status-success-muted">
          <h3 className="font-semibold text-status-success">Resultado de Sincronizacion</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-status-success">{syncResult.created ?? syncResult.productsCreated ?? 0}</p>
              <p className="text-xs text-status-success/80">Creados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent-purple">{syncResult.updated ?? syncResult.productsUpdated ?? 0}</p>
              <p className="text-xs text-accent-purple/80">Actualizados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-status-danger">{syncResult.deactivated ?? syncResult.productsDeactivated ?? 0}</p>
              <p className="text-xs text-status-danger/80">Desactivados</p>
            </div>
          </div>
        </Card>
      )}

      {stockMutation.isSuccess && (
        <div className="rounded-lg bg-status-success-muted p-3 text-sm text-status-success">
          Stock actualizado correctamente.
        </div>
      )}

      {(syncMutation.error || stockMutation.error) && (
        <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
          Error durante la operacion. Intente nuevamente.
        </div>
      )}

      {/* Sync Logs */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Historial de Sincronizaciones</h3>
        </div>
        <div className="p-4">
          <DataTable
            columns={logColumns}
            data={syncLogs?.data || []}
            loading={isLoading}
            page={page}
            pageSize={20}
            total={syncLogs?.meta?.total || 0}
            onPageChange={setPage}
            keyExtractor={(item) => item.id}
            emptyMessage="No hay sincronizaciones registradas"
          />
        </div>
      </Card>
    </div>
  );
}
