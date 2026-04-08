'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ProductLink {
  id: string;
  code: string;
  seller: {
    name: string;
    phone: string | null;
    phoneCode: string | null;
  };
  variant: {
    id: string;
    name: string;
    price: string;
    stock: number;
    categoryName: string | null;
    attributes: Record<string, string>;
    images: Array<{ url: string; thumbnailUrl?: string; isPrimary: boolean }>;
    fragranceProfile?: {
      familiaOlfativa?: string;
      intensidad?: string;
      duracionEstimada?: string;
      contextoIdeal?: string;
      descripcionDetallada?: string;
      genero?: string;
      frasePositionamiento?: string;
    } | null;
  };
}

export default function BuyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [link, setLink] = useState<ProductLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Form state
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/seller-product-links/public/${params.code}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        const data = d.data || d;
        if (data.variant) setLink(data);
        else setError('Producto no disponible');
      })
      .catch(() => setError('Link no encontrado'))
      .finally(() => setLoading(false));
  }, [params.code]);

  const formatPrice = (price: string | number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      typeof price === 'string' ? parseFloat(price) : price
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`${API_URL}/seller-product-links/public/${params.code}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          quantity,
          street,
          city,
          state: state || undefined,
          detail: detail || undefined,
          addressPhone: phone,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Error al procesar la compra');
      }

      const data = await res.json();
      const result = data.data || data;

      // Redirect to payment page
      if (result.orderId) {
        router.push(`/pay/${result.orderId}`);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src="/icons/logo-final.svg" alt="D Perfume House" className="w-16 h-16 mx-auto animate-pulse" />
          <p className="text-[#d3a86f]/60 text-lg">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-white/70 text-lg">{error || 'Producto no disponible'}</p>
        </div>
      </div>
    );
  }

  const variant = link.variant;
  const mainImage = variant.images?.[0]?.url || variant.images?.[0]?.thumbnailUrl;
  const fp = variant.fragranceProfile;
  const unitPrice = parseFloat(variant.price);
  const total = unitPrice * quantity;
  const maxQty = Math.min(variant.stock, 10);

  return (
    <div className="min-h-dvh bg-[#0c0a06]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0c0a06]/95 backdrop-blur-xl border-b border-[#d3a86f]/10 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img src="/icons/logo-final.svg" alt="D Perfume House" className="w-8 h-8" />
          <div>
            <p className="text-sm font-semibold text-white">D Perfume House</p>
            <p className="text-xs text-white/40">Vendedor: {link.seller.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Product Image */}
        {mainImage && (
          <div className="aspect-square bg-[#1a1610]">
            <img src={mainImage} alt={variant.name} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Product Info */}
        <div className="px-4 py-5 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-white">{variant.name}</h1>
            <p className="text-2xl font-bold text-[#d3a86f] mt-1">{formatPrice(variant.price)}</p>
            {variant.categoryName && (
              <p className="text-xs text-white/40 mt-1">
                {variant.categoryName.split(' / ').slice(2).join(' / ')}
              </p>
            )}
          </div>

          {/* Fragrance profile pills */}
          {fp && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {fp.familiaOlfativa && (
                  <span className="px-2.5 py-1 rounded-full bg-[#d3a86f]/10 text-[#d3a86f] text-xs font-medium border border-[#d3a86f]/20">
                    {fp.familiaOlfativa}
                  </span>
                )}
                {fp.intensidad && (
                  <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/60 text-xs font-medium border border-white/10">
                    Intensidad: {fp.intensidad}
                  </span>
                )}
                {fp.duracionEstimada && (
                  <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/60 text-xs font-medium border border-white/10">
                    {fp.duracionEstimada}
                  </span>
                )}
                {fp.genero && fp.genero !== 'unisex' && (
                  <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/60 text-xs font-medium border border-white/10">
                    {fp.genero === 'masculino' ? 'Masculino' : 'Femenino'}
                  </span>
                )}
              </div>
              {fp.descripcionDetallada && (
                <p className="text-sm text-white/50 leading-relaxed">{fp.descripcionDetallada}</p>
              )}
              {fp.frasePositionamiento && (
                <p className="text-sm text-[#d3a86f]/70 italic">&ldquo;{fp.frasePositionamiento}&rdquo;</p>
              )}
            </div>
          )}

          {variant.stock <= 0 ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
              <p className="text-red-400 font-medium">Producto agotado</p>
              <p className="text-white/40 text-sm mt-1">Este producto no está disponible en este momento.</p>
            </div>
          ) : (
            <>
              {/* Divider */}
              <div className="border-t border-white/5 pt-4">
                <h2 className="text-base font-semibold text-white mb-4">Completa tu compra</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Quantity */}
                <div>
                  <label className="text-xs font-medium text-white/50 mb-2 block">Cantidad</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-lg bg-[#1a1610] border border-[#d3a86f]/20 flex items-center justify-center text-white hover:bg-[#d3a86f]/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M5 12h14" /></svg>
                    </button>
                    <span className="text-xl font-bold text-white w-12 text-center">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                      disabled={quantity >= maxQty}
                      className="w-10 h-10 rounded-lg bg-[#1a1610] border border-[#d3a86f]/20 flex items-center justify-center text-white hover:bg-[#d3a86f]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 5v14m-7-7h14" /></svg>
                    </button>
                    <span className="text-sm text-white/30 ml-2">
                      ({variant.stock} disponibles)
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="rounded-xl bg-[#d3a86f]/5 border border-[#d3a86f]/15 p-3 flex items-center justify-between">
                  <span className="text-sm text-white/60">Total</span>
                  <span className="text-lg font-bold text-[#d3a86f]">{formatPrice(total)}</span>
                </div>

                {/* Personal Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/70">Datos personales</h3>
                  <input
                    type="text"
                    placeholder="Nombre completo *"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono *"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                  />
                  <input
                    type="email"
                    placeholder="Email (opcional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                  />
                </div>

                {/* Address */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/70">Dirección de envío</h3>
                  <input
                    type="text"
                    placeholder="Dirección *"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Ciudad *"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="Departamento"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Apartamento, oficina, piso (opcional)"
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                  />
                </div>

                {submitError && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                    <p className="text-red-400 text-sm">{submitError}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[#d3a86f] text-black font-bold text-base hover:bg-[#c49a63] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Procesando...
                    </span>
                  ) : (
                    `Comprar ${formatPrice(total)}`
                  )}
                </button>
              </form>
            </>
          )}

          {/* WhatsApp contact */}
          {link.seller.phone && (
            <a
              href={`https://wa.me/${(link.seller.phoneCode || '+57').replace('+', '')}${link.seller.phone}?text=${encodeURIComponent(`Hola, estoy interesado en ${variant.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-600/20 text-green-400 text-sm font-medium hover:bg-green-600/30 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.13.556 4.13 1.53 5.87L.06 23.694l5.95-1.56A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.63-.497-5.148-1.363l-.37-.218-3.83 1.004 1.022-3.735-.24-.38A9.715 9.715 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z" />
              </svg>
              Contactar vendedor por WhatsApp
            </a>
          )}

          {/* Footer */}
          <div className="text-center pt-4 pb-8">
            <p className="text-xs text-white/20">D Perfume House · Perfumería Artesanal Árabe</p>
          </div>
        </div>
      </div>
    </div>
  );
}
