'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPayouts,
  createPayout,
  processPayout,
  completePayout,
  syncPayoutOdoo,
  fetchSellers,
  fetchCommissionSummary,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Play, CheckCircle, RefreshCw } from 'lucide-react';

const payoutStatusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  PROCESSING: { label: 'Procesando', variant: 'info' },
  COMPLETED: { label: 'Completado', variant: 'success' },
  FAILED: { label: 'Fallido', variant: 'danger' },
};

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Transferencia Bancaria',
  CASH: 'Efectivo',
  USDT_TRC20: 'USDT TRC20',
};

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [processTarget, setProcessTarget] = useState<any>(null);
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [completeRef, setCompleteRef] = useState('');

  // Create form state
  const [formSellerId, setFormSellerId] = useState('');
  const [formAmount, setFormAmount] = useState(''); // raw numeric string
  const [formAmountDisplay, setFormAmountDisplay] = useState(''); // formatted display
  const [formMethod, setFormMethod] = useState('BANK_TRANSFER');

  const { data, isLoading } = useQuery({
    queryKey: ['payouts', page, statusFilter],
    queryFn: () => fetchPayouts({ page, status: statusFilter || undefined }),
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers'],
    queryFn: fetchSellers,
  });

  const { data: sellerSummary } = useQuery({
    queryKey: ['commission-summary', formSellerId],
    queryFn: () => fetchCommissionSummary(formSellerId),
    enabled: !!formSellerId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { userId: string; amount: number; method: string }) => createPayout(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      // Error is displayed inline in the modal
      console.error('Payout creation error:', error?.response?.data);
    },
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => processPayout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      setProcessTarget(null);
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference?: string }) => completePayout(id, reference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      setCompleteTarget(null);
      setCompleteRef('');
    },
  });

  const syncOdooMutation = useMutation({
    mutationFn: (id: string) => syncPayoutOdoo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
  });

  function resetForm() {
    setFormSellerId('');
    setFormAmount('');
    setFormAmountDisplay('');
    setFormMethod('BANK_TRANSFER');
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only allow digits (COP has no decimals)
    const digits = e.target.value.replace(/\D/g, '');
    setFormAmount(digits);
    // Format with thousand separators using dots (es-CO style)
    if (digits === '') {
      setFormAmountDisplay('');
    } else {
      const formatted = Number(digits).toLocaleString('es-CO');
      setFormAmountDisplay(formatted);
    }
  }

  function setAmountFromValue(val: number) {
    setFormAmount(String(val));
    setFormAmountDisplay(val.toLocaleString('es-CO'));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formSellerId || !formAmount) return;
    createMutation.mutate({
      userId: formSellerId,
      amount: parseInt(formAmount, 10),
      method: formMethod,
    });
  }

  const columns: Column<any>[] = [
    {
      key: 'sellerName',
      header: 'Vendedor',
      render: (payout) => (
        <div>
          {((payout as any).user?.id || payout.userId) ? (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/users/${(payout as any).user?.id || payout.userId}`); }}
              className="font-medium text-accent-purple hover:underline"
            >
              {payout.sellerName || payout.userName || (payout as any).user?.name}
            </button>
          ) : (
            <p className="font-medium text-white">{payout.sellerName || payout.userName || (payout as any).user?.name}</p>
          )}
          <p className="text-xs text-white/50">{payout.sellerEmail || payout.userEmail || (payout as any).user?.email || ''}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Monto',
      sortable: true,
      render: (payout) => (
        <span className="font-medium text-white">{formatCurrency(payout.amount)}</span>
      ),
    },
    {
      key: 'method',
      header: 'Metodo',
      render: (payout) => (
        <span className="text-sm text-white/70">{methodLabels[payout.method] || payout.method}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (payout) => {
        const s = payoutStatusMap[payout.status] || { label: payout.status, variant: 'default' as const };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: 'reference',
      header: 'Referencia',
      render: (payout) => (
        <span className="text-sm font-mono text-white/50">{payout.reference || '-'}</span>
      ),
    },
    {
      key: 'odooMoveId',
      header: 'Asiento Odoo',
      render: (payout) => (
        (payout as any).odooMoveName
          ? <span className="text-sm font-mono text-emerald-400">{(payout as any).odooMoveName}</span>
          : (payout as any).odooMoveId
            ? <span className="text-sm font-mono text-emerald-400">#{(payout as any).odooMoveId}</span>
            : <span className="text-sm text-white/30">-</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (payout) => (
        <span className="text-white/50">{formatDate(payout.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pagos a Vendedores</h1>
          <p className="page-description">Gestion de pagos y desembolsos</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateModalOpen(true)}>
          Crear Pago
        </Button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-44"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PROCESSING">Procesando</option>
          <option value="COMPLETED">Completado</option>
          <option value="FAILED">Fallido</option>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={data?.meta?.total || 0}
        onPageChange={setPage}
        keyExtractor={(p) => p.id}
        emptyMessage="No hay pagos registrados"
        rowActions={(payout) => (
          <div className="flex items-center gap-1">
            {payout.status === 'PENDING' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProcessTarget(payout)}
                title="Procesar"
              >
                <Play className="h-4 w-4 text-accent-purple" />
              </Button>
            )}
            {payout.status === 'PROCESSING' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCompleteTarget(payout); setCompleteRef(''); }}
                title="Completar"
              >
                <CheckCircle className="h-4 w-4 text-status-success" />
              </Button>
            )}
            {payout.status === 'COMPLETED' && !(payout as any).odooMoveId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncOdooMutation.mutate(payout.id)}
                loading={syncOdooMutation.isPending && syncOdooMutation.variables === payout.id}
                title="Reintentar sync Odoo"
              >
                <RefreshCw className="h-4 w-4 text-amber-400" />
              </Button>
            )}
          </div>
        )}
      />

      {/* Create Payout Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => { setCreateModalOpen(false); resetForm(); }}
        title="Crear Pago"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Vendedor" required>
            <Select
              value={formSellerId}
              onChange={(e) => { setFormSellerId(e.target.value); setFormAmount(''); setFormAmountDisplay(''); }}
            >
              <option value="">Seleccionar vendedor...</option>
              {(sellers || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </Select>
          </FormField>

          {formSellerId && sellerSummary && (
            <div className="rounded-xl border border-glass-border bg-glass-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Comisiones Aprobadas</span>
                <span className="text-sm font-semibold text-status-success">
                  {formatCurrency(sellerSummary.approved ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Comisiones Pendientes</span>
                <span className="text-sm font-medium text-status-warning">
                  {formatCurrency(sellerSummary.pending ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Ya Pagado</span>
                <span className="text-sm font-medium text-white/70">
                  {formatCurrency(sellerSummary.totalPaidOut ?? sellerSummary.paid ?? 0)}
                </span>
              </div>
              <div className="border-t border-glass-border pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Disponible para Pago</span>
                <button
                  type="button"
                  onClick={() => setAmountFromValue(sellerSummary.availableForPayout ?? sellerSummary.approved ?? 0)}
                  className="text-sm font-bold text-accent-purple hover:underline cursor-pointer"
                >
                  {formatCurrency(sellerSummary.availableForPayout ?? sellerSummary.approved ?? 0)}
                </button>
              </div>
            </div>
          )}

          <FormField label="Monto" required>
            <Input
              type="text"
              inputMode="decimal"
              value={formAmountDisplay}
              onChange={handleAmountChange}
              placeholder="0"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </FormField>

          <FormField label="Metodo de Pago" required>
            <Select
              value={formMethod}
              onChange={(e) => setFormMethod(e.target.value)}
            >
              <option value="BANK_TRANSFER">Transferencia Bancaria</option>
              <option value="CASH">Efectivo</option>
              <option value="USDT_TRC20">USDT TRC20</option>
            </Select>
          </FormField>

          {createMutation.isError && (
            <p className="text-sm text-status-danger">
              {(createMutation.error as any)?.response?.data?.message ||
               (createMutation.error as any)?.response?.data?.error ||
               (createMutation.error as any)?.message ||
               'Error al crear el pago'}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setCreateModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={!formSellerId || !formAmount}
            >
              Crear
            </Button>
          </div>
        </form>
      </Modal>

      {/* Process Confirm */}
      <ConfirmDialog
        open={!!processTarget}
        onClose={() => setProcessTarget(null)}
        onConfirm={() => processTarget && processMutation.mutate(processTarget.id)}
        title="Procesar Pago"
        message={`Procesar el pago de ${formatCurrency(processTarget?.amount || 0)} para ${processTarget?.sellerName || processTarget?.userName || (processTarget as any)?.user?.name}?`}
        confirmText="Procesar"
        variant="primary"
        loading={processMutation.isPending}
      />

      {/* Complete Payout Modal */}
      <Modal
        open={!!completeTarget}
        onClose={() => { setCompleteTarget(null); setCompleteRef(''); }}
        title="Completar Pago"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Completar el pago de <span className="font-semibold">{formatCurrency(completeTarget?.amount || 0)}</span> para{' '}
            <span className="font-semibold">{completeTarget?.sellerName || completeTarget?.userName || (completeTarget as any)?.user?.name}</span>.
          </p>
          <FormField label="Referencia de Transaccion" hint="Numero de transferencia o hash de transaccion">
            <Input
              value={completeRef}
              onChange={(e) => setCompleteRef(e.target.value)}
              placeholder="Ej: TXN-123456"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setCompleteTarget(null); setCompleteRef(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => completeTarget && completeMutation.mutate({ id: completeTarget.id, reference: completeRef || undefined })}
              loading={completeMutation.isPending}
            >
              Completar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
