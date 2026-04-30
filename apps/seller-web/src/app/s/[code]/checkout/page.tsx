'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  WompiAcceptance,
  PaymentMethodSelector,
  CardForm,
  NequiForm,
  BancolombiaTransferForm,
  BancolombiaCollectForm,
  DaviplataForm,
  PaymentResult,
} from '@/components/payment/payment-components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
  { code: '+507', country: 'Panamá', flag: '🇵🇦' },
  { code: '+44', country: 'Reino Unido', flag: '🇬🇧' },
  { code: '+33', country: 'Francia', flag: '🇫🇷' },
];

const ID_TYPES = [
  { value: 'CC', label: 'CC · Cédula de Ciudadanía' },
  { value: 'CE', label: 'CE · Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'TI', label: 'TI · Tarjeta de Identidad' },
  { value: 'PP', label: 'PP · Pasaporte' },
];

type PhoneCode = typeof PHONE_CODES[0];

interface CartItem { id: string; qty: number; }

interface Product {
  id: string;
  name: string;
  price: string;
  stock: number;
  images: Array<{ url: string; thumbnailUrl?: string; isPrimary: boolean }>;
}

function formatPrice(price: string | number) {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
}

function useGoogleMaps() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !MAPS_KEY) return;
    if ((window as any).google?.maps?.places) { setReady(true); return; }
    const existing = document.getElementById('gm-script');
    if (existing) { existing.addEventListener('load', () => setReady(true)); return; }
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

function PhoneCodeDropdown({ value, onChange }: { value: PhoneCode; onChange: (c: PhoneCode) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const filtered = PHONE_CODES.filter(c => c.country.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search));
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-full px-3 py-2.5 rounded-l-xl border border-r-0 text-sm hover:bg-white/5 transition-colors"
        style={{ background: '#1a1610', borderColor: 'rgba(211,168,111,0.15)' }}>
        <span className="text-base leading-none">{value.flag}</span>
        <span className="text-white/60 font-mono text-xs">{value.code}</span>
        <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded-xl border border-white/10 shadow-2xl overflow-hidden" style={{ background: '#1a1610' }}>
          <div className="p-2 border-b border-white/5">
            <input type="text" placeholder="Buscar país…" autoFocus value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(c => (
              <button key={`${c.code}-${c.country}`} type="button"
                onClick={() => { onChange(c); setOpen(false); setSearch(''); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${value.code === c.code ? 'text-[#d3a86f]' : 'text-white/70'}`}>
                <span>{c.flag}</span>
                <span className="flex-1 text-left truncate">{c.country}</span>
                <span className="text-white/40 text-xs font-mono">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function inputClass() {
  return "w-full px-4 py-2.5 rounded-xl text-white text-sm placeholder:text-white/25 focus:outline-none transition-all";
}
function inputStyle(focused?: boolean) {
  return { background: '#1a1610', border: `1px solid ${focused ? 'rgba(211,168,111,0.4)' : 'rgba(211,168,111,0.15)'}` };
}

export default function StoreCheckoutPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = params?.code || '';
  const mapsReady = useGoogleMaps();
  const streetRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  // Cart from URL
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Phase 1 form
  const [phoneCode, setPhoneCode] = useState<PhoneCode>(PHONE_CODES[0]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idType, setIdType] = useState('CC');
  const [idNumber, setIdNumber] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [detail, setDetail] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Phase 2 payment
  const [orderId, setOrderId] = useState<string | null>(null);
  const [wompiPublicKey, setWompiPublicKey] = useState('');
  const [acceptanceToken, setAcceptanceToken] = useState('');
  const [acceptPermalink, setAcceptPermalink] = useState('');
  const [accepted, setAccepted] = useState(true);
  const [pseBanks, setPseBanks] = useState<any[]>([]);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [nequiWaiting, setNequiWaiting] = useState(false);
  const [collectRef, setCollectRef] = useState<any>(null);
  const [pseBankCode, setPseBankCode] = useState('');
  const [pseUserType, setPseUserType] = useState('0');
  const [pseLegalIdType, setPseLegalIdType] = useState('CC');
  const [pseLegalId, setPseLegalId] = useState('');
  const [pseEmail, setPseEmail] = useState('');
  const [psePhone, setPsePhone] = useState('');

  // Parse cart from URL
  useEffect(() => {
    const cartParam = searchParams?.get('cart');
    if (cartParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cartParam));
        setCartItems(parsed);
      } catch { /* noop */ }
    }
  }, [searchParams]);

  // Fetch product details
  useEffect(() => {
    if (!code || cartItems.length === 0) return;
    setLoadingProducts(true);
    fetch(`${API_URL}/seller-product-links/catalog/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.products) {
          const ids = new Set(cartItems.map(ci => ci.id));
          setProducts(data.products.filter((p: Product) => ids.has(p.id)));
        }
        setLoadingProducts(false);
      })
      .catch(() => setLoadingProducts(false));
  }, [code, cartItems]);

  // Google Maps autocomplete
  useEffect(() => {
    if (!mapsReady || !streetRef.current || autocompleteRef.current) return;
    const ac = new (window as any).google.maps.places.Autocomplete(streetRef.current, {
      types: ['address'],
      componentRestrictions: { country: ['co', 'us', 'mx', 'es'] },
    });
    autocompleteRef.current = ac;
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place?.address_components) return;
      const get = (type: string) => place.address_components?.find((c: any) => c.types.includes(type))?.long_name || '';
      const streetNum = get('street_number');
      const route = get('route');
      setStreet([route, streetNum].filter(Boolean).join(' '));
      const rawCity = get('locality') || get('administrative_area_level_2');
      const cleanCity = rawCity.replace(/,?\s*D\.?C\.?$/i, '').trim();
      setCity(cleanCity);
      const rawState = get('administrative_area_level_1');
      setState(cleanCity.toLowerCase() === 'bogotá' || cleanCity.toLowerCase() === 'bogota' ? 'Cundinamarca' : rawState);
    });
  }, [mapsReady]);

  const cartProducts = cartItems.map(ci => {
    const product = products.find(p => p.id === ci.id);
    return product ? { product, qty: ci.qty } : null;
  }).filter(Boolean) as Array<{ product: Product; qty: number }>;

  const total = cartProducts.reduce((acc, cp) => acc + parseFloat(cp.product.price) * cp.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) return;
    setCreatingOrder(true);
    setSubmitError('');
    try {
      const fullPhone = `${phoneCode.code}${phone}`;
      const res = await fetch(`${API_URL}/seller-product-links/catalog/${code}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: fullPhone,
          email: email || undefined,
          street,
          city,
          state: state || undefined,
          detail: detail || undefined,
          addressPhone: fullPhone,
          legalIdType: idType,
          legalId: idNumber || undefined,
          items: cartItems.map(ci => ({ variantId: ci.id, quantity: ci.qty })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Error al crear el pedido');
      }
      const data = await res.json();
      const result = data.data || data;
      const oid = result.orderId;
      if (!oid) throw new Error('No se pudo crear el pedido');

      const wompiRes = await fetch(`${API_URL}/payments/wompi-public-data/${oid}`);
      if (!wompiRes.ok) throw new Error('Error al preparar el pago');
      const wompiData = await wompiRes.json();

      setOrderId(oid);
      setWompiPublicKey(wompiData.publicKey || '');
      setAcceptanceToken(wompiData.acceptanceToken || '');
      setAcceptPermalink(wompiData.acceptPermalink || 'https://wompi.com/assets/downloadble/reglamento.pdf');
      if (email) setPseEmail(email);
      if (idNumber) setPseLegalId(idNumber);
      if (idType) setPseLegalIdType(idType);
    } catch (err: any) {
      setSubmitError(err.message || 'Error inesperado');
    } finally {
      setCreatingOrder(false);
    }
  };

  const processPayment = useCallback(async (methodData: Record<string, any>) => {
    if (!orderId) return;
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const res = await fetch(`${API_URL}/payments/direct-transaction/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodData: methodData, acceptanceToken, publicKey: wompiPublicKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Error al procesar el pago');

      const txStatus = data?.data?.status || data?.status;
      const txId = data?.data?.id || data?.id;

      if (methodData.type === 'NEQUI') {
        setNequiWaiting(true);
        let attempts = 0;
        const poll = async () => {
          if (attempts++ > 20) { setPaymentStatus('ERROR'); setNequiWaiting(false); return; }
          const pollRes = await fetch(`${API_URL}/payments/transaction-status/${orderId}?transactionId=${txId}`);
          const pollData = await pollRes.json();
          const status = pollData?.data?.status || pollData?.status;
          if (status === 'APPROVED') { setPaymentStatus('APPROVED'); setNequiWaiting(false); }
          else if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') { setPaymentStatus(status); setNequiWaiting(false); }
          else setTimeout(poll, 4000);
        };
        setTimeout(poll, 5000);
      } else if (methodData.type === 'BANCOLOMBIA_TRANSFER') {
        const redirectUrl = data?.data?.payment_method_info?.extra?.async_payment_url || data?.redirectUrl;
        if (redirectUrl) window.location.href = redirectUrl;
        else throw new Error('No se obtuvo URL de redirección');
      } else if (methodData.type === 'BANCOLOMBIA_COLLECT') {
        const bCode = data?.data?.payment_method_info?.extra?.business_agreement_code;
        const pIntent = data?.data?.payment_method_info?.extra?.payment_intention_identifier;
        if (bCode && pIntent) setCollectRef({ businessAgreementCode: bCode, paymentIntentionIdentifier: pIntent });
        else setPaymentStatus(txStatus || 'PENDING');
      } else if (methodData.type === 'DAVIPLATA') {
        let attempts = 0;
        const poll = async () => {
          if (attempts++ > 15) { setPaymentStatus('ERROR'); return; }
          const pollRes = await fetch(`${API_URL}/payments/transaction-status/${orderId}`);
          const pollData = await pollRes.json();
          const status = pollData?.data?.status || pollData?.status;
          if (status === 'APPROVED') setPaymentStatus('APPROVED');
          else if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') setPaymentStatus(status);
          else setTimeout(poll, 4000);
        };
        setTimeout(poll, 5000);
      } else {
        setPaymentStatus(txStatus || 'PENDING');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Error al procesar el pago');
    } finally {
      setPaymentProcessing(false);
    }
  }, [orderId, acceptanceToken, wompiPublicKey]);

  useEffect(() => {
    if (!wompiPublicKey) return;
    fetch(`${API_URL}/payments/pse-banks`)
      .then(r => r.json())
      .then(d => setPseBanks(d?.data || d || []))
      .catch(() => { });
  }, [wompiPublicKey]);

  const inputCls = inputClass();

  // ─── Render states ───
  if (paymentStatus || nequiWaiting || collectRef) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0d0a05 0%, #150f08 100%)' }}>
        <div className="sticky top-0 z-30 flex items-center px-4 py-3" style={{ background: 'rgba(13,10,5,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(211,168,111,0.08)' }}>
          <button onClick={() => router.push(`/s/${code}`)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="ml-3 text-white/70 text-sm">Estado del pago</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <PaymentResult
            status={nequiWaiting ? 'PENDING' : (paymentStatus || 'PENDING')}
            methodLabel={selectedMethod || undefined}
            onRetry={() => router.push(`/s/${code}`)}
            onContinue={() => router.push(`/s/${code}`)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: 'linear-gradient(180deg, #0d0a05 0%, #150f08 100%)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30" style={{ background: 'rgba(13,10,5,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(211,168,111,0.08)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Finalizar compra</p>
            <p className="text-white/30 text-[10px]">D Perfume House</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Order summary */}
        {!loadingProducts && cartProducts.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Resumen del pedido</p>
            </div>
            <div className="divide-y divide-white/5">
              {cartProducts.map(({ product, qty }) => {
                const img = product.images.find(i => i.isPrimary) || product.images[0];
                return (
                  <div key={product.id} className="flex gap-3 px-4 py-3">
                    {img && <img src={img.thumbnailUrl || img.url} alt={product.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm leading-tight line-clamp-1">{product.name}</p>
                      <p className="text-white/35 text-xs mt-0.5">× {qty}</p>
                    </div>
                    <span className="text-[#d3a86f] text-sm font-semibold flex-shrink-0">{formatPrice(parseFloat(product.price) * qty)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between px-4 py-3">
                <span className="text-white/50 text-sm font-medium">Total</span>
                <span className="text-white font-bold">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment form — Phase 2 */}
        {orderId ? (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Método de pago</p>
              </div>
              <div className="p-4 space-y-4">
                <PaymentMethodSelector selected={selectedMethod} onSelect={m => { setSelectedMethod(m); setPaymentError(''); }} />
                <WompiAcceptance checked={accepted} onChange={setAccepted} permalink={acceptPermalink} />

                {selectedMethod && accepted && (
                  <div className="space-y-4">
                    {selectedMethod === 'CARD' && (
                      <CardForm
                        publicKey={wompiPublicKey}
                        loading={paymentProcessing}
                        onToken={(cardToken, installments) => processPayment({ cardToken, installments })}
                      />
                    )}
                    {selectedMethod === 'NEQUI' && (
                      <NequiForm
                        defaultPhone={phone}
                        loading={paymentProcessing}
                        waiting={nequiWaiting}
                        onSubmit={(phoneNumber) => processPayment({ phoneNumber })}
                      />
                    )}
                    {selectedMethod === 'BANCOLOMBIA_TRANSFER' && (
                      <BancolombiaTransferForm loading={paymentProcessing} onSubmit={() => processPayment({})} />
                    )}
                    {selectedMethod === 'BANCOLOMBIA_COLLECT' && (
                      <BancolombiaCollectForm
                        loading={paymentProcessing}
                        onSubmit={() => processPayment({})}
                        reference={collectRef || undefined}
                        amount={total}
                      />
                    )}
                    {selectedMethod === 'DAVIPLATA' && (
                      <DaviplataForm
                        defaultIdType={idType}
                        defaultId={idNumber}
                        loading={paymentProcessing}
                        onSubmit={(d) => processPayment({ legalId: d.legalId, legalIdType: d.legalIdType })}
                      />
                    )}
                  </div>
                )}

                {paymentError && (
                  <div className="p-3 rounded-xl text-red-400 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {paymentError}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Phase 1: Customer info form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Tus datos</p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Nombre completo *</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre"
                    className={inputCls} style={inputStyle()} />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Teléfono *</label>
                  <div className="flex">
                    <PhoneCodeDropdown value={phoneCode} onChange={setPhoneCode} />
                    <input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="3001234567"
                      className="flex-1 px-4 py-2.5 rounded-r-xl text-white text-sm placeholder:text-white/25 focus:outline-none"
                      style={{ background: '#1a1610', border: '1px solid rgba(211,168,111,0.15)' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Correo electrónico</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com"
                    className={inputCls} style={inputStyle()} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Tipo de ID</label>
                    <select value={idType} onChange={e => setIdType(e.target.value)}
                      className={inputCls} style={{ ...inputStyle(), background: '#1a1610' }}>
                      {ID_TYPES.map(t => <option key={t.value} value={t.value} style={{ background: '#1a1610' }}>{t.value}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Número de ID</label>
                    <input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="1234567890"
                      className={inputCls} style={inputStyle()} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Dirección de envío</p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Dirección *</label>
                  <input required ref={streetRef} value={street} onChange={e => setStreet(e.target.value)}
                    placeholder="Calle, carrera, avenida…"
                    className={inputCls} style={inputStyle()} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Ciudad *</label>
                    <input required value={city} onChange={e => setCity(e.target.value)} placeholder="Bogotá"
                      className={inputCls} style={inputStyle()} />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Dpto.</label>
                    <input value={state} onChange={e => setState(e.target.value)} placeholder="Cundinamarca"
                      className={inputCls} style={inputStyle()} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Detalles adicionales</label>
                  <input value={detail} onChange={e => setDetail(e.target.value)} placeholder="Apto, torre, casa…"
                    className={inputCls} style={inputStyle()} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Forma de pago</p>
              </div>
              <div className="p-4">
                <PaymentMethodSelector selected={selectedMethod} onSelect={m => { setSelectedMethod(m); setPaymentError(''); }} />
              </div>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl text-red-400 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={creatingOrder || !selectedMethod || cartProducts.length === 0}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #d3a86f 0%, #b8853f 100%)', color: '#0d0a05' }}
            >
              {creatingOrder ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0d0a05]/30 border-t-[#0d0a05] rounded-full animate-spin" />
                  Procesando…
                </>
              ) : (
                <>Confirmar pedido · {formatPrice(total)}</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
