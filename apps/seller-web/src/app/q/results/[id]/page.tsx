'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Recommendation {
  productVariantId: string;
  name: string;
  compatibility: number;
  mainArgument: string;
  presentationOrder: number;
  product?: {
    id: string;
    name: string;
    price: number;
    images: Array<{ url: string; thumbnailUrl?: string }>;
  };
}

interface Results {
  id: string;
  clientName?: string;
  clientProfile: any;
  recommendations: Recommendation[];
  isForGift: boolean;
  giftRecipient?: string;
  seller: { name: string; phone?: string };
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/leads/results/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        const data = d.data || d;
        if (data.recommendations) setResults(data);
        else setError('Resultados no disponibles');
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-pulse">🌿</div>
          <p className="text-amber-400/60 text-lg">Preparando tus resultados...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error || 'Resultados no encontrados'}</p>
        </div>
      </div>
    );
  }

  const sortedRecs = [...results.recommendations].sort(
    (a, b) => a.presentationOrder - b.presentationOrder,
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const openWhatsApp = () => {
    if (!results.seller.phone) return;
    const phone = results.seller.phone.replace(/\D/g, '');
    const name = results.clientName?.split(' ')[0] || '';
    const msg = encodeURIComponent(
      `¡Hola ${results.seller.name}! Soy ${name}, acabo de completar el cuestionario de fragancias y me encantaron las recomendaciones. ¿Cuándo podríamos agendar para que me muestres las muestras? 😊`,
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="text-4xl mb-4">✨</div>
        <h1 className="text-3xl font-light">
          {results.clientName ? (
            <>
              {results.clientName.split(' ')[0]}, estas son{' '}
              <span className="text-amber-400 font-medium">tus fragancias</span>
            </>
          ) : (
            <>
              Tus <span className="text-amber-400 font-medium">fragancias ideales</span>
            </>
          )}
        </h1>
        {results.isForGift && results.giftRecipient && (
          <p className="text-white/40 mt-2">🎁 Para: {results.giftRecipient}</p>
        )}
      </div>

      {/* Profile summary */}
      {results.clientProfile?.summary && (
        <div className="mx-6 mb-8 p-5 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-white/60 text-sm leading-relaxed">{results.clientProfile.summary}</p>
        </div>
      )}

      {/* Recommendations */}
      <div className="px-6 space-y-6">
        {sortedRecs.map((rec, idx) => {
          const imageUrl = rec.product?.images?.[0]?.url || rec.product?.images?.[0]?.thumbnailUrl;
          return (
            <div
              key={rec.productVariantId || idx}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] overflow-hidden"
            >
              {/* Compatibility badge */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="text-white/30 text-xs uppercase tracking-wider">
                  #{idx + 1} Recomendación
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    rec.compatibility >= 85
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : rec.compatibility >= 70
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/10 text-white/60'
                  }`}
                >
                  {rec.compatibility}% compatible
                </span>
              </div>

              <div className="px-5 pb-5">
                <div className="flex gap-4 items-start">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={rec.name}
                      className="w-20 h-20 rounded-xl object-cover bg-white/10"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-medium text-amber-300">{rec.name}</h3>
                    {rec.product?.price && (
                      <p className="text-white/40 text-sm mt-1">{formatPrice(rec.product.price)}</p>
                    )}
                  </div>
                </div>

                <p className="text-white/50 text-sm mt-4 leading-relaxed">{rec.mainArgument}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="px-6 py-10 space-y-4">
        {results.seller.phone && (
          <button
            onClick={openWhatsApp}
            className="w-full py-4 rounded-full bg-[#25D366] text-white font-semibold text-lg flex items-center justify-center gap-2 hover:bg-[#20BD5A] transition-all active:scale-95"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Escribir a {results.seller.name}
          </button>
        )}

        <p className="text-center text-white/20 text-xs">
          Pide tu muestra y prueba antes de comprar 🌿
        </p>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-white/15 text-xs">
          © {new Date().getFullYear()} D Perfume House · Perfumería Artesanal Árabe
        </p>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  );
}
