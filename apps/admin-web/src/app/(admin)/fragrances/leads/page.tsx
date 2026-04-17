'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminLeads, fetchAdminLeadAnalytics, fetchAdminLeadById } from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Search, Target, TrendingUp, Users, ShoppingBag, X, Star, Sparkles } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';

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

function LeadResultsModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { data: lead, isLoading } = useQuery({
    queryKey: ['admin-lead', leadId],
    queryFn: () => fetchAdminLeadById(leadId),
  });

  const aiAnalysis = lead?.aiAnalysis as any;
  const recommendations = (lead?.recommendations as any[]) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Cargando resultados...</div>
        ) : !lead ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Lead no encontrado</div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-5 pr-8">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={STATUS_VARIANT[lead.status] || 'default'}>{STATUS_LABELS[lead.status] || lead.status}</Badge>
                <span className="text-xs text-white/30">{formatDate(lead.createdAt)}</span>
              </div>
              <h2 className="text-lg font-semibold text-white">{lead.clientName || 'Sin nombre'}</h2>
              <p className="text-xs text-white/40">{lead.clientEmail || lead.clientPhone || '—'} · Vendedor: {lead.seller?.name || '—'}</p>
              {lead.convertedOrder && (
                <p className="mt-1 text-xs text-green-400">Convertido → Pedido #{lead.convertedOrder.orderNumber} · {formatCurrency(lead.convertedOrder.total)}</p>
              )}
            </div>

            {/* AI Profile */}
            {aiAnalysis && (
              <div className="mb-5 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">Perfil olfativo</span>
                </div>
                {aiAnalysis.personalityProfile && (
                  <p className="text-sm text-white/70 mb-2">{aiAnalysis.personalityProfile}</p>
                )}
                {aiAnalysis.styleKeywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {aiAnalysis.styleKeywords.map((kw: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">{kw}</span>
                    ))}
                  </div>
                )}
                {aiAnalysis.summary && (
                  <p className="text-xs text-white/50 italic">"{aiAnalysis.summary}"</p>
                )}
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">Recomendaciones ({recommendations.length})</span>
                </div>
                <div className="space-y-3">
                  {recommendations.map((rec: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      {rec.product?.images?.[0]?.url ? (
                        <img src={rec.product.images[0].url} alt={rec.product.name} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-white/5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white truncate">{rec.product?.name || rec.name || `Perfume ${i + 1}`}</p>
                          {rec.product?.price && (
                            <span className="text-xs text-amber-300 flex-shrink-0">{formatCurrency(rec.product.price)}</span>
                          )}
                        </div>
                        {rec.reason && <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{rec.reason}</p>}
                        {rec.notasDestacadas?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(rec.notasDestacadas as string[]).slice(0, 4).map((nota: string, j: number) => (
                              <span key={j} className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">{nota}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lead.status === 'SENT' && (
              <p className="text-center text-sm text-white/40 mt-4">El cuestionario aún no ha sido respondido</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminLeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

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
        onRowClick={(item) => setSelectedLeadId(item.id)}
      />

      {selectedLeadId && (
        <LeadResultsModal leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}

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
