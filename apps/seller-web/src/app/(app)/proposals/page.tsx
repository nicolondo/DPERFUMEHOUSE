'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, FileText, Eye, Users, Copy, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useProposals } from '@/hooks/use-proposals';
import { formatDate } from '@/lib/utils';

export default function ProposalsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { data, isLoading } = useProposals({ search: search || undefined });

  const proposals = data?.data ?? [];

  const getPublicUrl = (id: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/p/${id}`;
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(getPublicUrl(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="pb-24">
      <PageHeader
        title="Propuestas"
        action={
          <button
            onClick={() => router.push('/proposals/new')}
            className="flex items-center gap-1.5 rounded-full bg-accent-purple/20 px-3 py-1.5 text-xs font-medium text-accent-purple"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva
          </button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar propuesta..."
            className="w-full rounded-xl bg-glass-50 border border-glass-border py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-accent-purple/50 focus:outline-none"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <PageSpinner />
        ) : proposals.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Sin propuestas"
            description="Crea una propuesta personalizada para tus clientes"
          />
        ) : (
          <div className="space-y-3">
            {proposals.map((p: any) => (
              <Card
                key={p.id}
                className="p-4 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => router.push(`/proposals/${p.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {p.customer?.name || `Propuesta · ${p._count?.items || 0} productos`}
                    </p>
                    {p.customer && (
                      <p className="text-xs text-white/50 mt-0.5 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {p._count?.items || 0} productos
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                      <span>{formatDate(p.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {p.viewCount} vistas
                      </span>
                      <span>{p._count?.items || 0} productos</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyLink(p.id);
                    }}
                    className="flex-shrink-0 rounded-full p-2 bg-glass-50 text-white/50 hover:text-accent-gold transition-colors"
                  >
                    {copiedId === p.id ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
