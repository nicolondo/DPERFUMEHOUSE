'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

declare global {
  interface Window { WidgetCheckout: any; }
}

// ──────────────────────────────────────────────
// Country phone codes
// ──────────────────────────────────────────────
const PHONE_CODES = [
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+1', country: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+34', country: 'España', flag: '🇪🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+507', country: 'Panamá', flag: '🇵🇦' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
  { code: '+53', country: 'Cuba', flag: '🇨🇺' },
  { code: '+44', country: 'Reino Unido', flag: '🇬🇧' },
  { code: '+33', country: 'Francia', flag: '🇫🇷' },
  { code: '+49', country: 'Alemania', flag: '🇩🇪' },
  { code: '+39', country: 'Italia', flag: '🇮🇹' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+81', country: 'Japón', flag: '🇯🇵' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+7', country: 'Rusia', flag: '🇷🇺' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+64', country: 'Nueva Zelanda', flag: '🇳🇿' },
];

// ID document types (Wompi Colombia)
const ID_TYPES = [
  { value: 'CC', label: 'CC · Cédula de Ciudadanía' },
  { value: 'CE', label: 'CE · Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'TI', label: 'TI · Tarjeta de Identidad' },
  { value: 'PP', label: 'PP · Pasaporte' },
];

type PhoneCode = typeof PHONE_CODES[0];

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

// ──────────────────────────────────────────────
// Load Google Maps script once
// ──────────────────────────────────────────────
function useGoogleMaps() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !MAPS_KEY) return;
    if ((window as any).google?.maps?.places) { setReady(true); return; }
    const existing = document.getElementById('gm-script');
    if (existing) {
      existing.addEventListener('load', () => setReady(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gm-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&language=es&region=CO`;
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

// ──────────────────────────────────────────────
// Phone country code dropdown with search
// ──────────────────────────────────────────────
function PhoneCodeDropdown({ value, onChange }: { value: PhoneCode; onChange: (c: PhoneCode) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = PHONE_CODES.filter(
    (c) =>
      c.country.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search),
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-full px-3 py-2.5 rounded-l-xl bg-[#1a1610] border border-r-0 border-[#d3a86f]/15 text-sm hover:bg-[#d3a86f]/10 transition-colors"
      >
        <span className="text-base leading-none">{value.flag}</span>
        <span className="text-white/60 font-mono text-xs">{value.code}</span>
        <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded-xl bg-[#1a1610] border border-[#d3a86f]/20 shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <input
              type="text"
              placeholder="Buscar país..."
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 text-white text-sm placeholder:text-white/25 focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-white/30 text-sm text-center">Sin resultados</p>
            )}
            {filtered.map((c) => (
              <button
                key={`${c.code}-${c.country}`}
                type="button"
                onClick={() => { onChange(c); setOpen(false); setSearch(''); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#d3a86f]/10 transition-colors ${
                  value.code === c.code && value.country === c.country
                    ? 'bg-[#d3a86f]/10 text-[#d3a86f]'
                    : 'text-white/70'
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate text-left">{c.country}</span>
                <span className="text-white/40 text-xs font-mono">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────
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
  const [phoneCode, setPhoneCode] = useState<PhoneCode>(PHONE_CODES[0]); // Colombia default
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idType, setIdType] = useState('CC');
  const [idNumber, setIdNumber] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [detail, setDetail] = useState('');

  // Wompi widget
  const [wompiLoaded, setWompiLoaded] = useState(false);

  // Google Maps
  const mapsReady = useGoogleMaps();
  const streetInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  // Load Wompi widget script on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.WidgetCheckout) { setWompiLoaded(true); return; }
    if (document.querySelector('script[src*="widget.js"]')) {
      const s = document.querySelector<HTMLScriptElement>('script[src*="widget.js"]');
      s?.addEventListener('load', () => setWompiLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => setWompiLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Google Maps autocomplete — restrict to Colombia
  useEffect(() => {
    if (!mapsReady || !streetInputRef.current || autocompleteRef.current) return;
    const ac = new (window as any).google.maps.places.Autocomplete(streetInputRef.current, {
      componentRestrictions: { country: 'co' },
      fields: ['address_components', 'formatted_address'],
      types: ['address'],
    });
    autocompleteRef.current = ac;
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place?.address_components) return;
      const get = (type: string) =>
        place.address_components.find((c: any) => c.types.includes(type))?.long_name || '';
      const streetNum = get('street_number');
      const route = get('route');
      setStreet(route ? (streetNum ? `${route} #${streetNum}` : route) : place.formatted_address || '');
      setCity(get('locality') || get('administrative_area_level_2'));
      setState(get('administrative_area_level_1'));
    });
  }, [mapsReady]);

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
      typeof price === 'string' ? parseFloat(price) : price,
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const fullPhone = `${phoneCode.code}${phone}`;

      // Step 1: Create the order
      const res = await fetch(`${API_URL}/seller-product-links/public/${params.code}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: fullPhone,
          email,
          quantity,
          street,
          city,
          state: state || undefined,
          detail: detail || undefined,
          addressPhone: fullPhone,
          legalIdType: idType,
          legalId: idNumber || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Error al procesar la compra');
      }

      const data = await res.json();
      const result = data.data || data;
      const orderId = result.orderId;
      if (!orderId) throw new Error('No se pudo crear el pedido');

      // Step 2: Fetch Wompi widget config (signature + keys from backend)
      const configRes = await fetch(`${API_URL}/payments/widget-config/${orderId}`);
      if (!configRes.ok) throw new Error('Error al preparar el pago');
      const configData = await configRes.json();
      const wConf = configData.data || configData;

      // Step 3: Open Wompi widget pre-filled with all form data
      if (!window.WidgetCheckout) throw new Error('Widget de pago no disponible. Intenta recargar la página.');

      const checkoutConfig: any = {
        currency: wConf.currency,
        amountInCents: wConf.amountInCents,
        reference: wConf.reference,
        publicKey: wConf.publicKey,
        signature: { integrity: wConf.signature },
        redirectUrl: wConf.redirectUrl,
        customerData: {
          fullName: name,
          email: email,
          phoneNumber: phone.replace(/\D/g, ''),
          phoneNumberPrefix: phoneCode.code,
          ...(idNumber ? { legalId: idNumber, legalIdType: idType } : {}),
        },
        shippingAddress: {
          addressLine1: street,
          country: 'CO',
          city: city,
          region: state || city,
          phoneNumber: phone.replace(/\D/g, ''),
          ...(detail ? { addressLine2: detail } : {}),
        },
      };

      setSubmitting(false);

      new window.WidgetCheckout(checkoutConfig).open((widgetResult: any) => {
        if (widgetResult?.transaction?.status === 'APPROVED') {
          router.push(`/pay/${orderId}?payment=done`);
        }
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Error inesperado');
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
      {/* Header — logo 300px centered, seller name below */}
      <div className="sticky top-0 z-10 bg-[#0c0a06]/95 backdrop-blur-xl border-b border-[#d3a86f]/10 px-4 py-3">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-1">
          <img
            src="/icons/logo-final.svg"
            alt="D Perfume House"
            style={{ width: '300px', height: 'auto' }}
          />
          <p className="text-xs text-white/40">Vendedor: {link.seller.name}</p>
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

                  {/* Full name */}
                  <input
                    type="text"
                    placeholder="Nombre completo *"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                  />

                  {/* Phone with country code picker */}
                  <div className="flex">
                    <PhoneCodeDropdown value={phoneCode} onChange={setPhoneCode} />
                    <input
                      type="tel"
                      placeholder="Número de teléfono *"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-r-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <input
                    type="email"
                    placeholder="Email *"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                  />

                  {/* Identification */}
                  <div className="flex gap-2">
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value)}
                      className="px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm focus:outline-none focus:border-[#d3a86f]/40 transition-colors flex-shrink-0 appearance-none"
                    >
                      {ID_TYPES.map((t) => (
                        <option key={t.value} value={t.value} style={{ background: '#1a1610' }}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Número de identificación"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d3a86f]/40 transition-colors"
                    />
                  </div>
                </div>

                {/* Address — Colombia only */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white/70">Dirección de envío</h3>
                    <span className="flex items-center gap-1 text-xs text-white/35">
                      <span>🇨🇴</span>
                      <span>Solo Colombia</span>
                    </span>
                  </div>

                  {/* Street with Google Maps Autocomplete */}
                  <input
                    ref={streetInputRef}
                    type="text"
                    placeholder="Dirección *"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    autoComplete="off"
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
                    `Pagar ${formatPrice(total)}`
                  )}
                </button>
              </form>
            </>
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

