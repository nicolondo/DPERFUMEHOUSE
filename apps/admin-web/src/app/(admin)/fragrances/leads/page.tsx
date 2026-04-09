'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminLeads, fetchAdminLeadAnalytics } from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Search, Target, TrendingUp, Users, ShoppingBag } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  SENT: 'Enviado',
  RESPONDED: 'Respondido',
  APPOINTMENT: 'Cita',
  VISITED: 'Visitado',
  CONVERTED: 'Convertido',
};

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'orange'> = {
  SENT: 'default',
  RESPONDED: 'warning',
  APPOINTMENT: 'info',
  VISITED: 'orange',
  CONVERTED: 'success',
};

export default function AdminLeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['admin-leads', page, search, statusFilter],
    queryFn: () => fetchAdminLeads({
      page,
      pageSize: 20,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
  });

  const { data: analytics } = useQuery({
    queryKey: ['admin-lead-analytics'],
    queryFn: fetchAdminLeadAnalytics,
  });

  const columns: Column<any>[] = [
    {
      key: 'client',
      header: 'Cliente',
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.clientName || item.customer?.name || 'Sin nombre'}</p>
          <p className="text-xs text-white/40">{item.clientPhone || item.clientEmail || '—'}</p>
        </div>
      ),
    },
    {
      key: 'seller',
      header: 'Vendedor',
      render: (item) => <span className="text-sm text-white/70">{item.seller?.name || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => (
        <Badge variant={STATUS_VARIANT[item.status] || 'default'}>
          {STATUS_LABELS[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'mode',
      header: 'Tipo',
      render: (item) => (
        <span className="text-xs text-white/50">{item.mode === 'PERSONAL' ? '👤 Personal' : '🌐 Público'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (item) => <span className="text-sm text-white/50">{formatDate(item.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Leads & Cuestionarios</h1>
        <p className="page-description">Vista general de todos los leads generados por vendedores</p>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/30">Total Leads</p>
                <p className="text-xl font-bold text-white">{analytics.total || 0}</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Users className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-white/30">Respondidos</p>
                <p className="text-xl font-bold text-white">{analytics.byStatus?.RESPONDED || 0}</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-white/30">Citas</p>
                <p className="text-xl font-bold text-white">{analytics.byStatus?.APPOINTMENT || 0}</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <ShoppingBag className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-white/30">Convertidos</p>
                <p className="text-xl font-bold text-white">{analytics.byStatus?.CONVERTED || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre o teléfono..."
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="w-40"
        >
          <option value="">Todos</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={leadsData?.data || []}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={leadsData?.meta?.total || 0}
        onPageChange={setPage}
      />
    </div>
  );
}
