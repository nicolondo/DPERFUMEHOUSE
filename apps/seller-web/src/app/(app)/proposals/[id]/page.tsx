'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Copy, Check, Trash2, Eye, Share2, Package, MessageSquare, ExternalLink, Users,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/layout/page-header';
import { Modal } from '@/components/ui/modal';
import { useProposal, useDeleteProposal } from '@/hooks/use-proposals';
import { formatCurrency, formatDate, getWhatsAppPhone } from '@/lib/utils';

export default function ProposalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: proposal, isLoading } = useProposal(id);
  const deleteProposal = useDeleteProposal();
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${id}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = proposal?.customer?.phone
      ? `Hola ${proposal.customer.name}! Te preparé una selección especial de perfumes: ${publicUrl}`
      : `Mira esta selección de perfumes: ${publicUrl}`;
    const phone = getWhatsAppPhone(proposal?.customer?.phone, proposal?.customer?.phoneCode);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDelete = async () => {
    try {
      await deleteProposal.mutateAsync(id);
      router.replace('/proposals');
    } catch {
      // handled by react-query
    }
  };

  if (isLoading) return <PageSpinner />;
  if (!proposal) return null;

  const items = proposal.items ?? [];

  return (
    <div className="pb-24">
      <PageHeader
        title={proposal.title || 'Propuesta'}
        onBack={() => router.back()}
        action={
          <button
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full p-2 text-white/40 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Stats */}
        <div className="flex gap-3">
          <Card className="flex-1 p-3 text-center">
            <Eye className="h-4 w-4 text-white/40 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{proposal.viewCount}</p>
            <p className="text-xs text-white/40">Vistas</p>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <Package className="h-4 w-4 text-white/40 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{items.length}</p>
            <p className="text-xs text-white/40">Productos</p>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <Users className="h-4 w-4 text-white/40 mx-auto mb-1" />
            <p className="text-sm font-bold text-white truncate">{proposal.customer?.name || '—'}</p>
            <p className="text-xs text-white/40">Cliente</p>
          </Card>
        </div>

        {/* Message */}
        {proposal.message && (
          <Card className="p-4">
            <p className="text-xs text-white/40 mb-1">Mensaje</p>
            <p className="text-sm text-white/80">{proposal.message}</p>
          </Card>
        )}

        {/* Share */}
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-glass-50 border border-glass-border py-3 text-sm font-medium text-white/70"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </button>
          <button
            onClick={shareWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600/20 border border-green-600/30 py-3 text-sm font-medium text-green-400"
          >
            <Share2 className="h-4 w-4" />
            WhatsApp
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-glass-50 border border-glass-border px-4 py-3 text-sm font-medium text-white/70"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Info */}
        <p className="text-xs text-white/30">Creada {formatDate(proposal.createdAt)}</p>

        {/* Products */}
        <div>
          <h3 className="text-xs font-medium text-white/50 mb-3">Productos</h3>
          <div className="space-y-3">
            {items.map((item: any) => {
              const v = item.variant;
              const img = v?.images?.[0]?.thumbnailUrl || v?.images?.[0]?.url;
              const fp = v?.fragranceProfile;
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex gap-3">
                    {img ? (
                      <img src={img} alt={v?.name} className="h-16 w-16 rounded-xl object-cover bg-white/5 flex-shrink-0" />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-glass-50 flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-white/20" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{v?.name}</p>
                      {v?.attributes && Object.keys(v.attributes).length > 0 && <p className="text-xs text-white/40">{Object.values(v.attributes).join(' · ')}</p>}
                      <p className="text-sm font-bold text-accent-gold mt-1">{formatCurrency(parseFloat(v?.price || '0'))}</p>
                      {fp && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {fp.familiaOlfativa && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-accent-gold/15 text-accent-gold">
                              {fp.familiaOlfativa}
                            </span>
                          )}
                          {fp.intensidad && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/[0.06] text-white/50 border border-white/10">
                              🔥 {fp.intensidad}
                            </span>
                          )}
                          {fp.duracionEstimada && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/[0.06] text-white/50 border border-white/10">
                              ⏱ {fp.duracionEstimada}
                            </span>
                          )}
                          {fp.genero && (
                            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/[0.06] text-white/40 border border-white/10">
                              {fp.genero}
                            </span>
                          )}
                        </div>
                      )}
                      {fp?.contextoIdeal && (
                        <p className="text-[10px] text-white/35 mt-1.5">🎯 {fp.contextoIdeal}</p>
                      )}
                    </div>
                  </div>
                  {item.sellerNote && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-glass-50 p-2.5">
                      <MessageSquare className="h-3.5 w-3.5 text-accent-gold flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-white/60">{item.sellerNote}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delete modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Propuesta">
        <p className="text-sm text-white/60 mb-4">¿Estás seguro? Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            disabled={deleteProposal.isPending}
            className="flex-1 !bg-red-600"
          >
            {deleteProposal.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
