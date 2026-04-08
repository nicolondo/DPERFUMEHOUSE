'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getWhatsAppPhone } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ProposalItem {
  id: string;
  sellerNote?: string;
  sortOrder: number;
  variant: {
    id: string;
    name: string;
    price: string;
    attributes?: Record<string, string>;
    categoryName?: string;
    images: Array<{ url: string; thumbnailUrl?: string }>;
    fragranceProfile?: {
      familiaOlfativa?: string;
      subfamilia?: string;
      intensidad?: string;
      contextoIdeal?: string;
      climaIdeal?: string;
      perfilPersonalidad?: string;
      notasDestacadas?: string;
      descripcionDetallada?: string;
      duracionEstimada?: string;
      frasePositionamiento?: string;
      genero?: string;
      notasAdicionales?: string;
    };
  };
}

interface Proposal {
  id: string;
  title?: string;
  message?: string;
  viewCount: number;
  seller: { id: string; name: string; phone?: string; phoneCode?: string; sellerCode?: string };
  customer?: { id: string; name: string };
  items: ProposalItem[];
  createdAt: string;
}

export default function PublicProposalPage() {
  const params = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Track view
    fetch(`${API_URL}/proposals/public/${params.id}/view`, { method: 'POST' }).catch(() => {});

    // Fetch proposal
    fetch(`${API_URL}/proposals/public/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        const data = d.data || d;
        if (data.items) setProposal(data);
        else setError('Propuesta no disponible');
      })
      .catch(() => setError('Propuesta no encontrada'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const formatPrice = (price: string | number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      typeof price === 'string' ? parseFloat(price) : price
    );

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[#d3a86f]/20 to-[#d3a86f]/5 flex items-center justify-center border border-[#d3a86f]/20 animate-pulse">
            <svg className="w-6 h-6 text-[#d3a86f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-4 3-4 8s1.5 7 4 10c2.5-3 4-5 4-10s-2.8-8-4-8z" />
            </svg>
          </div>
          <p className="text-[#d3a86f]/60 text-lg">Cargando propuesta...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error || 'Propuesta no encontrada'}</p>
        </div>
      </div>
    );
  }

  const handleContact = () => {
    if (!proposal.seller.phone) return;
    const phoneDigits = getWhatsAppPhone(proposal.seller.phone, proposal.seller.phoneCode);
    const clientName = proposal.customer?.name?.split(' ')[0] || '';
    const msg = encodeURIComponent(
      `¡Hola ${proposal.seller.name}! ${clientName ? `Soy ${clientName}, ` : ''}vi la propuesta de perfumes que me enviaste y me encantó. ¿Cuándo podemos agendar para verlos? 😊`
    );
    window.open(`https://wa.me/${phoneDigits}?text=${msg}`, '_blank');
  };

  const items = [...proposal.items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="min-h-dvh bg-[#0c0a06] text-white font-sans">
      {/* Logo */}
      <div className="sticky top-0 z-40 pt-4 pb-2 flex justify-center bg-[#0c0a06]">
        <img src="/icons/logo-final.svg" alt="D Perfume House" className="w-36 h-auto" />
      </div>

      {/* Header */}
      <div className="px-6 pt-6 pb-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#d3a86f]/20 to-[#d3a86f]/5 flex items-center justify-center border border-[#d3a86f]/20">
          <span className="text-2xl">✨</span>
        </div>
        <h1 className="text-3xl font-light">
          {proposal.customer?.name ? (
            <>
              {proposal.customer.name.split(' ')[0]}, <span className="text-[#d3a86f] font-medium">{proposal.title || 'tu selección'}</span>
            </>
          ) : (
            <span className="text-[#d3a86f] font-medium">{proposal.title || 'Selección Especial'}</span>
          )}
        </h1>
        <p className="text-white/30 text-sm mt-2">Preparada por {proposal.seller.name}</p>
      </div>

      {/* Message */}
      {proposal.message && (
        <div className="mx-6 mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <p className="text-white/60 text-sm leading-relaxed italic">&ldquo;{proposal.message}&rdquo;</p>
        </div>
      )}

      {/* Product cards */}
      <div className="px-6 space-y-6">
        {items.map((item, idx) => {
          const v = item.variant;
          const img = v?.images?.[0]?.url || v?.images?.[0]?.thumbnailUrl;
          const fp = v?.fragranceProfile;
          const hasNotes = fp?.notasDestacadas;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="text-white/30 text-xs uppercase tracking-wider">
                  #{idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  {fp?.genero && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-white/40 border border-white/10">
                      {fp.genero}
                    </span>
                  )}
                  {fp?.familiaOlfativa && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#d3a86f]/20 text-[#d3a86f]">
                      {fp.familiaOlfativa}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="flex gap-4 items-start">
                  {img ? (
                    <img src={img} alt={v.name} className="w-20 h-20 rounded-xl object-cover bg-white/10" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-4 3-4 8s1.5 7 4 10c2.5-3 4-5 4-10s-2.8-8-4-8z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-medium text-[#e8c891]">{v.name}</h3>
                    {v.attributes && Object.keys(v.attributes).length > 0 && <p className="text-white/30 text-xs mt-0.5">{Object.values(v.attributes).join(' · ')}</p>}
                    <p className="text-white/40 text-sm mt-1">{formatPrice(v.price)}</p>
                  </div>
                </div>

                {/* Frase de posicionamiento */}
                {fp?.frasePositionamiento && (
                  <p className="text-[#d3a86f]/70 text-sm italic mt-3 border-l-2 border-[#d3a86f]/30 pl-3">
                    &ldquo;{fp.frasePositionamiento}&rdquo;
                  </p>
                )}

                {/* Key info pills */}
                {(fp?.intensidad || fp?.duracionEstimada) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {fp?.intensidad && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white/[0.06] border border-white/10 text-white/50">
                        <span>🔥</span> {fp.intensidad}
                      </span>
                    )}
                    {fp?.duracionEstimada && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white/[0.06] border border-white/10 text-white/50">
                        <span>⏱</span> {fp.duracionEstimada}
                      </span>
                    )}
                  </div>
                )}

                {/* Descripcion */}
                {fp?.descripcionDetallada && (
                  <p className="text-white/35 text-xs mt-3 leading-relaxed">{fp.descripcionDetallada}</p>
                )}

                {/* Context tags */}
                {(fp?.contextoIdeal || fp?.climaIdeal || fp?.perfilPersonalidad) && (
                  <div className="mt-3 space-y-2">
                    {fp?.contextoIdeal && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs mt-0.5">🎯</span>
                        <p className="text-xs text-white/40"><span className="text-white/55 font-medium">Ideal para:</span> {fp.contextoIdeal}</p>
                      </div>
                    )}
                    {fp?.climaIdeal && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs mt-0.5">🌤</span>
                        <p className="text-xs text-white/40"><span className="text-white/55 font-medium">Clima:</span> {fp.climaIdeal}</p>
                      </div>
                    )}
                    {fp?.perfilPersonalidad && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs mt-0.5">💫</span>
                        <p className="text-xs text-white/40"><span className="text-white/55 font-medium">Personalidad:</span> {fp.perfilPersonalidad}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Seller note */}
                {item.sellerNote && (
                  <div className="mt-4 p-3 rounded-xl bg-[#d3a86f]/10 border border-[#d3a86f]/20">
                    <p className="text-sm text-[#d3a86f]/80 flex items-start gap-2">
                      <span className="text-base">💭</span>
                      <span className="italic">{item.sellerNote}</span>
                    </p>
                  </div>
                )}

                {/* Fragrance notes */}
                {hasNotes && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleNotes(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/[0.06] border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all active:scale-95"
                    >
                      <span>🌿</span>
                      <span>{expandedNotes.has(item.id) ? 'Ocultar notas' : 'Notas olfativas'}</span>
                    </button>
                    {expandedNotes.has(item.id) && (
                      <div className="mt-2 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                        <p className="text-xs text-white/50 leading-relaxed">{fp?.notasDestacadas}</p>
                        {fp?.notasAdicionales && (
                          <p className="text-xs text-white/30 mt-2 leading-relaxed">{fp.notasAdicionales}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="px-6 py-10 space-y-4">
        <p className="text-center text-white/20 text-xs">Pedí tu muestra y probá antes de comprar 🌿</p>
      </div>

      {/* Footer */}
      <div className="text-center pb-28">
        <p className="text-white/15 text-xs">&copy; {new Date().getFullYear()} D Perfume House &middot; Perfumería Artesanal Árabe</p>
      </div>

      {/* Floating WhatsApp button */}
      {proposal.seller.phone && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#0c0a06] via-[#0c0a06]/95 to-transparent">
          <button
            onClick={handleContact}
            className="w-full max-w-lg mx-auto py-4 rounded-full bg-[#25D366] text-white font-semibold text-lg flex items-center justify-center gap-2 hover:bg-[#20BD5A] transition-all active:scale-95 shadow-lg shadow-[#25D366]/20"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contactar a {proposal.seller.name}
          </button>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; background: #0c0a06; }
      `}</style>
    </div>
  );
}
