'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Search, Link2, Copy, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useLeads, useLeadStats, useGenerateLeadLink } from '@/hooks/use-leads';
import { formatDate } from '@/lib/utils';
import type { LeadStatus } from '@/lib/types';

type FilterTab = 'all' | LeadStatus;

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  SENT: { label: 'Enviado', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  RESPONDED: { label: 'Respondido', color: 'text-amber-400', bg: 'bg-amber-500/15' },
  APPOINTMENT: { label: 'Cita Agendada', color: 'text-purple-400', bg: 'bg-purple-500/15' },
  VISITED: { label: 'Visitado', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  CONVERTED: { label: 'Convertido', color: 'text-green-400', bg: 'bg-green-500/15' },
};

const tabs: { label: string; value: FilterTab }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Respondidos', value: 'RESPONDED' },
  { label: 'Citas', value: 'APPOINTMENT' },
  { label: 'Visitados', value: 'VISITED' },
  { label: 'Convertidos', value: 'CONVERTED' },
  { label: 'Enviados', value: 'SENT' },
];

export default function LeadsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const { data: leadsData, isLoading } = useLeads({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });
  const { data: stats } = useLeadStats();
  const generateLink = useGenerateLeadLink();

  const leads = leadsData?.data ?? [];

  const handleGenerateLink = async () => {
    try {
      const result = await generateLink.mutateAsync();
      setGeneratedLink(result.url);
      setShowLinkModal(true);
    } catch {
      // handled by react-query
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="pb-24">
      <PageHeader
        title="Leads"
        action={
          <button
            onClick={handleGenerateLink}
            className="flex items-center gap-1.5 rounded-full bg-accent-purple/20 px-3 py-1.5 text-xs font-medium text-accent-purple"
          >
            <Link2 className="h-3.5 w-3.5" />
            Mi Link
          </button>
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

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="w-full rounded-xl border border-glass-border bg-glass-50 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-accent-purple/50"
          />
        </div>

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
                {tab.value !== 'all' && stats?.byStatus?.[tab.value]
                  ? ` (${stats.byStatus[tab.value]})`
                  : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Lead List */}
        {isLoading ? (
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
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-white/25">
                      {lead.mode === 'PERSONAL' ? '👤' : '🌐'} {formatDate(lead.createdAt)}
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
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLinkModal(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl bg-surface-raised border-t border-glass-border p-6 pb-10"
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
