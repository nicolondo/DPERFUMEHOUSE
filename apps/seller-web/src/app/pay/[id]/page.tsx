'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  PaymentMethodSelector,
  AcceptanceCheckbox,
  CardForm,
  NequiForm,
  BancolombiaTransferForm,
  BancolombiaCollectForm,
  DaviplataForm,
  PaymentPolling,
} from '@/components/payments';
import type { PaymentMethodType } from '@/components/payments';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  total: string;
  variant: {
    name: string;
    price: string;
    attributes?: Record<string, string>;
    images: Array<{ url: string; thumbnailUrl?: string }>;
    fragranceProfile?: {
      familiaOlfativa?: string;
      intensidad?: string;
    };
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  tax: string;
  shipping: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  customer: { name: string; email?: string; phone?: string; documentType?: string; documentNumber?: string };
  seller: { name: string; phone?: string };
  items: OrderItem[];
  paymentLink?: { url: string; status: string } | null;
}

export default function PayOrderPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment state
  const [wompiPublicKey, setWompiPublicKey] = useState('');
  const [acceptanceToken, setAcceptanceToken] = useState('');
  const [acceptPermalink, setAcceptPermalink] = useState('');
  const [accepted, setAccepted] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [nequiWaiting, setNequiWaiting] = useState(false);
  const [collectRef, setCollectRef] = useState<{ businessAgreementCode: string; paymentIntentionIdentifier: string } | null>(null);
  const [pseWidgetReady, setPseWidgetReady] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load order
  useEffect(() => {
    fetch(`${API_URL}/orders/public/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        const data = d.data || d;
        if (data.orderNumber) setOrder(data);
        else setError('Pedido no disponible');
      })
      .catch(() => setError('Pedido no encontrado'))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Load Wompi public data when order is loaded and unpaid
  useEffect(() => {
    if (!order) return;
    const isPaid = order.paymentStatus === 'COMPLETED' || order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED';
    if (isPaid) return;
    fetch(`${API_URL}/payments/wompi-public-data/${order.id}`)
      .then((r) => r.json())
      .then((d) => {
        setWompiPublicKey(d.publicKey || '');
        setAcceptanceToken(d.acceptanceToken || '');
        setAcceptPermalink(d.acceptPermalink || 'https://wompi.com/assets/downloadble/reglamento.pdf');
      })
      .catch(() => {});
  }, [order?.id]);

  // Load Wompi widget script for PSE
  useEffect(() => {
    if (!order || selectedMethod !== 'PSE') return;
    if ((window as any).WidgetCheckout) { setPseWidgetReady(true); return; }
    const existing = document.getElementById('wompi-widget-script');
    if (existing) { existing.addEventListener('load', () => setPseWidgetReady(true)); return; }
    const script = document.createElement('script');
    script.id = 'wompi-widget-script';
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => setPseWidgetReady(true);
    document.head.appendChild(script);
  }, [order, selectedMethod]);

  // Cleanup polling
  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // Poll for payment confirmation when redirected back from Wompi
  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    if (paymentParam !== 'done' || !order) return;
    const isPaid = order.paymentStatus === 'COMPLETED' || order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED';
    if (isPaid) return;

    let attempts = 0;
    const maxAttempts = 20; // 60 seconds
    const interval = setInterval(async () => {
      attempts++;
      try {
        // Poll Wompi directly for real-time status
        const txRes = await fetch(`${API_URL}/payments/transaction-status/${params.id}`);
        if (txRes.ok) {
          const txData = await txRes.json();
          if (txData.status === 'APPROVED') {
            // Also refresh order from DB then show success
            const orderRes = await fetch(`${API_URL}/orders/public/${params.id}`);
            if (orderRes.ok) setOrder((await orderRes.json()).data || await orderRes.json());
            clearInterval(interval);
            setPaymentStatus('APPROVED');
            return;
          } else if (txData.status === 'DECLINED' || txData.status === 'VOIDED' || txData.status === 'ERROR') {
            clearInterval(interval);
            setPaymentStatus(txData.status);
            return;
          }
        }
        // Fallback: also check order DB status (in case webhook already updated it)
        const orderRes = await fetch(`${API_URL}/orders/public/${params.id}`);
        if (orderRes.ok) {
          const d = await orderRes.json();
          const data = d.data || d;
          if (data.paymentStatus === 'COMPLETED' || data.status === 'PAID' || data.status === 'SHIPPED' || data.status === 'DELIVERED') {
            setOrder(data);
            clearInterval(interval);
          } else if (attempts >= maxAttempts) {
            setOrder(data);
            clearInterval(interval);
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch {
        if (attempts >= maxAttempts) clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [searchParams, order, params.id]);

  const formatPrice = (price: string | number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      typeof price === 'string' ? parseFloat(price) : price
    );

  const processPayment = useCallback(async (methodData: Record<string, any>) => {
    if (!order || !acceptanceToken) return;
    if (!accepted) { setPaymentError('Debes aceptar los términos y condiciones de Wompi.'); return; }
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const res = await fetch(`${API_URL}/payments/direct-transaction/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodType: selectedMethod, acceptanceToken, ...methodData }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Error al procesar el pago');
      }
      const result = await res.json();
      const { status, redirectUrl, paymentMethod } = result;

      switch (selectedMethod) {
        case 'BANCOLOMBIA_TRANSFER':
        case 'DAVIPLATA':
          if (redirectUrl) { window.location.href = redirectUrl; }
          else throw new Error('No se recibió URL de redirección.');
          break;
        case 'BANCOLOMBIA_COLLECT': {
          const pm = paymentMethod || {};
          setCollectRef({
            businessAgreementCode: pm.business_agreement_code || pm.extra?.business_agreement_code || '—',
            paymentIntentionIdentifier: pm.payment_intention_identifier || pm.extra?.payment_intention_identifier || '—',
          });
          setPaymentStatus('COLLECT_READY');
          break;
        }
        case 'NEQUI':
          setNequiWaiting(true);
          setPaymentStatus('PENDING');
          pollingRef.current = setInterval(async () => {
            try {
              const pollRes = await fetch(`${API_URL}/payments/transaction-status/${order.id}`);
              if (!pollRes.ok) return;
              const pollData = await pollRes.json();
              const s = pollData.status;
              if (s === 'APPROVED' || s === 'DECLINED' || s === 'ERROR' || s === 'VOIDED') {
                clearInterval(pollingRef.current!); pollingRef.current = null;
                setPaymentStatus(s); setNequiWaiting(false);
              }
            } catch {}
          }, 4000);
          break;
        case 'CARD':
          setPaymentStatus(status || 'PENDING');
          if (status === 'APPROVED') {
            setTimeout(() => router.push(`/pay/${order.id}?payment=done`), 1500);
          } else if (status === 'PENDING') {
            pollingRef.current = setInterval(async () => {
              try {
                const pollRes = await fetch(`${API_URL}/payments/transaction-status/${order.id}`);
                if (!pollRes.ok) return;
                const pollData = await pollRes.json();
                const s = pollData.status;
                if (s !== 'PENDING') {
                  clearInterval(pollingRef.current!); pollingRef.current = null;
                  setPaymentStatus(s);
                  if (s === 'APPROVED') setTimeout(() => router.push(`/pay/${order.id}?payment=done`), 1500);
                }
              } catch {}
            }, 3000);
          }
          break;
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Error al procesar el pago');
    } finally {
      setPaymentProcessing(false);
    }
  }, [order, acceptanceToken, accepted, selectedMethod, router]);

  const openPseWidget = useCallback(async () => {
    if (!order || !accepted) {
      if (!accepted) setPaymentError('Debes aceptar los términos y condiciones de Wompi.');
      return;
    }
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const res = await fetch(`${API_URL}/payments/widget-config/${order.id}`);
      if (!res.ok) throw new Error('Error al preparar el pago PSE');
      const cfg = await res.json();
      const checkout = new (window as any).WidgetCheckout({
        currency: 'COP',
        amountInCents: cfg.amountInCents,
        reference: cfg.reference,
        publicKey: cfg.publicKey,
        redirectUrl: cfg.redirectUrl,
        ...(cfg.customerData && Object.keys(cfg.customerData).length > 0 ? { customerData: cfg.customerData } : {}),
        ...(cfg.shippingAddress ? { shippingAddress: cfg.shippingAddress } : {}),
      });
      checkout.open((result: any) => {
        const t = result?.transaction;
        if (t?.status === 'APPROVED') setPaymentStatus('APPROVED');
      });
    } catch (err: any) {
      setPaymentError(err.message || 'Error al abrir PSE');
    } finally {
      setPaymentProcessing(false);
    }
  }, [order, accepted]);
  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[#d3a86f]/20 to-[#d3a86f]/5 flex items-center justify-center border border-[#d3a86f]/20 animate-pulse">
            <svg className="w-6 h-6 text-[#d3a86f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </div>
          <p className="text-[#d3a86f]/60 text-lg">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-dvh bg-[#0c0a06] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error || 'Pedido no encontrado'}</p>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'COMPLETED' || order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  // Check if redirected back from Wompi (PSE/Bancolombia)
  const paymentDone = searchParams.get('payment') === 'done';
  const showPolling = paymentDone && !isPaid && !isCancelled;

  return (
    <div className="min-h-dvh bg-[#0c0a06] text-white font-sans">
      {/* Logo */}
      <div className="sticky top-0 z-40 pt-4 pb-2 flex justify-center bg-[#0c0a06]">
        <img src="/icons/logo-final.svg" alt="D Perfume House" className="h-auto" style={{ width: '200px' }} />
      </div>

      {/* Header */}
      <div className="px-6 pt-6 pb-6 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#d3a86f]/20 to-[#d3a86f]/5 flex items-center justify-center border border-[#d3a86f]/20">
          {isPaid ? (
            <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-[#d3a86f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          )}
        </div>

        {isPaid ? (
          <>
            <h1 className="text-2xl font-light text-green-400">¡Pago confirmado!</h1>
            <p className="text-white/30 text-sm mt-1">Pedido {order.orderNumber}</p>
          </>
        ) : isCancelled ? (
          <>
            <h1 className="text-2xl font-light text-red-400">Pedido cancelado</h1>
            <p className="text-white/30 text-sm mt-1">Pedido {order.orderNumber}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-light">
              {order.customer?.name ? (
                <>
                  {order.customer.name.split(' ')[0]}, <span className="text-[#d3a86f] font-medium">tu pedido</span>
                </>
              ) : (
                <span className="text-[#d3a86f] font-medium">Resumen de pedido</span>
              )}
            </h1>
            <p className="text-white/30 text-sm mt-1">Pedido {order.orderNumber}</p>
            <p className="text-white/20 text-xs mt-0.5">Asesor: {order.seller.name}</p>
          </>
        )}
      </div>

      {/* Product list */}
      <div className="px-6 space-y-4">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
          {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}
        </p>

        {order.items.map((item) => {
          const v = item.variant;
          const img = v?.images?.[0]?.url || v?.images?.[0]?.thumbnailUrl;
          const fp = v?.fragranceProfile;

          return (
            <div
              key={item.id}
              className="flex gap-3 p-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01]"
            >
              {img ? (
                <img src={img} alt={v.name} className="w-16 h-16 rounded-xl object-cover bg-white/10 flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-4 3-4 8s1.5 7 4 10c2.5-3 4-5 4-10s-2.8-8-4-8z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[#e8c891] truncate">{v.name}</h3>
                {v.attributes && Object.keys(v.attributes).length > 0 && (
                  <p className="text-white/30 text-xs">{Object.values(v.attributes).join(' · ')}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {fp?.familiaOlfativa && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#d3a86f]/15 text-[#d3a86f]">
                      {fp.familiaOlfativa}
                    </span>
                  )}
                  {fp?.intensidad && (
                    <span className="text-[10px] text-white/30">🔥 {fp.intensidad}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-white/40">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </p>
                  <p className="text-sm font-bold text-white">{formatPrice(item.total)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order summary */}
      <div className="mx-6 mt-6 p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/40">Subtotal</span>
            <span className="text-white/60">{formatPrice(order.subtotal)}</span>
          </div>
          {parseFloat(order.shipping) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Envío</span>
              <span className="text-white/60">{formatPrice(order.shipping)}</span>
            </div>
          )}
          {parseFloat(order.tax) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Impuestos</span>
              <span className="text-white/60">{formatPrice(order.tax)}</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-3 mt-3 flex justify-between">
            <span className="text-base font-semibold text-white/70">Total</span>
            <span className="text-2xl font-bold text-[#e94560]">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Status banner + Payment section */}
      <div className="px-6 py-8 space-y-4">
        {isPaid && (
          <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
            <p className="text-green-400 font-medium">✓ Pago completado</p>
            <p className="text-green-400/50 text-xs mt-1">Tu pedido está siendo procesado</p>
          </div>
        )}

        {isCancelled && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-red-400 font-medium">Este pedido fue cancelado</p>
          </div>
        )}

        {showPolling && !paymentStatus && (
          <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
            <div className="w-6 h-6 mx-auto mb-2 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
            <p className="text-yellow-400/80 text-sm">Verificando tu pago...</p>
            <p className="text-yellow-400/40 text-xs mt-1">Esto puede tomar unos segundos</p>
          </div>
        )}

        {/* Native payment flow */}
        {!isPaid && !isCancelled && (!showPolling || paymentStatus) && (
          <div className="space-y-5">
            {/* Payment result states */}
            {paymentStatus === 'APPROVED' && (
              <PaymentPolling status="APPROVED" onContinue={() => router.push(`/pay/${order.id}?payment=done`)} />
            )}
            {(paymentStatus === 'DECLINED' || paymentStatus === 'ERROR' || paymentStatus === 'VOIDED') && (
              <PaymentPolling status={paymentStatus} onRetry={() => { setPaymentStatus(null); setNequiWaiting(false); setPaymentError(''); setSelectedMethod(null); }} />
            )}
            {nequiWaiting && paymentStatus === 'PENDING' && <PaymentPolling status="PENDING" methodLabel="Nequi" />}
            {paymentStatus === 'COLLECT_READY' && collectRef && (
              <BancolombiaCollectForm onSubmit={() => {}} loading={false} reference={collectRef} amount={parseFloat(order.total)} />
            )}

            {/* Show payment UI when no terminal status */}
            {!paymentStatus && !nequiWaiting && (
              <>
                {!selectedMethod ? (
                  <PaymentMethodSelector selected={selectedMethod} onSelect={setSelectedMethod} />
                ) : (
                  <>
                    <AcceptanceCheckbox checked={accepted} onChange={setAccepted} permalink={acceptPermalink} />
                    {paymentError && (
                      <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                        <p className="text-red-400 text-sm">{paymentError}</p>
                      </div>
                    )}
                    {selectedMethod === 'CARD' && (
                      <CardForm publicKey={wompiPublicKey} loading={paymentProcessing}
                        onToken={(cardToken, installments) => processPayment({ cardToken, installments })} />
                    )}
                    {selectedMethod === 'PSE' && (
                      <div className="space-y-3">
                        <p className="text-sm text-white/50 text-center">El pago PSE se procesa a través de Wompi. Serás redirigido a tu banco para confirmar.</p>
                        <button
                          type="button"
                          onClick={openPseWidget}
                          disabled={paymentProcessing || !accepted || !pseWidgetReady}
                          className="w-full py-3.5 rounded-xl bg-[#d3a86f] text-black font-bold text-base hover:bg-[#c4976a] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {paymentProcessing ? 'Preparando...' : pseWidgetReady ? 'Pagar con PSE' : 'Cargando...'}
                        </button>
                      </div>
                    )}
                    {selectedMethod === 'NEQUI' && (
                      <NequiForm defaultPhone={order.customer.phone || ''} loading={paymentProcessing} waiting={false}
                        onSubmit={(phoneNumber) => processPayment({ phoneNumber })} />
                    )}
                    {selectedMethod === 'BANCOLOMBIA_TRANSFER' && (
                      <BancolombiaTransferForm loading={paymentProcessing} onSubmit={() => processPayment({})} />
                    )}
                    {selectedMethod === 'BANCOLOMBIA_COLLECT' && (
                      <BancolombiaCollectForm loading={paymentProcessing} onSubmit={() => processPayment({})} />
                    )}
                    {selectedMethod === 'DAVIPLATA' && (
                      <DaviplataForm
                        defaultIdType={order.customer.documentType || 'CC'}
                        defaultId={order.customer.documentNumber || ''}
                        loading={paymentProcessing}
                        onSubmit={(d) => processPayment({ legalId: d.legalId, legalIdType: d.legalIdType })} />
                    )}
                    <button type="button" onClick={() => { setSelectedMethod(null); setPaymentError(''); }}
                      className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors py-1">
                      ← Cambiar método de pago
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-white/10 text-xs">Pago procesado de forma segura</p>
        <p className="text-white/15 text-xs mt-1">&copy; {new Date().getFullYear()} D Perfume House &middot; Perfumería Artesanal Árabe</p>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; background: #0c0a06; }
      `}</style>
    </div>
  );
}
