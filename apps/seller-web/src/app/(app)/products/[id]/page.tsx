'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { useProduct } from '@/hooks/use-products';
import { formatCurrency } from '@/lib/utils';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(params.id as string);

  if (isLoading) return <PageSpinner />;
  if (!product) return null;

  const fp = (product as any).fragranceProfile;
  const img = product.images?.[0]?.url || product.images?.[0]?.thumbnailUrl;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-xl border-b border-glass-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1">
          <ArrowLeft className="h-5 w-5 text-white/60" />
        </button>
        <h1 className="text-base font-semibold text-white truncate flex-1">{product.name}</h1>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Product image + basic info */}
        <Card className="overflow-hidden p-0">
          {img ? (
            <img src={img} alt={product.name} className="w-full aspect-square object-cover" />
          ) : (
            <div className="w-full aspect-square bg-glass-50 flex items-center justify-center">
              <Package className="h-16 w-16 text-white/10" />
            </div>
          )}
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white">{product.name}</h2>
            {product.attributes && Object.keys(product.attributes).length > 0 && (
              <p className="text-xs text-white/40 mt-0.5">{Object.values(product.attributes as Record<string, string>).join(' · ')}</p>
            )}
            <p className="text-xl font-bold text-accent-gold mt-2">{formatCurrency(parseFloat(product.price || '0'))}</p>
          </div>
        </Card>

        {fp ? (
          <>
            {/* Familia + género */}
            {(fp.familiaOlfativa || fp.genero || fp.subfamilia) && (
              <Card className="p-4">
                <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Familia Olfativa</h3>
                <div className="flex flex-wrap gap-2">
                  {fp.familiaOlfativa && (
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-accent-gold/15 text-accent-gold border border-accent-gold/20">
                      {fp.familiaOlfativa}
                    </span>
                  )}
                  {fp.subfamilia && (
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/[0.06] text-white/60 border border-white/10">
                      {fp.subfamilia}
                    </span>
                  )}
                  {fp.genero && (
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/[0.06] text-white/50 border border-white/10">
                      {fp.genero}
                    </span>
                  )}
                </div>
              </Card>
            )}

            {/* Frase de posicionamiento */}
            {fp.frasePositionamiento && (
              <Card className="p-4">
                <p className="text-sm text-accent-gold/80 italic leading-relaxed border-l-2 border-accent-gold/30 pl-3">
                  &ldquo;{fp.frasePositionamiento}&rdquo;
                </p>
              </Card>
            )}

            {/* Notas olfativas */}
            {fp.notasDestacadas && (
              <Card className="p-4">
                <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">🌿 Notas Olfativas</h3>
                <p className="text-sm text-white/70 leading-relaxed">{fp.notasDestacadas}</p>
                {fp.notasAdicionales && (
                  <p className="text-sm text-white/40 mt-2 leading-relaxed">{fp.notasAdicionales}</p>
                )}
              </Card>
            )}

            {/* Descripción */}
            {fp.descripcionDetallada && (
              <Card className="p-4">
                <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Descripción</h3>
                <p className="text-sm text-white/60 leading-relaxed">{fp.descripcionDetallada}</p>
              </Card>
            )}

            {/* Características */}
            {(fp.intensidad || fp.duracionEstimada) && (
              <Card className="p-4">
                <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Características</h3>
                <div className="flex flex-wrap gap-3">
                  {fp.intensidad && (
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔥</span>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Intensidad</p>
                        <p className="text-sm text-white/70">{fp.intensidad}</p>
                      </div>
                    </div>
                  )}
                  {fp.duracionEstimada && (
                    <div className="flex items-center gap-2">
                      <span className="text-base">⏱</span>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Duración</p>
                        <p className="text-sm text-white/70">{fp.duracionEstimada}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Contexto & clima */}
            {(fp.contextoIdeal || fp.climaIdeal || fp.perfilPersonalidad) && (
              <Card className="p-4">
                <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">Uso Ideal</h3>
                <div className="space-y-2.5">
                  {fp.contextoIdeal && (
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">🎯</span>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Contexto</p>
                        <p className="text-sm text-white/60">{fp.contextoIdeal}</p>
                      </div>
                    </div>
                  )}
                  {fp.climaIdeal && (
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">🌤</span>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Clima</p>
                        <p className="text-sm text-white/60">{fp.climaIdeal}</p>
                      </div>
                    </div>
                  )}
                  {fp.perfilPersonalidad && (
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">💫</span>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Personalidad</p>
                        <p className="text-sm text-white/60">{fp.perfilPersonalidad}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-white/30 text-sm">Sin perfil olfativo disponible</p>
          </Card>
        )}
      </div>
    </div>
  );
}
