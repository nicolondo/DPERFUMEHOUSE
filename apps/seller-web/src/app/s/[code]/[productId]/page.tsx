'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface FragranceProfile {
  familiaOlfativa?: string;
  subfamilia?: string;
  intensidad?: string;
  duracionEstimada?: string;
  contextoIdeal?: string;
  climaIdeal?: string;
  descripcionDetallada?: string;
  genero?: string;
  frasePositionamiento?: string;
  notasDestacadas?: string;
  equivalencia?: string;
  perfilPersonalidad?: string;
}

interface ProductImage {
  url: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
  sortOrder: number;
}

interface Product {
  id: string;
  name: string;
  price: string;
  compareAtPrice?: string;
  stock: number;
  categoryName?: string;
  attributes: Record<string, string>;
  images: ProductImage[];
  fragranceProfile?: FragranceProfile | null;
}

function formatPrice(price: string | number) {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
}

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] text-white/35 uppercase tracking-wider">{label}</span>
      <span className="text-[12px] font-medium text-white/80">{value}</span>
    </div>
  );
}

function IntensityBar({ intensidad }: { intensidad?: string }) {
  const levels: Record<string, number> = { baja: 1, media: 2, alta: 3 };
  const level = levels[intensidad || 'media'] || 2;
  const labels = ['', 'Ligera', 'Moderada', 'Intensa'];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{ width: i < level ? '24px' : '12px', background: i < level ? '#d3a86f' : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
      <span className="text-[11px] text-white/50">{labels[level]}</span>
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams<{ code: string; productId: string }>();
  const router = useRouter();
  const code = params?.code || '';
  const productId = params?.productId || '';

  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<{ name: string; sellerCode: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Scroll to top on mount so the user lands at the start of the product page
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [productId]);

  useEffect(() => {
    if (!code) return;
    fetch(`${API_URL}/seller-product-links/catalog/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.seller) setSeller(data.seller);
        if (data.products) {
          const found = data.products.find((p: Product) => p.id === productId);
          if (found) setProduct(found);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [code, productId]);

  const handleAddToCart = () => {
    if (!product) return;
    const stored = localStorage.getItem(`cart_${code}`);
    const existingCart = stored ? JSON.parse(stored) : [];
    const existing = existingCart.find((i: any) => i.id === product.id);
    if (existing) {
      existing.qty = Math.min(existing.qty + quantity, product.stock);
    } else {
      existingCart.push({ id: product.id, qty: quantity });
    }
    localStorage.setItem(`cart_${code}`, JSON.stringify(existingCart));
    // Signal to catalog page to open cart drawer on return
    sessionStorage.setItem(`openCart_${code}`, '1');
    setAdded(true);
    setTimeout(() => {
      // Use history.back() — fires popstate reliably in App Router
      window.history.back();
    }, 600);
  };

  const handleBuyNow = () => {
    if (!product) return;
    const cartParam = encodeURIComponent(JSON.stringify([{ id: product.id, qty: quantity }]));
    router.push(`/s/${code}/checkout?cart=${cartParam}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0a05' }}>
        <div className="w-8 h-8 border-2 border-[#d3a86f]/30 border-t-[#d3a86f] rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: '#0d0a05' }}>
        <p className="text-white/40 text-sm">Producto no encontrado</p>
        <button onClick={() => router.push(`/s/${code}`)} className="text-[#d3a86f] text-sm">← Volver a la tienda</button>
      </div>
    );
  }

  const fp = product.fragranceProfile;
  const sortedImages = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const discountPct = product.compareAtPrice
    ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)
    : null;

  // Parse olfactory notes
  let notes: { salida?: string; corazon?: string; fondo?: string } = {};
  if (fp?.notasDestacadas) {
    const parts = fp.notasDestacadas.split(/[|\/,]/).map(s => s.trim());
    if (parts.length >= 1) notes.salida = parts[0];
    if (parts.length >= 2) notes.corazon = parts[1];
    if (parts.length >= 3) notes.fondo = parts[2];
  }

  return (
    <div className="min-h-screen pb-32" style={{ background: 'linear-gradient(180deg, #0d0a05 0%, #150f08 100%)' }}>

      {/* Header */}
      <div className="sticky top-0 z-30" style={{ background: 'rgba(13,10,5,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(211,168,111,0.08)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/s/${code}`)}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-sm truncate">{product.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">

        {/* Image gallery */}
        <div className="mt-4">
          {/* Main image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#120e08]" style={{ border: '1px solid rgba(211,168,111,0.1)' }}>
            {sortedImages.length > 0 ? (
              <img
                src={sortedImages[selectedImg]?.url || sortedImages[0].url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-16 h-16 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}

            {discountPct && discountPct > 0 && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-[#d3a86f] text-[#0d0a05]">
                -{discountPct}%
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {sortedImages.length > 1 && (
            <div className="flex gap-2 mt-3">
              {sortedImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all"
                  style={{ border: `2px solid ${i === selectedImg ? '#d3a86f' : 'rgba(255,255,255,0.08)'}` }}
                >
                  <img src={img.thumbnailUrl || img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="mt-5">
          {fp?.familiaOlfativa && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium mb-2" style={{ background: 'rgba(211,168,111,0.1)', color: '#d3a86f', border: '1px solid rgba(211,168,111,0.2)' }}>
              {fp.familiaOlfativa}
            </span>
          )}
          <h1 className="text-2xl font-bold text-white leading-tight">{product.name}</h1>

          {fp?.frasePositionamiento && (
            <p className="text-white/45 text-sm mt-1.5 italic">"{fp.frasePositionamiento}"</p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mt-3">
            <span className="text-3xl font-bold text-[#d3a86f]">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-white/30 line-through text-sm">{formatPrice(product.compareAtPrice)}</span>
            )}
          </div>
        </div>

        {/* Intensity + context quick facts */}
        {fp && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {fp.intensidad && (
              <div className="col-span-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">Intensidad</p>
                <IntensityBar intensidad={fp.intensidad} />
              </div>
            )}

            {fp.contextoIdeal && <InfoChip icon="🕰" label="Ocasión" value={fp.contextoIdeal} />}
            {fp.climaIdeal && <InfoChip icon="🌤" label="Clima" value={fp.climaIdeal} />}

          </div>
        )}

        {/* Olfactory pyramid */}
        {(notes.salida || notes.corazon || notes.fondo) && (
          <div className="mt-5 p-4 rounded-2xl" style={{ background: 'linear-gradient(145deg, rgba(211,168,111,0.06) 0%, rgba(211,168,111,0.02) 100%)', border: '1px solid rgba(211,168,111,0.12)' }}>
            <p className="text-[11px] text-[#d3a86f]/60 uppercase tracking-widest font-medium mb-4">Pirámide Olfativa</p>
            <div className="space-y-3">
              {[
                { label: 'Notas de Salida', value: notes.salida, icon: '◇', desc: 'Primer impacto' },
                { label: 'Notas de Corazón', value: notes.corazon, icon: '◈', desc: 'La esencia' },
                { label: 'Notas de Fondo', value: notes.fondo, icon: '◆', desc: 'El recuerdo' },
              ].filter(n => n.value).map((n) => (
                <div key={n.label} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#d3a86f]/10 border border-[#d3a86f]/20 flex items-center justify-center text-[#d3a86f] text-sm">
                    {n.icon}
                  </div>
                  <div>
                    <p className="text-[11px] text-white/40 leading-none">{n.label}</p>
                    <p className="text-white/80 text-[13px] font-medium mt-0.5">{n.value}</p>
                    <p className="text-[10px] text-white/25">{n.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {fp?.descripcionDetallada && (
          <div className="mt-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">Descripción</p>
            <p className="text-white/65 text-sm leading-relaxed">{fp.descripcionDetallada}</p>
          </div>
        )}



        {/* Attributes */}
        {Object.keys(product.attributes || {}).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(product.attributes).map(([k, v]) => (
              <div key={k} className="px-3 py-1.5 rounded-lg text-[11px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="text-white/35">{k}: </span>
                <span className="text-white/70 font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stock */}
        {product.stock <= 5 && product.stock > 0 && (
          <div className="mt-4 flex items-center gap-2 text-amber-400 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>Solo {product.stock} en stock</span>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-4" style={{ background: 'linear-gradient(to top, rgba(13,10,5,1) 0%, rgba(13,10,5,0.9) 70%, transparent 100%)' }}>
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Quantity selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                −
              </button>
              <span className="text-white font-semibold w-6 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                disabled={quantity >= product.stock}
                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-30"
              >
                +
              </button>
            </div>
            <span className="text-[#d3a86f] font-bold text-lg">{formatPrice(parseFloat(product.price) * quantity)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleAddToCart}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{ background: added ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)', color: added ? '#4ade80' : 'rgba(255,255,255,0.8)', border: `1px solid ${added ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}` }}
            >
              {added ? '✓ Añadido' : '+ Carrito'}
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)', color: '#0d0a05' }}
            >
              Comprar ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
