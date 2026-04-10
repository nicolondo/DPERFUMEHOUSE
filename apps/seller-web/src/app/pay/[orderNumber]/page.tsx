'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  WompiAcceptance,
  CardForm,
  NequiForm,
  BancolombiaTransferForm,
  BancolombiaCollectForm,
  DaviplataForm,
  PaymentResult,
} from '@/components/payment/payment-components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface WidgetConfig {
  publicKey: string;
  amountInCents: number;
  reference: string;
  currency: string;
  redirectUrl: string;
  signature: string;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    total: number;
    items: Array<{
      productName: string;
      quantity: number;
      price: number;
      imageUrl?: string;
    }>;
  };
}

interface PublicData {
  publicKey: string;
  amountInCents: number;
  reference: string;
  currency: string;
  acceptanceToken: string;
  permalink: string;
  orderId: string;
}

interface OrderPublic {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  tax: string;
  shipping: string;
  total: string;
  customer: { name: string };
  seller: { name: string; phone: string };
  paymentLink: { url: string; status: string } | null;
  items: Array<{
    quantity: number;
    unitPrice: string;
    total: string;
    variant: {
      name: string;
      price: string;
      attributes: any;
      images: Array<{ url: string; thumbnailUrl?: string; isPrimary?: boolean }>;
      fragranceProfile?: {
        familiaOlfativa: string;
        intensidad: string;
      } | null;
    };
  }>;
}

interface CollectReference {
  businessAgreementCode: string;
  paymentIntentionIdentifier: string;
}

declare global {
  interface Window {
    WidgetCheckout: any;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const fmt = (n: string | number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n));

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

const INTENSITY_EMOJIS: Record<string, string> = {
  suave: '🌿',
  moderada: '🔥',
  moderado: '🔥',
  intensa: '💥',
  intenso: '💥',
};

/* ------------------------------------------------------------------ */
/*  Payment method definitions                                         */
/* ------------------------------------------------------------------ */
const PAYMENT_METHODS = [
  { id: 'CARD', icon: '💳', label: 'Tarjeta', desc: 'Crédito o débito' },
  { id: 'PSE', icon: '🏛', label: 'PSE', desc: 'Débito bancario' },
  { id: 'NEQUI', icon: '🟣', label: 'Nequi', desc: 'Pago por app' },
  { id: 'BANCOLOMBIA_TRANSFER', icon: '🔄', label: 'Bancolombia', desc: 'Transferencia' },
  { id: 'BANCOLOMBIA_COLLECT', icon: '🖥', label: 'Corresponsal', desc: 'Pago en efectivo' },
] as const;

/* ================================================================== */
/*  PayPage Component                                                  */
/* ================================================================== */
export default function PayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderNumber = params.orderNumber as string;

  /* ---- state ---- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
  const [publicData, setPublicData] = useState<PublicData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [acceptanceChecked, setAcceptanceChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [nequiWaiting, setNequiWaiting] = useState(false);
  const [collectReference, setCollectReference] = useState<CollectReference | undefined>();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  /* ---- redirect result ---- */
  useEffect(() => {
    const txId = searchParams.get('id');
    if (txId) { setTransactionId(txId); setPaymentStatus('PENDING'); }
  }, [searchParams]);

  /* ---- fetch order + widget config ---- */
  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [orderRes, widgetRes] = await Promise.all([
          fetch(`${API_URL}/orders/public/${orderNumber}`),
          fetch(`${API_URL}/payments/widget-config/${orderNumber}`),
        ]);
        if (!orderRes.ok) throw new Error('No se pudo cargar el pedido.');
        const orderData: OrderPublic = await orderRes.json();
        setOrder(orderData);

        if (widgetRes.ok) {
          const wData: WidgetConfig = await widgetRes.json();
          setWidgetConfig(wData);
        }
      } catch (err: any) {
        setError(err.message || 'Error al cargar el pedido.');
      } finally {
        setLoading(false);
      }
    }
    if (orderNumber) fetchAll();
  }, [orderNumber]);

  /* ---- fetch public data for direct payments ---- */
  useEffect(() => {
    async function fetchPublicData() {
      try {
        const res = await fetch(`${API_URL}/payments/wompi-public-data/${orderNumber}`);
        if (res.ok) setPublicData(await res.json());
      } catch { /* non-critical */ }
    }
    if (paymentMethod && paymentMethod !== 'WIDGET' && !publicData) fetchPublicData();
  }, [paymentMethod, orderNumber, publicData]);

  /* ---- poll transaction status ---- */
  useEffect(() => {
    if (!transactionId || paymentStatus !== 'PENDING') return;
    async function check() {
      try {
        const res = await fetch(`${API_URL}/payments/transaction-status/${orderNumber}?transactionId=${transactionId}`);
        if (res.ok) {
          const d = await res.json();
          if (d.status && d.status !== 'PENDING') {
            setPaymentStatus(d.status);
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          }
        }
      } catch { /* keep polling */ }
    }
    check();
    pollingRef.current = setInterval(check, 3000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [transactionId, paymentStatus, orderNumber]);

  /* ---- open Wompi widget ---- */
  const openWompiWidget = useCallback(async () => {
    if (!widgetConfig) return;
    setSubmitting(true);
    try {
      await loadScript('https://checkout.wompi.co/widget.js');
      const checkout = new window.WidgetCheckout({
        currency: widgetConfig.currency,
        amountInCents: widgetConfig.amountInCents,
        reference: widgetConfig.reference,
        publicKey: widgetConfig.publicKey,
        redirectUrl: widgetConfig.redirectUrl,
        signature: { integrity: widgetConfig.signature },
      });
      checkout.open((result: any) => {
        const tx = result?.transaction;
        if (tx) { setTransactionId(tx.id); setPaymentStatus(tx.status || 'PENDING'); }
      });
    } catch (err: any) {
      setError(err.message || 'Error al abrir el widget de pago.');
    } finally {
      setSubmitting(false);
    }
  }, [widgetConfig]);

  /* ---- submit direct transaction ---- */
  const submitDirectTransaction = useCallback(async (methodData: Record<string, any>) => {
    if (!publicData || !widgetConfig) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/payments/direct-transaction/${orderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, acceptanceToken: publicData.acceptanceToken, ...methodData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al procesar el pago.');
      if (data.collectReference) setCollectReference(data.collectReference);
      if (data.data?.redirect_url) { window.location.href = data.data.redirect_url; return; }
      if (data.data?.id) {
        setTransactionId(data.data.id);
        setPaymentStatus(data.data.status || 'PENDING');
        if (paymentMethod === 'NEQUI') setNequiWaiting(true);
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago.');
    } finally {
      setSubmitting(false);
    }
  }, [publicData, widgetConfig, orderNumber, paymentMethod]);

  const handleCardToken = useCallback((token: string, installments: number) => {
    submitDirectTransaction({ token, installments, customerEmail: order?.customer?.name || '' });
  }, [submitDirectTransaction, order]);

  const handleRetry = useCallback(() => {
    setPaymentStatus(null); setTransactionId(null); setPaymentMethod(null);
    setNequiWaiting(false); setCollectReference(undefined); setError('');
  }, []);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0703] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#c9a96e]/20 border-t-[#c9a96e] animate-spin mx-auto" />
          <p className="text-[#6b4f35] text-sm">Cargando tu pedido...</p>
        </div>
      </div>
    );
  }

  /* ---- Error (no data) ---- */
  if (error && !order) {
    return (
      <div className="min-h-screen bg-[#0a0703] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-2xl">⚠️</div>
          <p className="text-[#fff7eb] font-semibold">No se pudo cargar el pedido</p>
          <p className="text-[#6b4f35] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  /* ---- Already paid ---- */
  if (order && (order.paymentStatus === 'PAID' || order.status === 'CONFIRMED')) {
    const num = order.orderNumber.replace(/^PH-/, '');
    return (
      <div className="min-h-screen bg-[#0a0703] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-5">
          <img src={`${process.env.NEXT_PUBLIC_APP_URL || ''}/icons/logo-email.png`} alt="D Perfume House" className="h-10 mx-auto opacity-80" />
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center mx-auto text-3xl">✅</div>
          <h1 className="text-2xl font-bold text-[#fff7eb]">¡Pago recibido!</h1>
          <p className="text-[#9c8568]">El pedido <strong className="text-[#c9a96e]">#{num}</strong> fue pagado exitosamente.</p>
        </div>
      </div>
    );
  }

  /* ---- Payment result ---- */
  if (paymentStatus) {
    const labels: Record<string, string> = {
      CARD: 'Tarjeta', NEQUI: 'Nequi', PSE: 'PSE',
      BANCOLOMBIA_TRANSFER: 'Bancolombia', BANCOLOMBIA_COLLECT: 'Corresponsal', DAVIPLATA: 'Daviplata',
    };
    return (
      <div className="min-h-screen bg-[#0a0703] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <PaymentResult
            status={paymentStatus}
            methodLabel={paymentMethod ? labels[paymentMethod] : undefined}
            onRetry={['DECLINED', 'ERROR', 'VOIDED'].includes(paymentStatus) ? handleRetry : undefined}
          />
        </div>
      </div>
    );
  }

  if (!order) return null;

  const orderNum = order.orderNumber.replace(/^PH-/, '');
  const shipping = Number(order.shipping);

  return (
    <div className="min-h-screen bg-[#0a0703]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="max-w-lg mx-auto px-5 py-8 space-y-7">

        {/* Logo */}
        <img
          src={`${process.env.NEXT_PUBLIC_APP_URL || ''}/icons/logo-email.png`}
          alt="D Perfume House"
          className="h-10 mx-auto opacity-90"
        />

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl bg-[#1a140b] border border-[#2e1f0e] flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🛒</span>
          </div>
          <h1 className="text-2xl text-[#fff7eb]">
            {order.customer?.name}, <em className="text-[#c9a96e]">tu pedido</em>
          </h1>
          <p className="text-sm text-[#6b4f35]">Pedido {order.orderNumber}</p>
          {order.seller?.name && (
            <p className="text-xs text-[#4a3825]">Asesor: {order.seller.name}</p>
          )}
        </div>

        {/* Product count */}
        <p className="text-xs font-semibold tracking-widest text-[#6b4f35] uppercase">
          {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}
        </p>

        {/* Items */}
        <div className="rounded-2xl border border-[#2e1f0e] bg-[#16110a] overflow-hidden divide-y divide-[#2e1f0e]">
          {order.items.map((item, i) => {
            const img = item.variant.images?.[0];
            const fp = item.variant.fragranceProfile;
            return (
              <div key={i} className="flex items-center gap-4 p-4">
                {img?.thumbnailUrl || img?.url ? (
                  <img src={img.thumbnailUrl ?? img.url} alt={item.variant.name} className="w-14 h-14 rounded-xl object-cover bg-[#1e160d] flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#1e160d] flex items-center justify-center flex-shrink-0 text-xl">🌸</div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[#c9a96e] truncate uppercase">{item.variant.name}</p>
                  {fp && (
                    <div className="flex flex-wrap gap-1.5">
                      {fp.familiaOlfativa && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1a140b] border border-[#2e1f0e] text-[#9c8568]">
                          {fp.familiaOlfativa}
                        </span>
                      )}
                      {fp.intensidad && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1a140b] border border-[#2e1f0e] text-[#9c8568]">
                          {INTENSITY_EMOJIS[fp.intensidad.toLowerCase()] || ''} {fp.intensidad}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-[#6b4f35]">{fmt(item.unitPrice)} × {item.quantity}</p>
                </div>
                <span className="text-sm font-bold text-[#bfa685] flex-shrink-0">{fmt(item.total)}</span>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="rounded-2xl border border-[#2e1f0e] bg-[#16110a] p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#6b4f35]">Subtotal</span>
            <span className="text-[#9c8568]">{fmt(order.subtotal)}</span>
          </div>
          {shipping > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#6b4f35]">Envío</span>
              <span className="text-[#9c8568]">{fmt(order.shipping)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-3 border-t border-[#2e1f0e]">
            <span className="text-base font-bold text-[#fff7eb]">Total</span>
            <span className="text-2xl font-extrabold text-[#c9a96e]">{fmt(order.total)}</span>
          </div>
        </div>

        {/* ============ PAYMENT SECTION ============ */}

        {/* Section title */}
        <p className="text-xs font-semibold tracking-widest text-[#6b4f35] uppercase">
          Método de pago
        </p>

        {/* Payment method grid */}
        <div className="grid grid-cols-3 gap-3">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setPaymentMethod(paymentMethod === m.id ? null : m.id); setAcceptanceChecked(false); }}
              className={`rounded-2xl border p-4 text-center transition-all ${
                paymentMethod === m.id
                  ? 'border-[#c9a96e] bg-[#c9a96e]/10'
                  : 'border-[#2e1f0e] bg-[#16110a] hover:border-[#4a3825]'
              }`}
            >
              <div className="text-2xl mb-1.5">{m.icon}</div>
              <p className={`text-sm font-semibold ${paymentMethod === m.id ? 'text-[#c9a96e]' : 'text-[#bfa685]'}`}>{m.label}</p>
              <p className="text-[10px] text-[#6b4f35] mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Acceptance */}
        {paymentMethod && publicData && (
          <WompiAcceptance
            checked={acceptanceChecked}
            onChange={setAcceptanceChecked}
            permalink={publicData.permalink}
          />
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Payment forms */}
        {paymentMethod && acceptanceChecked && publicData && (
          <div className="space-y-4">
            {paymentMethod === 'CARD' && (
              <CardForm publicKey={publicData.publicKey} onToken={handleCardToken} loading={submitting} />
            )}
            {paymentMethod === 'NEQUI' && (
              <NequiForm
                defaultPhone={order?.seller?.phone || ''}
                onSubmit={(phone) => submitDirectTransaction({ phoneNumber: phone })}
                loading={submitting}
                waiting={nequiWaiting}
              />
            )}
            {paymentMethod === 'BANCOLOMBIA_TRANSFER' && (
              <BancolombiaTransferForm onSubmit={() => submitDirectTransaction({})} loading={submitting} />
            )}
            {paymentMethod === 'BANCOLOMBIA_COLLECT' && (
              <BancolombiaCollectForm
                onSubmit={() => submitDirectTransaction({})}
                loading={submitting}
                reference={collectReference}
                amount={widgetConfig ? widgetConfig.amountInCents / 100 : undefined}
              />
            )}
            {paymentMethod === 'DAVIPLATA' && (
              <DaviplataForm onSubmit={(data) => submitDirectTransaction(data)} loading={submitting} />
            )}
          </div>
        )}

        {/* Fallback: Wompi widget button (if no direct method selected) */}
        {!paymentMethod && widgetConfig && (
          <button
            type="button"
            onClick={openWompiWidget}
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-extrabold text-base tracking-wide text-[#0a0703] transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #a07840 100%)' }}
          >
            {submitting ? 'Abriendo pasarela...' : 'Pagar ahora →'}
          </button>
        )}

        {/* WhatsApp */}
        {order.seller?.phone && (
          <a
            href={`https://wa.me/${order.seller.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, tengo una consulta sobre mi pedido #${orderNum}`)}`}
            className="block w-full py-3.5 rounded-2xl bg-[#25d366] text-white text-center font-bold text-sm"
          >
            💬 Contactar al vendedor
          </a>
        )}

        {/* Footer */}
        <div className="text-center pt-2 pb-6 space-y-1">
          <p className="text-[#4a3825] text-xs">Pago procesado de forma segura</p>
          <p className="text-[#3a2c1a] text-xs">© {new Date().getFullYear()} D Perfume House · Perfumería Artesanal Árabe</p>
        </div>
      </div>
    </div>
  );
}