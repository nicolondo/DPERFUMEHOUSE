'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminLeads, fetchAdminLeadAnalytics, fetchAdminLeadById } from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Search, Target, TrendingUp, Users, ShoppingBag, X, Star, Sparkles, Phone, Mail, MapPin, Calendar, Clock, Gift, Lightbulb, AlertTriangle, ClipboardList, MessageSquare } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  SENT: 'Enviado',
  RESPONDED: 'Respondido',
  APPOINTMENT: 'Cita',
  VISITED: 'Visitado',
  CONVERTED: 'Convertido',
  PURCHASED: 'Compró',
};

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'orange'> = {
  SENT: 'default',
  RESPONDED: 'warning',
  APPOINTMENT: 'info',
  VISITED: 'orange',
  CONVERTED: 'success',
  PURCHASED: 'success',
};

function LeadResultsModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['admin-lead', leadId],
    queryFn: () => fetchAdminLeadById(leadId),
  });

  const aiAnalysis = lead?.aiAnalysis as any;
  const recommendations = (lead?.recommendations as any[]) || [];
  const script = lead?.sellerScript as any;
  const hasResponded = lead ? ['RESPONDED', 'APPOINTMENT', 'VISITED', 'CONVERTED', 'PURCHASED'].includes(lead.status) : false;

  const openWhatsApp = () => {
    const phone = lead?.clientPhone?.replace(/\D/g, '');
    if (!phone) return;
    const name = lead?.clientName?.split(' ')[0] || '';
    const msg = `Hola ${name}! 🌿 Soy ${lead?.seller?.name || 'admin'} de D Perfume House.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors z-10">
          <X className="h-5 w-5" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Cargando resultados...</div>
        ) : !lead ? (
          <div className="flex items-center justify-center h-40 text-white/40 text-sm">Lead no encontrado</div>
        ) : (
          <>
            {/* Header */}
            <div className="pr-8">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={STATUS_VARIANT[lead.status] || 'default'}>{STATUS_LABELS[lead.status] || lead.status}</Badge>
                <span className="text-xs text-white/30">{formatDate(lead.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{lead.clientName || 'Sin nombre'}</h2>
                {lead.clientPhone && (
                  <button onClick={openWhatsApp} className="p-2 rounded-full bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors">
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-white/40">Vendedor: {lead.seller?.name || '—'}</p>
              {lead.convertedOrder && (
                <p className="mt-1 text-xs text-green-400">✓ Convertido → Pedido #{lead.convertedOrder.orderNumber} · {formatCurrency(lead.convertedOrder.total)}</p>
              )}
              {lead.status === 'PURCHASED' && (lead as any).purchaseMatch && (
                <p className="mt-1 text-xs text-emerald-400">
                  💸 Compró · {(lead as any).purchaseMatch.boughtRecommended
                    ? `${(lead as any).purchaseMatch.matched.length} recomendado${(lead as any).purchaseMatch.matched.length !== 1 ? 's' : ''} · ${(lead as any).purchaseMatch.matchRate}% match`
                    : `Otros productos · ${(lead as any).purchaseMatch.matchRate}% match`}
                </p>
              )}
            </div>

            {/* Contact Info */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Información de Contacto</p>
              <div className="space-y-2">
                {lead.clientPhone && (
                  <a href={`tel:${lead.clientPhone}`} className="flex items-center gap-2.5 text-sm group">
                    <Phone className="h-3.5 w-3.5 text-white/30 shrink-0" />
                    <span className="text-accent-purple group-hover:underline">{lead.clientPhone}</span>
                  </a>
                )}
                {lead.clientEmail && (
                  <a href={`mailto:${lead.clientEmail}`} className="flex items-center gap-2.5 text-sm group">
                    <Mail className="h-3.5 w-3.5 text-white/30 shrink-0" />
                    <span className="text-white/60 group-hover:underline">{lead.clientEmail}</span>
                  </a>
                )}
                {lead.clientCity && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-white/30 shrink-0" />
                    <span className="text-white/60">{lead.clientCity}</span>
                  </div>
                )}
                {lead.budgetRange && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="text-white/30 text-base leading-none">💰</span>
                    <span className="text-white/60">{lead.budgetRange}</span>
                  </div>
                )}
                {(lead as any).isForGift && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Gift className="h-3.5 w-3.5 text-amber-400/60 shrink-0" />
                    <span className="text-amber-400/80">
                      Regalo{(lead as any).giftRecipient ? ` para: ${(lead as any).giftRecipient}` : ''}
                    </span>
                  </div>
                )}
                {!lead.clientPhone && !lead.clientEmail && !lead.clientCity && !lead.budgetRange && (
                  <p className="text-sm text-white/30 italic">Sin información de contacto</p>
                )}
              </div>
            </div>

            {/* Appointment */}
            {lead.status === 'APPOINTMENT' && (lead as any).appointmentDate && (
              <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-purple-400" />
                  <p className="text-xs font-medium text-white/30 uppercase tracking-wider">Cita Agendada</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-white/30 shrink-0" />
                    <span className="text-white/80">
                      {new Date((lead as any).appointmentDate).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  {(lead as any).appointmentTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-white/30 shrink-0" />
                      <span className="text-white/80">{(lead as any).appointmentTime}</span>
                    </div>
                  )}
                  {(lead as any).appointmentLocation && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-white/30 shrink-0" />
                      <span className="text-white/80">{(lead as any).appointmentLocation}</span>
                    </div>
                  )}
                  {(lead as any).appointmentNotes && (
                    <p className="text-xs text-white/40 mt-1">{(lead as any).appointmentNotes}</p>
                  )}
                </div>
              </div>
            )}

            {/* AI Briefing */}
            {hasResponded && aiAnalysis && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <p className="text-xs font-medium text-white/30 uppercase tracking-wider">Perfil del Cliente</p>
                </div>
                {(aiAnalysis.clientProfile || aiAnalysis.personalityProfile) && (
                  <p className="text-sm text-white/70 mb-3 leading-relaxed">
                    {typeof aiAnalysis.clientProfile === 'string'
                      ? aiAnalysis.clientProfile
                      : aiAnalysis.clientProfile?.summary || aiAnalysis.personalityProfile || ''}
                  </p>
                )}
                {aiAnalysis.styleKeywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {aiAnalysis.styleKeywords.map((kw: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">{kw}</span>
                    ))}
                  </div>
                )}
                {aiAnalysis.summary && (
                  <p className="text-xs text-white/40 italic mb-3">"{aiAnalysis.summary}"</p>
                )}
                {script?.iceBreaker && (
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 mb-2">
                    <p className="text-[10px] font-medium text-amber-400/60 uppercase tracking-wider mb-1">Rompe hielo</p>
                    <p className="text-sm text-amber-300/90">{script.iceBreaker}</p>
                  </div>
                )}
                {script?.opening && (
                  <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-3">
                    <p className="text-[10px] font-medium text-purple-400/60 uppercase tracking-wider mb-1">Apertura</p>
                    <p className="text-sm text-purple-300/90">{script.opening}</p>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">Muestras a Presentar ({recommendations.length})</span>
                </div>
                <div className="space-y-3">
                  {recommendations.map((rec: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-start gap-3 mb-2">
                        {rec.product?.images?.[0]?.url ? (
                          <img src={rec.product.images[0].url} alt={rec.product.name} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-white/5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-purple/20 text-xs font-bold text-accent-purple">{i + 1}</span>
                              <p className="text-sm font-medium text-white truncate">{rec.product?.name || rec.name || `Perfume ${i + 1}`}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(rec.compatibility || rec.score) && (
                                <span className="text-xs font-medium text-emerald-400">{rec.compatibility || rec.score}%</span>
                              )}
                              {rec.product?.price && (
                                <span className="text-xs text-amber-300">{formatCurrency(rec.product.price)}</span>
                              )}
                            </div>
                          </div>
                          {(rec.mainArgument || rec.reason) && (
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Lightbulb className="h-3 w-3 text-amber-400/50 mt-0.5 shrink-0" />
                              <p className="text-xs text-white/60 leading-relaxed">{rec.mainArgument || rec.reason}</p>
                            </div>
                          )}
                          {rec.objectionHandling && (
                            <div className="flex items-start gap-1.5 mt-1">
                              <AlertTriangle className="h-3 w-3 text-red-400/50 mt-0.5 shrink-0" />
                              <p className="text-xs text-white/40 leading-relaxed">{rec.objectionHandling}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const notasArr = rec.notasDestacadas
                          ? (Array.isArray(rec.notasDestacadas) ? rec.notasDestacadas : String(rec.notasDestacadas).split(",").map((n: string) => n.trim()).filter(Boolean))
                          : [];
                        return notasArr.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {notasArr.slice(0, 5).map((nota: string, j: number) => (
                              <span key={j} className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">{nota}</span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Closing Tip */}
            {hasResponded && script?.closingTip && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="h-4 w-4 text-emerald-400" />
                  <p className="text-xs font-medium text-white/30 uppercase tracking-wider">Cierre</p>
                </div>
                <p className="text-sm text-white/70 leading-relaxed mb-3">{script.closingTip}</p>
                {script.objections?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Objeciones comunes</p>
                    {script.objections.map((obj: any, i: number) => (
                      <div key={i} className="text-xs text-white/50">
                        <span className="text-red-400/70">"{obj.objection || obj}"</span>
                        {obj.response && <span className="text-emerald-400/70"> → {obj.response}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Purchase Match */}
            {lead.status === 'PURCHASED' && (lead as any).purchaseMatch && (
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-emerald-400" />
                    <p className="text-xs font-medium text-white/30 uppercase tracking-wider">Resultado de Compra</p>
                  </div>
                  {(lead as any).purchaseMatch.recommended.length > 0 && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      (lead as any).purchaseMatch.matchRate >= 60 ? 'bg-emerald-400/15 text-emerald-400' :
                      (lead as any).purchaseMatch.matchRate >= 30 ? 'bg-amber-400/15 text-amber-400' :
                      'bg-red-400/15 text-red-400'
                    }`}>{(lead as any).purchaseMatch.matchRate}% match</span>
                  )}
                </div>
                {(lead as any).purchaseMatch.matched.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-emerald-400 font-medium mb-1">✓ Recomendados que compró</p>
                    {(lead as any).purchaseMatch.matched.map((item: any, i: number) => (
                      <p key={i} className="text-xs text-white/60 pl-2">• {item.name}</p>
                    ))}
                  </div>
                )}
                {(lead as any).purchaseMatch.extra.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-orange-400 font-medium mb-1">+ Otros productos</p>
                    {(lead as any).purchaseMatch.extra.map((item: any, i: number) => (
                      <p key={i} className="text-xs text-white/60 pl-2">• {item.name}</p>
                    ))}
                  </div>
                )}
                {(lead as any).purchaseMatch.unmatched.length > 0 && (
                  <div>
                    <p className="text-xs text-white/30 font-medium mb-1">✗ Recomendados no comprados</p>
                    {(lead as any).purchaseMatch.unmatched.map((item: any, i: number) => (
                      <p key={i} className="text-xs text-white/30 pl-2">• {item.name}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Timeline</p>
              <div className="space-y-2.5">
                {[
                  { date: lead.createdAt, label: 'Cuestionario enviado', icon: '📤' },
                  (lead as any).respondedAt && { date: (lead as any).respondedAt, label: 'Cuestionario completado', icon: '✅' },
                  (lead as any).appointmentAt && { date: (lead as any).appointmentAt, label: 'Cita agendada', icon: '📅' },
                  (lead as any).visitedAt && { date: (lead as any).visitedAt, label: 'Visita realizada', icon: '🏠' },
                  (lead as any).convertedAt && { date: (lead as any).convertedAt, label: 'Convertido a orden', icon: '🎉' },
                  (lead as any).purchasedAt && { date: (lead as any).purchasedAt, label: 'Compra realizada', icon: '💸' },
                ].filter(Boolean).map((event: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm">{event.icon}</span>
                    <div>
                      <p className="text-xs text-white/60">{event.label}</p>
                      <p className="text-[10px] text-white/25">{formatDate(event.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {lead.status === 'SENT' && (
              <p className="text-center text-sm text-white/40">El cuestionario aún no ha sido respondido</p>
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
