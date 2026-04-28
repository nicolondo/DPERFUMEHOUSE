'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface FragranceProfile {
  familiaOlfativa?: string;
  intensidad?: string;
  duracionEstimada?: string;
  contextoIdeal?: string;
  descripcionDetallada?: string;
  genero?: string;
  frasePositionamiento?: string;
  notasDestacadas?: string;
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

interface Seller {
  id: string;
  name: string;
  phone?: string;
  sellerCode: string;
  avatar?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

function formatPrice(price: string | number) {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
}

function genreIcon(genero?: string) {
  if (!genero) return '✦';
  if (genero === 'masculino') return '♂';
  if (genero === 'femenino') return '♀';
  return '✦';
}

function IntensityDots({ intensidad }: { intensidad?: string }) {
  const levels: Record<string, number> = { baja: 1, media: 2, alta: 3 };
  const level = levels[intensidad || 'media'] || 2;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${i < level ? 'bg-[#d3a86f]' : 'bg-white/10'}`} />
      ))}
    </span>
  );
}

function ProductCard({ product, onAddToCart, onViewDetail }: {
  product: Product;
  onAddToCart: (p: Product) => void;
  onViewDetail: (p: Product) => void;
}) {
  const img = product.images.find(i => i.isPrimary) || product.images[0];
  const fp = product.fragranceProfile;
  const discountPct = product.compareAtPrice
    ? Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)
    : null;

  return (
    <div
      className="group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(211,168,111,0.12)' }}
      onClick={() => onViewDetail(product)}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-[#120e08]">
        {img ? (
          <img
            src={img.url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.155-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {discountPct && discountPct > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#d3a86f] text-[#0d0a05]">
              -{discountPct}%
            </span>
          )}
          {fp?.familiaOlfativa && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/50 text-[#d3a86f] backdrop-blur-sm border border-[#d3a86f]/20">
              {fp.familiaOlfativa}
            </span>
          )}
        </div>



        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0d0a05] to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-3.5 flex-1">
        <h3 className="font-semibold text-[13px] text-white leading-tight line-clamp-2">{product.name}</h3>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-[#d3a86f]">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-[11px] text-white/30 line-through">{formatPrice(product.compareAtPrice)}</span>
          )}
        </div>

        <div className="mt-auto" />

        {/* Add to cart button */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
          className="w-full py-2 rounded-xl text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)', color: '#0d0a05' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Añadir
        </button>
      </div>
    </div>
  );
}

function CartDrawer({ items, open, onClose, onUpdateQty, onRemove, sellerCode }: {
  items: CartItem[];
  open: boolean;
  onClose: () => void;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  sellerCode: string;
}) {
  const router = useRouter();
  const total = items.reduce((acc, ci) => acc + parseFloat(ci.product.price) * ci.quantity, 0);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      )}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #1a1409 0%, #120e08 100%)', borderLeft: '1px solid rgba(211,168,111,0.1)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-semibold text-white text-base">Carrito</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <svg className="w-10 h-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-white/30 text-sm">Tu carrito está vacío</p>
            </div>
          )}
          {items.map(ci => {
            const img = ci.product.images.find(i => i.isPrimary) || ci.product.images[0];
            return (
              <div key={ci.product.id} className="flex gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {img && (
                  <img src={img.thumbnailUrl || img.url} alt={ci.product.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-white line-clamp-2 leading-tight">{ci.product.name}</p>
                  <p className="text-[11px] text-[#d3a86f] font-semibold mt-0.5">{formatPrice(ci.product.price)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => onUpdateQty(ci.product.id, ci.quantity - 1)}
                      className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white/60 text-sm">−</button>
                    <span className="text-white/80 text-xs w-4 text-center">{ci.quantity}</span>
                    <button onClick={() => onUpdateQty(ci.product.id, ci.quantity + 1)}
                      disabled={ci.quantity >= ci.product.stock}
                      className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white/60 text-sm disabled:opacity-30">+</button>
                    <button onClick={() => onRemove(ci.product.id)}
                      className="ml-auto w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400 text-xs">✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <div className="px-4 py-4 border-t border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Total</span>
              <span className="text-white font-bold text-lg">{formatPrice(total)}</span>
            </div>
            <button
              onClick={() => {
                const cartParam = encodeURIComponent(JSON.stringify(items.map(ci => ({ id: ci.product.id, qty: ci.quantity }))));
                onClose();
                router.push(`/s/${sellerCode}/checkout?cart=${cartParam}`);
              }}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)', color: '#0d0a05' }}
            >
              Ir al Pago →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function StorePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params?.code || '';

  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const searchParams = useSearchParams();
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    fetch(`${API_URL}/seller-product-links/catalog/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.seller) setSeller(data.seller);
        if (data.products) {
          setProducts(data.products);
          // Cart hydration is handled by the resync effect below
        }
        setLoading(false);
      })
      .catch(() => { setError('No se pudo cargar la tienda'); setLoading(false); });
  }, [code]);

  // Keep localStorage in sync with cart state — but ONLY after hydration
  // (otherwise initial empty state wipes what product page wrote)
  useEffect(() => {
    if (!code || typeof window === 'undefined' || !cartHydrated) return;
    const items = cart.map(ci => ({ id: ci.product.id, qty: ci.quantity }));
    localStorage.setItem(`cart_${code}`, JSON.stringify(items));
  }, [cart, code, cartHydrated]);

  // Re-sync cart from localStorage when user navigates back from product detail
  // (router.back() fires popstate; pageshow covers bfcache; also check immediately)
  useEffect(() => {
    if (!products.length || !code || typeof window === 'undefined') return;

    const syncCart = (openDrawer = false) => {
      const stored = localStorage.getItem(`cart_${code}`);
      if (stored) {
        try {
          const items: Array<{ id: string; qty: number }> = JSON.parse(stored);
          const rebuilt = items
            .map(si => {
              const prod = products.find(p => p.id === si.id);
              return prod ? { product: prod, quantity: Math.min(si.qty, prod.stock) } : null;
            })
            .filter(Boolean) as CartItem[];
          setCart(rebuilt);
        } catch {}
      }
      // Mark hydrated so subsequent cart edits propagate to localStorage
      setCartHydrated(true);
      if (openDrawer) setCartOpen(true);
    };

    const checkSignal = () => {
      const signal = sessionStorage.getItem(`openCart_${code}`);
      if (signal === '1') {
        sessionStorage.removeItem(`openCart_${code}`);
        syncCart(true);
      } else {
        syncCart(false);
      }
    };

    // popstate fires on router.back() / browser back
    const onPopState = () => checkSignal();
    // pageshow fires when page is restored (incl. bfcache)
    const onPageShow = () => checkSignal();
    const onFocus = () => checkSignal();
    const onVisibility = () => { if (document.visibilityState === 'visible') checkSignal(); };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    // Check immediately — if user came from product page, signal is already set
    checkSignal();

    // Also poll briefly after mount to catch the signal set just before router.back()
    const t1 = setTimeout(checkSignal, 50);
    const t2 = setTimeout(checkSignal, 250);
    const t3 = setTimeout(checkSignal, 600);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, [products, code]);

  const families = Array.from(new Set(
    products.map(p => p.fragranceProfile?.familiaOlfativa).filter(Boolean) as string[]
  )).sort();

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      p.name.toLowerCase().includes(q) ||
      (p.fragranceProfile?.familiaOlfativa || '').toLowerCase().includes(q) ||
      (p.fragranceProfile?.frasePositionamiento || '').toLowerCase().includes(q);
    const matchFamily = !selectedFamily || p.fragranceProfile?.familiaOlfativa === selectedFamily;
    return matchSearch && matchFamily;
  });

  const handleAddToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.product.id === product.id);
      if (existing) {
        return prev.map(ci => ci.product.id === product.id
          ? { ...ci, quantity: Math.min(ci.quantity + 1, product.stock) }
          : ci
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1500);
  }, []);

  const handleUpdateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(ci => ci.product.id !== id));
    } else {
      setCart(prev => prev.map(ci => ci.product.id === id ? { ...ci, quantity: qty } : ci));
    }
  }, []);

  const handleRemove = useCallback((id: string) => {
    setCart(prev => prev.filter(ci => ci.product.id !== id));
  }, []);

  const cartCount = cart.reduce((a, ci) => a + ci.quantity, 0);
  const cartTotal = cart.reduce((a, ci) => a + parseFloat(ci.product.price) * ci.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d0a05 0%, #1a1409 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#d3a86f]/30 border-t-[#d3a86f] rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Cargando tienda…</p>
        </div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d0a05 0%, #1a1409 100%)' }}>
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="text-3xl">✦</div>
          <p className="text-white/60 text-sm">{error || 'Tienda no encontrada'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0d0a05 0%, #150f08 50%, #0d0a05 100%)' }}>

      {/* Header */}
      <div className="sticky top-0 z-30" style={{ background: 'rgba(13,10,5,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(211,168,111,0.08)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {seller.avatar ? (
              <img src={seller.avatar} alt={seller.name} className="w-8 h-8 rounded-full object-cover border border-[#d3a86f]/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#d3a86f]/10 border border-[#d3a86f]/20 flex items-center justify-center text-[#d3a86f] text-xs font-bold">
                {seller.name[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{seller.name}</p>
              <p className="text-white/30 text-[10px]">D Perfume House</p>
            </div>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-full text-[12px] font-medium transition-all duration-200"
            style={{
              background: cartCount > 0 ? 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)' : 'rgba(255,255,255,0.06)',
              color: cartCount > 0 ? '#0d0a05' : 'rgba(255,255,255,0.6)',
              border: cartCount === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none'
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && <span className="font-bold">{cartCount}</span>}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>

        {/* Hero */}
        <div className="py-8 text-center">
          <div className="inline-flex items-center gap-1.5 text-[#d3a86f]/60 text-[10px] tracking-widest uppercase font-medium mb-2">
            <span>✦</span><span>Fragancias exclusivas</span><span>✦</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Tienda de {seller.name.split(' ')[0]}</h1>
          <p className="text-white/35 text-sm">{products.length} {products.length === 1 ? 'fragancia disponible' : 'fragancias disponibles'}</p>
        </div>

        {/* Search + filters */}
        <div className="mb-5 space-y-3">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar fragancia…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-white text-sm placeholder:text-white/25 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          {families.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedFamily('')}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: !selectedFamily ? 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)' : 'rgba(255,255,255,0.05)',
                  color: !selectedFamily ? '#0d0a05' : 'rgba(255,255,255,0.5)',
                  border: selectedFamily ? '1px solid rgba(255,255,255,0.08)' : 'none'
                }}
              >
                Todos
              </button>
              {families.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFamily(f === selectedFamily ? '' : f)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    background: selectedFamily === f ? 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)' : 'rgba(255,255,255,0.05)',
                    color: selectedFamily === f ? '#0d0a05' : 'rgba(255,255,255,0.5)',
                    border: selectedFamily !== f ? '1px solid rgba(255,255,255,0.08)' : 'none'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-white/30 text-sm">Sin resultados{search ? ` para "${search}"` : ''}</p>
            <button onClick={() => { setSearch(''); setSelectedFamily(''); }} className="text-[#d3a86f] text-xs hover:underline">Limpiar filtros</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(p => (
              <div key={p.id} className="relative">
                {addedId === p.id && (
                  <div className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center pointer-events-none">
                    <div className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                      ✓ Añadido
                    </div>
                  </div>
                )}
                <ProductCard
                  product={p}
                  onAddToCart={handleAddToCart}
                  onViewDetail={p2 => router.push(`/s/${code}/${p2.id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div
          className="fixed left-0 right-0 z-20 px-4 pt-3"
          style={{
            bottom: 0,
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
            background: 'linear-gradient(to top, rgba(13,10,5,1) 55%, rgba(13,10,5,0.92) 80%, transparent 100%)',
          }}
        >
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-between px-5 shadow-xl"
              style={{ background: 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)', color: '#0d0a05' }}
            >
              <span className="w-6 h-6 rounded-full bg-black/15 flex items-center justify-center text-xs font-bold">{cartCount}</span>
              <span>Ver carrito</span>
              <span>{formatPrice(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}

      <CartDrawer
        items={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemove}
        sellerCode={code}
      />
    </div>
  );
}
