'use client';

import { useState, useMemo } from 'react';
import {
  Search, Link2, Copy, Check, ExternalLink, Eye, ShoppingCart, Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useProducts, useCategories } from '@/hooks/use-products';
import { formatCurrency } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';

function useSellerProductLinks() {
  return useQuery({
    queryKey: ['seller-product-links'],
    queryFn: async () => {
      const { data } = await api.get('/seller-product-links');
      return unwrap(data);
    },
  });
}

function useGenerateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variantId: string) => {
      const { data } = await api.post('/seller-product-links', { variantId });
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-product-links'] });
    },
  });
}

function useDeactivateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/seller-product-links/${id}`);
      return unwrap(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-product-links'] });
    },
  });
}

export default function ProductLinksPage() {
  const [tab, setTab] = useState<'links' | 'generate'>('links');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedGenerateId, setCopiedGenerateId] = useState<string | null>(null);

  const { data: linksData, isLoading: linksLoading } = useSellerProductLinks();
  const { data: productsData, isLoading: productsLoading } = useProducts({
    search: productSearch || undefined,
    categoryId: selectedCategory,
    limit: 50,
  });
  const { data: categoriesData } = useCategories();
  const generateLink = useGenerateLink();
  const deactivateLink = useDeactivateLink();

  const links: any[] = Array.isArray(linksData) ? linksData : [];
  const products = Array.isArray(productsData) ? productsData : productsData?.data ?? [];
  const linkVariantIds = useMemo(() => new Set(links.map((l: any) => l.variantId)), [links]);

  const categories: { id: string; name: string }[] = (Array.isArray(categoriesData) ? categoriesData : [])
    .filter((c: string) => c.includes('Ventas') && c.split(' / ').length >= 3)
    .map((c: string) => {
      const parts = c.split(' / ');
      return { id: c, name: parts[2] || c };
    })
    .filter((c: any, i: number, arr: any[]) => arr.findIndex((x) => x.name === c.name) === i);

  const copyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const shareWhatsApp = (url: string, productName: string) => {
    const text = `¡Hola! Te comparto este perfume: *${productName}*\n\nCompralo aquí: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleGenerate = async (variantId: string) => {
    try {
      await generateLink.mutateAsync(variantId);
    } catch {
      // handled by react-query
    }
  };

  const copyLinkInline = async (url: string, variantId: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopiedGenerateId(variantId);
    setTimeout(() => setCopiedGenerateId(null), 2000);
  };

  const getProductImage = (product: any) => {
    return product.images?.[0]?.thumbnailUrl || product.images?.[0]?.url || null;
  };

  return (
    <div className="pb-24">
      <PageHeader title="Links de Venta" />

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 p-1 rounded-xl bg-glass-100">
          <button
            onClick={() => setTab('links')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === 'links'
                ? 'bg-accent-gold text-black shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Mis Links ({links.length})
          </button>
          <button
            onClick={() => setTab('generate')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === 'generate'
                ? 'bg-accent-gold text-black shadow-sm'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Generar Link
          </button>
        </div>
      </div>

      {/* Tab: My Links */}
      {tab === 'links' && (
        <div className="px-4 space-y-3">
          {linksLoading ? (
            <PageSpinner />
          ) : links.length === 0 ? (
            <EmptyState
              icon={<Link2 className="h-10 w-10 text-white/30" />}
              title="Sin links activos"
              description="Genera tu primer link de venta desde la pestaña 'Generar Link'"
            />
          ) : (
            links.map((link: any) => {
              const img = getProductImage(link.variant);
              return (
                <Card key={link.id} className="p-3">
                  <div className="flex gap-3">
                    {/* Product image */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-glass-100 flex-shrink-0">
                      {img ? (
                        <img src={img} alt={link.variant.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                          {link.variant.name?.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{link.variant.name}</p>
                      <p className="text-sm text-accent-gold font-semibold">{formatCurrency(link.variant.price)}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {link.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" /> {link.conversions}
                        </span>
                        {link.variant.stock <= 0 && (
                          <span className="text-red-400">Sin stock</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-glass-border">
                    <button
                      onClick={() => copyLink(link.url, link.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-glass-100 text-xs text-white/70 hover:text-white hover:bg-glass-200 transition-colors flex-1 justify-center"
                    >
                      {copiedId === link.id ? (
                        <><Check className="h-3.5 w-3.5 text-green-400" /> Copiado</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5" /> Copiar</>
                      )}
                    </button>
                    <button
                      onClick={() => shareWhatsApp(link.url, link.variant.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 text-xs text-green-400 hover:bg-green-600/30 transition-colors flex-1 justify-center"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.13.556 4.13 1.53 5.87L.06 23.694l5.95-1.56A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.63-.497-5.148-1.363l-.37-.218-3.83 1.004 1.022-3.735-.24-.38A9.715 9.715 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z" />
                      </svg>
                      WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('¿Desactivar este link?')) {
                          deactivateLink.mutate(link.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Generate Link */}
      {tab === 'generate' && (
        <div className="px-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              placeholder="Buscar producto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategory(undefined)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  !selectedCategory
                    ? 'bg-accent-gold text-black'
                    : 'bg-glass-100 text-white/50 hover:text-white/70'
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-accent-gold text-black'
                      : 'bg-glass-100 text-white/50 hover:text-white/70'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Products grid */}
          {productsLoading ? (
            <PageSpinner />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Search className="h-10 w-10 text-white/30" />}
              title="Sin resultados"
              description="Intenta con otro término de búsqueda"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product: any) => {
                const img = getProductImage(product);
                const hasLink = linkVariantIds.has(product.id);
                const isOutOfStock = product.stock <= 0;

                return (
                  <Card
                    key={product.id}
                    className={`overflow-hidden ${hasLink ? 'ring-1 ring-accent-gold/50' : ''}`}
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-glass-100">
                      {img ? (
                        <img src={img} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-2xl font-bold">
                          {product.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      {hasLink && (
                        <div className="absolute top-2 right-2 bg-accent-gold rounded-full p-1">
                          <Check className="h-3 w-3 text-black" />
                        </div>
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-xs font-medium text-white/70 bg-black/70 px-2 py-1 rounded">
                            Sin stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info + Button */}
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-white truncate">{product.name}</p>
                      <p className="text-xs text-accent-gold font-semibold mt-0.5">
                        {formatCurrency(product.price)}
                      </p>

                      <div className="flex items-center gap-1 mt-2">
                        <button
                          onClick={() => !isOutOfStock && !hasLink && handleGenerate(product.id)}
                          disabled={isOutOfStock || hasLink || generateLink.isPending && generateLink.variables === product.id}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            hasLink
                              ? 'bg-accent-gold/20 text-accent-gold cursor-default'
                              : isOutOfStock
                              ? 'bg-glass-100 text-white/20 cursor-not-allowed'
                              : generateLink.isPending
                              ? 'bg-accent-gold/60 text-black cursor-wait'
                              : 'bg-accent-gold text-black hover:bg-accent-gold/90'
                          }`}
                        >
                          {generateLink.isPending && generateLink.variables === product.id ? (
                            <><div className="h-3 w-3 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Generando...</>
                          ) : hasLink ? (
                            <><Link2 className="h-3.5 w-3.5" /> Link creado</>
                          ) : (
                            <><Link2 className="h-3.5 w-3.5" /> Generar Link</>
                          )}
                        </button>

                        {hasLink && (() => {
                          const linkUrl = links.find((l: any) => l.variantId === product.id)?.url;
                          return linkUrl ? (
                            <button
                              onClick={() => copyLinkInline(linkUrl, product.id)}
                              className="flex-shrink-0 p-1.5 rounded-lg bg-glass-100 text-white/50 hover:text-white hover:bg-glass-200 transition-colors"
                              title="Copiar link"
                            >
                              {copiedGenerateId === product.id
                                ? <Check className="h-3.5 w-3.5 text-green-400" />
                                : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          ) : null;
                        })()}
                      </div>

                      {generateLink.isError && generateLink.variables === product.id && (
                        <p className="text-xs text-red-400 mt-1 text-center">
                          {(generateLink.error as any)?.response?.data?.message || 'Error al generar link'}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
