'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCommissions,
  fetchCommissionSummary,
  approveCommission,
  bulkApproveCommissions,
  reverseCommission,
  fetchSellers,
  fetchMonthlyBonuses,
  runMonthlyBonusProcess,
  retryMonthlyBonus,
} from '@/lib/api';
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  CheckCircle,
  Clock,
  DollarSign,
  Check,
  Undo2,
  Layers,
  Play,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

const commissionStatusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  APPROVED: { label: 'Aprobada', variant: 'success' },
  PAID: { label: 'Pagada', variant: 'info' },
  REVERSED: { label: 'Revertida', variant: 'danger' },
};

const bonusStatusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  POSTED: { label: 'Registrado', variant: 'success' },
  FAILED: { label: 'Fallido', variant: 'danger' },
  SKIPPED_NO_DELTA: { label: 'Sin delta', variant: 'default' },
  SKIPPED_DISABLED: { label: 'Deshabilitado', variant: 'info' },
};

const MONTHS = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

function MonthlyBonusTab({ sellers }: { sellers: any[] }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const now = new Date();

  const [yearFilter, setYearFilter] = useState<string>(String(now.getFullYear()));
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [runYear, setRunYear] = useState<string>(String(now.getFullYear()));
  const [runMonth, setRunMonth] = useState<string>(String(now.getMonth() === 0 ? 12 : now.getMonth()));
  const [runResult, setRunResult] = useState<any>(null);
  const [retryTarget, setRetryTarget] = useState<any>(null);

  const { data: bonuses, isLoading } = useQuery({
    queryKey: ['monthly-bonuses', yearFilter, monthFilter, sellerFilter],
    queryFn: () => fetchMonthlyBonuses({
      year: yearFilter ? Number(yearFilter) : undefined,
      month: monthFilter ? Number(monthFilter) : undefined,
      sellerId: sellerFilter || undefined,
    }),
  });

  const runMutation = useMutation({
    mutationFn: () => runMonthlyBonusProcess(Number(runYear), Number(runMonth)),
    onSuccess: (result) => {
      setRunResult(result);
      queryClient.invalidateQueries({ queryKey: ['monthly-bonuses'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retryMonthlyBonus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-bonuses'] });
      setRetryTarget(null);
    },
  });

  const filtered = (bonuses || []).filter((b: any) =>
    !statusFilter || b.status === statusFilter
  );

  const totalPosted = filtered.filter((b: any) => b.status === 'POSTED')
    .reduce((s: number, b: any) => s + Number(b.bonusAmount), 0);
  const countFailed = filtered.filter((b: any) => b.status === 'FAILED').length;
  const countSkipped = filtered.filter((b: any) => b.status.startsWith('SKIPPED')).length;

  const columns: Column<any>[] = [
    {
      key: 'seller',
      header: 'Vendedor',
      render: (b) => (
        <button
          onClick={() => router.push(`/users/${b.seller?.id}`)}
          className="text-sm text-accent-purple hover:underline"
        >
          {b.seller?.name || b.sellerId?.slice(0, 8)}
        </button>
      ),
    },
    {
      key: 'period',
      header: 'Periodo',
      render: (b) => (
        <span className="text-sm font-medium">
          {MONTHS.find(m => m.value === b.month)?.label} {b.year}
        </span>
      ),
    },
    {
      key: 'salesBase',
      header: 'Ventas',
      render: (b) => <span className="text-sm text-white/70">{formatCurrency(Number(b.salesBase))}</span>,
    },
    {
      key: 'rates',
      header: 'Base / Escala',
      render: (b) => (
        <span className="text-xs text-white/60">
          {(Number(b.baseRate) * 100).toFixed(1)}% → {(Number(b.tierRate) * 100).toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'deltaRate',
      header: 'Delta',
      render: (b) => (
        <span className="text-sm font-medium text-accent-purple">
          +{(Number(b.deltaRate) * 100).toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'bonusAmount',
      header: 'Bono',
      render: (b) => (
        <span className="font-semibold text-white">{formatCurrency(Number(b.bonusAmount))}</span>
      ),
    },
    {
      key: 'scaleSource',
      header: 'Escala',
      render: (b) => (
        <Badge variant={b.scaleSource === 'SELLER_OVERRIDE' ? 'warning' : 'default'}>
          {b.scaleSource === 'SELLER_OVERRIDE' ? 'Personal' : 'Global'}
        </Badge>
      ),
    },
    {
      key: 'odooMoveName',
      header: 'Asiento',
      render: (b) => (
        <span className="text-xs text-white/50">{b.odooMoveName || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (b) => {
        const s = bonusStatusMap[b.status] || { label: b.status, variant: 'default' as const };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
  ];

  const yearOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Bonos Registrados"
          value={formatCurrency(totalPosted)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Fallidos"
          value={countFailed}
          icon={<RefreshCw className="h-5 w-5" />}
        />
        <StatCard
          label="Omitidos"
          value={countSkipped}
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      {/* Run controls */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white/80">Procesar Bonos Mensuales</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={runYear}
            onChange={(e) => setRunYear(e.target.value)}
            className="w-28"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
          <Select
            value={runMonth}
            onChange={(e) => setRunMonth(e.target.value)}
            className="w-36"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Button
            icon={<Play className="h-4 w-4" />}
            onClick={() => runMutation.mutate()}
            loading={runMutation.isPending}
            disabled={!runYear || !runMonth}
          >
            Ejecutar
          </Button>
          {runResult && (
            <span className="text-xs text-white/60">
              Procesados: {runResult.total} | Registrados: {runResult.posted} | Fallidos: {runResult.failed} | Omitidos: {runResult.skipped}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <Select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="w-28"
        >
          <option value="">Todos los años</option>
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="w-36"
        >
          <option value="">Todos los meses</option>
          {MONTHS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>
        <Select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value)}
          className="w-48"
        >
          <option value="">Todos los vendedores</option>
          {sellers.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        >
          <option value="">Todos los estados</option>
          <option value="POSTED">Registrado</option>
          <option value="FAILED">Fallido</option>
          <option value="SKIPPED_NO_DELTA">Sin delta</option>
          <option value="SKIPPED_DISABLED">Deshabilitado</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        keyExtractor={(b) => b.id}
        emptyMessage="No hay bonos mensuales para mostrar"
        rowActions={(b) => (
          b.status === 'FAILED' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRetryTarget(b)}
              title="Reintentar"
            >
              <RefreshCw className="h-4 w-4 text-accent-purple" />
            </Button>
          ) : null
        )}
      />

      <ConfirmDialog
        open={!!retryTarget}
        onClose={() => setRetryTarget(null)}
        onConfirm={() => retryTarget && retryMutation.mutate(retryTarget.id)}
        title="Reintentar Bono"
        message={`Reintentar el asiento Odoo del bono de ${retryTarget?.seller?.name} para ${MONTHS.find(m => m.value === retryTarget?.month)?.label} ${retryTarget?.year}?`}
        confirmText="Reintentar"
        loading={retryMutation.isPending}
      />
    </div>
  );
}

export default function CommissionsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'commissions' | 'bonuses'>('commissions');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reverseTarget, setReverseTarget] = useState<any>(null);

  const { data: summary } = useQuery({
    queryKey: ['commission-summary'],
    queryFn: () => fetchCommissionSummary(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['commissions', page, statusFilter, sellerFilter, dateFrom, dateTo],
    queryFn: () =>
      fetchCommissions({
        page,
        status: statusFilter || undefined,
        sellerId: sellerFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: activeTab === 'commissions',
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers'],
    queryFn: fetchSellers,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveCommission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-summary'] });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => bulkApproveCommissions(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-summary'] });
      setSelectedIds([]);
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => reverseCommission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commission-summary'] });
      setReverseTarget(null);
    },
  });

  function toggleSelection(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const columns: Column<any>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-10',
      render: (comm) => (
        comm.status === 'PENDING' ? (
          <input
            type="checkbox"
            checked={selectedIds.includes(comm.id)}
            onChange={() => toggleSelection(comm.id)}
            className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
          />
        ) : null
      ),
    },
    {
      key: 'orderNumber',
      header: 'Pedido',
      render: (comm) => (
        <button
          onClick={() => router.push(`/orders/${comm.orderId}`)}
          className="font-medium text-accent-purple hover:underline cursor-pointer"
        >
          #{comm.order?.orderNumber || comm.orderNumber || comm.orderId?.slice(0, 8)}
        </button>
      ),
    },
    {
      key: 'sellerName',
      header: 'Vendedor',
      render: (comm) => (
        <div>
          {(comm.user?.id || comm.userId) ? (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/users/${comm.user?.id || comm.userId}`); }}
              className="text-sm text-accent-purple hover:underline"
            >
              {comm.user?.name || comm.sellerName || comm.userName || '-'}
            </button>
          ) : (
            <p className="text-sm text-white/70">{comm.user?.name || comm.sellerName || comm.userName || '-'}</p>
          )}
          <p className="text-xs text-white/50">{comm.user?.email || comm.sellerEmail || ''}</p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Nivel',
      render: (comm) => (
        <Badge variant={comm.level === 1 ? 'info' : 'outline'}>L{comm.level}</Badge>
      ),
    },
    {
      key: 'rate',
      header: 'Tasa',
      render: (comm) => <span className="text-sm">{formatPercent(comm.rate)}</span>,
    },
    {
      key: 'baseAmount',
      header: 'Base',
      render: (comm) => (
        <span className="text-sm text-white/70">{formatCurrency(comm.baseAmount || 0)}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Comision',
      sortable: true,
      render: (comm) => (
        <span className="font-medium text-white">{formatCurrency(comm.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (comm) => {
        const s = commissionStatusMap[comm.status] || { label: comm.status, variant: 'default' as const };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Comisiones</h1>
          <p className="page-description">Gestion de comisiones y bonos de vendedores</p>
        </div>
        {activeTab === 'commissions' && selectedIds.length > 0 && (
          <Button
            icon={<Check className="h-4 w-4" />}
            onClick={() => bulkApproveMutation.mutate(selectedIds)}
            loading={bulkApproveMutation.isPending}
          >
            Aprobar Seleccionados ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        <button
          onClick={() => setActiveTab('commissions')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'commissions'
              ? 'border-accent-purple text-accent-purple'
              : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          Comisiones
        </button>
        <button
          onClick={() => setActiveTab('bonuses')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'bonuses'
              ? 'border-accent-purple text-accent-purple'
              : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Bonos por Escala
        </button>
      </div>

      {activeTab === 'bonuses' && (
        <MonthlyBonusTab sellers={sellers || []} />
      )}

      {activeTab === 'commissions' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Pendiente"
              value={formatCurrency(summary?.availableForPayout ?? 0)}
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              label="Total Aprobado"
              value={formatCurrency(summary?.approved ?? 0)}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <StatCard
              label="Total Pagado"
              value={formatCurrency(summary?.totalPaidOut ?? summary?.paid ?? 0)}
              icon={<DollarSign className="h-5 w-5" />}
            />
          </div>

          {/* Filters */}
          <div className="filter-bar">
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-40"
            >
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobada</option>
              <option value="PAID">Pagada</option>
              <option value="REVERSED">Revertida</option>
            </Select>
            <Select
              value={sellerFilter}
              onChange={(e) => { setSellerFilter(e.target.value); setPage(1); }}
              className="w-48"
            >
              <option value="">Todos los vendedores</option>
              {(sellers || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <div>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-36"
              />
            </div>
            <div>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-36"
              />
            </div>
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
            keyExtractor={(c) => c.id}
            emptyMessage="No hay comisiones para mostrar"
            rowActions={(comm) => (
              <div className="flex items-center gap-1">
                {comm.status === 'PENDING' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => approveMutation.mutate(comm.id)}
                    loading={approveMutation.isPending}
                    title="Aprobar"
                  >
                    <CheckCircle className="h-4 w-4 text-status-success" />
                  </Button>
                )}
                {(comm.status === 'PENDING' || comm.status === 'APPROVED') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReverseTarget(comm)}
                    title="Revertir"
                  >
                    <Undo2 className="h-4 w-4 text-danger-500" />
                  </Button>
                )}
              </div>
            )}
          />

          {/* Reverse Confirm */}
          <ConfirmDialog
            open={!!reverseTarget}
            onClose={() => setReverseTarget(null)}
            onConfirm={() => reverseTarget && reverseMutation.mutate(reverseTarget.id)}
            title="Revertir Comision"
            message={`Revertir la comision de ${formatCurrency(reverseTarget?.amount || 0)} para ${reverseTarget?.sellerName}?`}
            confirmText="Revertir"
            variant="danger"
            loading={reverseMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
