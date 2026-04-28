'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Search, Link2, Copy, Check, LayoutList, Columns3, CheckSquare, Square, ShoppingBag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useLeads, useLeadStats, useGenerateLeadLink, useUpdateLeadStatus, useCurrentUser } from '@/hooks/use-leads';
import { useCategories } from '@/hooks/use-products';
import { formatDate } from '@/lib/utils';
import type { LeadStatus } from '@/lib/types';

type FilterTab = 'all' | LeadStatus;
type ViewMode = 'list' | 'kanban';

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  SENT: { label: 'Enviado', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  RESPONDED: { label: 'Respondido', color: 'text-amber-400', bg: 'bg-amber-500/15' },
  APPOINTMENT: { label: 'Cita Agendada', color: 'text-purple-400', bg: 'bg-purple-500/15' },
  VISITED: { label: 'Visitado', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  CONVERTED: { label: 'Convertido', color: 'text-green-400', bg: 'bg-green-500/15' },
  PURCHASED: { label: 'Compró', color: 'text-emerald-300', bg: 'bg-emerald-400/15' },
};

const tabs: { label: string; value: FilterTab }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Respondidos', value: 'RESPONDED' },
  { label: 'Citas', value: 'APPOINTMENT' },
  { label: 'Visitados', value: 'VISITED' },
  { label: 'Convertidos', value: 'CONVERTED' },
  { label: 'Compras', value: 'PURCHASED' },
  { label: 'Enviados', value: 'SENT' },
];

export default function LeadsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('leads-view') as ViewMode) || 'list';
    }
    return 'list';
  });
  const setViewMode = (v: ViewMode) => {
    setViewModeState(v);
    sessionStorage.setItem('leads-view', v);
  };
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [showStoreLinkModal, setShowStoreLinkModal] = useState(false);
  const [storeLinkCopied, setStoreLinkCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  const { data: leadsData, isLoading } = useLeads({
    status: statusFilter === 'all' || viewMode === 'kanban' ? undefined : statusFilter,
    search: search || undefined,
  });
  const { data: stats } = useLeadStats();
  const { data: categoriesData } = useCategories();
  const generateLink = useGenerateLeadLink();
  const updateStatus = useUpdateLeadStatus();
  const { data: currentUser } = useCurrentUser();

  const leads = leadsData?.data ?? [];

  // Build category map: brand name → full category name
  const fullCategories: string[] = Array.isArray(categoriesData) ? categoriesData : [];
  const categoryMap: Record<string, string> = {};
  fullCategories.forEach((c: string) => {
    const parts = c.split('/').map((p: string) => p.trim());
    const brand = parts.length >= 3 ? parts[2] : parts[parts.length - 1];
    if (!categoryMap[brand]) categoryMap[brand] = c;
  });
  const sellerCategories = Object.keys(categoryMap);

  const handleGenerateLink = async () => {
    if (sellerCategories.length > 1) {
      // Show category picker first
      setSelectedCategories([...sellerCategories]); // all selected by default
      setShowCategoryPicker(true);
    } else {
      // Only 1 category or none — generate link directly
      const fullNames = sellerCategories.map(b => categoryMap[b]).filter(Boolean);
      try {
        const result = await generateLink.mutateAsync(fullNames.length > 0 ? fullNames : undefined);
        setGeneratedLink(result.url);
        setShowLinkModal(true);
      } catch {
        // handled by react-query
      }
    }
  };

  const handleConfirmCategories = async () => {
    setShowCategoryPicker(false);
    const fullNames = selectedCategories.map(b => categoryMap[b]).filter(Boolean);
    try {
      const result = await generateLink.mutateAsync(fullNames.length > 0 ? fullNames : undefined);
      setGeneratedLink(result.url);
      setShowLinkModal(true);
    } catch {
      // handled by react-query
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const storeLink = typeof window !== 'undefined' && currentUser?.sellerCode
    ? `${window.location.origin}/s/${currentUser.sellerCode}`
    : '';

  const copyStoreLink = () => {
    if (!storeLink) return;
    navigator.clipboard.writeText(storeLink);
    setStoreLinkCopied(true);
    setTimeout(() => setStoreLinkCopied(false), 2000);
  };

  return (
    <div className="pb-24">
      <PageHeader
        title="Leads"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStoreLinkModal(true)}
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Link Tienda
            </button>
            <button
              onClick={handleGenerateLink}
              className="flex items-center gap-1.5 rounded-full bg-accent-purple/20 px-3 py-1.5 text-xs font-medium text-accent-purple"
            >
              <Link2 className="h-3.5 w-3.5" />
              Mi Link
            </button>
          </div>
        }
      />

      <div className="px-4">
        {/* Stats banner */}
        {stats && stats.newLeads > 0 && (
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-4">
            <p className="text-sm text-amber-300">
              <span className="font-bold">{stats.newLeads}</span> lead{stats.newLeads > 1 ? 's' : ''} esperando que los contactes ✨
            </p>
          </div>
        )}

        {/* Search + View Toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full rounded-xl border border-glass-border bg-glass-50 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-accent-purple/50"
            />
          </div>
          <div className="flex rounded-xl border border-glass-border bg-glass-50 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg p-2 transition-colors ${viewMode === 'list' ? 'bg-accent-purple text-white' : 'text-white/30'}`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`rounded-lg p-2 transition-colors ${viewMode === 'kanban' ? 'bg-accent-purple text-white' : 'text-white/30'}`}
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status Filter Tabs — List mode only */}
        {viewMode === 'list' && (
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
                {tab.value !== 'all' && stats?.byStatus?.[tab.value]
                  ? ` (${stats.byStatus[tab.value]})`
                  : ''}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Kanban View */}
        {viewMode === 'kanban' ? (
          isLoading ? (
            <PageSpinner />
          ) : (
            <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 pb-4" style={{ minWidth: '900px' }}>
                {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(([status, config]) => {
                  const columnLeads = leads.filter((l: any) => l.status === status);
                  return (
                    <div
                      key={status}
                      className="flex-1 min-w-[170px]"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const leadId = e.dataTransfer.getData('leadId');
                        if (leadId) {
                          updateStatus.mutate({ id: leadId, status });
                          setDraggedLeadId(null);
                        }
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-white/20">{columnLeads.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[60px] rounded-xl bg-glass-50/30 p-2">
                        {columnLeads.map((lead: any) => (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('leadId', lead.id);
                              setDraggedLeadId(lead.id);
                            }}
                            onDragEnd={() => setDraggedLeadId(null)}
                            onClick={() => router.push(`/leads/${lead.id}`)}
                            className={`cursor-grab active:cursor-grabbing rounded-xl border border-glass-border bg-surface-raised p-3 transition-opacity ${
                              draggedLeadId === lead.id ? 'opacity-40' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-white truncate">
                              {lead.clientName || lead.customer?.name || 'Sin nombre'}
                            </p>
                            <p className="text-[11px] text-white/30 truncate mt-0.5">
                              {lead.clientCity || lead.clientPhone || ''}
                            </p>
                            <p className="text-[10px] text-white/20 mt-1">
                              {formatDate(lead.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (

        /* Lead List */
        isLoading ? (
          <PageSpinner />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-8 w-8" />}
            title="Sin leads"
            description={
              statusFilter !== 'all'
                ? 'No hay leads con este estado'
                : 'Compartí tu link de cuestionario para empezar a recibir leads'
            }
            action={
              statusFilter === 'all'
                ? { label: 'Generar Link', onClick: handleGenerateLink }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {leads.map((lead: any) => {
              const config = STATUS_CONFIG[lead.status as LeadStatus] || STATUS_CONFIG.SENT;
              return (
                <Card
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      {lead.mode === 'PUBLIC' && !lead.customerId && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Nuevo
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/25">
                      {formatDate(lead.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {lead.clientName || lead.customer?.name || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-white/30 truncate">
                        {lead.clientPhone || lead.clientEmail || 'Sin contacto'}
                      </p>
                    </div>
                    {lead.status === 'RESPONDED' && (
                      <div className="pl-3">
                        <span className="text-xs text-amber-400 font-medium">Nuevo →</span>
                      </div>
                    )}
                    {lead.status === 'APPOINTMENT' && lead.appointmentDate && (
                      <div className="pl-3 text-right">
                        <p className="text-xs text-purple-400 font-medium">
                          {new Date(lead.appointmentDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </p>
                        {lead.appointmentTime && (
                          <p className="text-[10px] text-white/30">{lead.appointmentTime}</p>
                        )}
                      </div>
                    )}
                    {lead.status === 'PURCHASED' && lead.purchaseMatch && (
                      <div className="pl-3 text-right">
                        {lead.purchaseMatch.boughtRecommended ? (
                          <p className="text-xs text-emerald-400 font-medium">✓ Recomendado</p>
                        ) : (
                          <p className="text-xs text-orange-400 font-medium">Otro producto</p>
                        )}
                        {lead.purchaseMatch.recommended.length > 0 && (
                          <p className="text-[10px] text-white/30">{lead.purchaseMatch.matchRate}% match</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
        )}
      </div>

      {/* Category Picker Modal */}
      {showCategoryPicker && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCategoryPicker(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl bg-surface-raised border-t border-glass-border p-6"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Categorías del Cuestionario</h3>
            <p className="text-sm text-white/40 mb-4">Seleccioná qué categorías quieres incluir en los resultados</p>

            <div className="space-y-2 mb-6">
              {sellerCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-3 w-full rounded-xl border p-3.5 text-left transition-colors ${
                    selectedCategories.includes(cat)
                      ? 'border-accent-purple/50 bg-accent-purple/10'
                      : 'border-glass-border bg-glass-50'
                  }`}
                >
                  {selectedCategories.includes(cat) ? (
                    <CheckSquare className="h-5 w-5 text-accent-purple shrink-0" />
                  ) : (
                    <Square className="h-5 w-5 text-white/30 shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${selectedCategories.includes(cat) ? 'text-white' : 'text-white/50'}`}>
                    {cat}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleConfirmCategories}
              disabled={selectedCategories.length === 0 || generateLink.isPending}
              className="w-full py-3 rounded-full bg-accent-purple text-white font-medium text-sm disabled:opacity-40"
            >
              {generateLink.isPending ? 'Generando...' : 'Generar Link'}
            </button>
          </div>
        </div>
      )}

      {/* Store Link Modal */}
      {showStoreLinkModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowStoreLinkModal(false); setShowQR(false); }}>
          <div
            className="w-full max-w-lg rounded-t-3xl bg-surface-raised border-t border-glass-border p-6"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white leading-tight">Tu Tienda Online</h3>
                <p className="text-[11px] text-white/35">Catálogo · Carrito · Pagos online</p>
              </div>
            </div>
            <p className="text-sm text-white/40 mb-4 mt-2">
              Comparte este link para que tus clientes vean tus fragancias y puedan comprar directamente
            </p>

            {currentUser?.sellerCode ? (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-glass-50 border border-glass-border p-3 mb-3">
                  <p className="flex-1 text-sm text-white/70 truncate">{storeLink}</p>
                  <button
                    onClick={copyStoreLink}
                    className="shrink-0 p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    {storeLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                {showQR && (
                  <div className="mb-3 flex flex-col items-center gap-2 p-4 rounded-xl bg-white">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(storeLink)}`}
                      alt="QR de la tienda"
                      className="w-[260px] h-[260px]"
                    />
                    <p className="text-[11px] text-black/50 text-center">Escanea para abrir tu tienda</p>
                    <a
                      href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(storeLink)}`}
                      download={`tienda-${currentUser.sellerCode}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:text-emerald-700 underline"
                    >
                      Descargar QR
                    </a>
                  </div>
                )}

                <button
                  onClick={() => setShowQR(v => !v)}
                  className="w-full py-3 rounded-full bg-glass-50 border border-glass-border text-white/80 font-medium text-sm flex items-center justify-center gap-2 hover:bg-glass-100 transition-colors mb-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h1v1h-1zM18 18h3v3h-3z" />
                  </svg>
                  {showQR ? 'Ocultar QR' : 'Mostrar QR'}
                </button>

                <button
                  onClick={() => {
                    const text = encodeURIComponent(`🌿 Mirá mi tienda de fragancias exclusivas D Perfume House:\n${storeLink}\n\nEncuentra tu perfume ideal ✨`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="w-full py-3 rounded-full bg-[#25D366] text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#22c05d] transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Compartir por WhatsApp
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLinkModal(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl bg-surface-raised border-t border-glass-border p-6"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Tu Link de Cuestionario</h3>
            <p className="text-sm text-white/40 mb-4">Compartilo en redes sociales, WhatsApp o donde quieras</p>

            <div className="flex items-center gap-2 rounded-xl bg-glass-50 border border-glass-border p-3">
              <p className="flex-1 text-sm text-white/70 truncate">{generatedLink}</p>
              <button onClick={copyLink} className="shrink-0 p-2 rounded-lg bg-accent-purple/20 text-accent-purple">
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <button
              onClick={() => {
                const text = encodeURIComponent(`¡Encontrá tu perfume ideal! 🌿✨ Completá este cuestionario rápido:\n${generatedLink}`);
                window.open(`https://wa.me/?text=${text}`, '_blank');
              }}
              className="mt-4 w-full py-3 rounded-full bg-[#25D366] text-white font-medium text-sm flex items-center justify-center gap-2"
            >
              Compartir por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
