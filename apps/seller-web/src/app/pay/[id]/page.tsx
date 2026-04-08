'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

declare global {
  interface Window {
    WidgetCheckout: any;
  }
}

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
  customer: { name: string };
  seller: { name: string; phone?: string };
  items: OrderItem[];
  paymentLink?: { url: string; status: string } | null;
}

interface WidgetConfig {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
  customerData?: Record<string, string>;
  shippingAddress?: Record<string, string>;
}

export default function PayOrderPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [widgetScriptLoaded, setWidgetScriptLoaded] = useState(false);

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

  // Load Wompi widget script
  useEffect(() => {
    if (document.querySelector('script[src*="widget.js"]')) {
      setWidgetScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => setWidgetScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Fetch widget config when order is loaded and payment is needed
  useEffect(() => {
    if (!order) return;
    const isPaid = order.paymentStatus === 'COMPLETED' || order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED';
    const isCancelled = order.status === 'CANCELLED';
    if (isPaid || isCancelled) return;

    fetch(`${API_URL}/payments/widget-config/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Widget config error');
        return r.json();
      })
      .then(setWidgetConfig)
      .catch((err) => console.error('Failed to load widget config:', err));
  }, [order, params.id]);

  // Poll for payment confirmation when redirected back from Wompi
  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    if (paymentParam !== 'done' || !order) return;
    const isPaid = order.paymentStatus === 'COMPLETED' || order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED';
    if (isPaid) return;

    let attempts = 0;
    const maxAttempts = 15;
    const interval = setInterval(() => {
      attempts++;
      fetch(`${API_URL}/orders/public/${params.id}`)
        .then((r) => r.json())
        .then((d) => {
          const data = d.data || d;
          if (data.paymentStatus === 'COMPLETED' || data.status === 'PAID' || data.status === 'SHIPPED' || data.status === 'DELIVERED') {
            setOrder(data);
            clearInterval(interval);
          } else if (attempts >= maxAttempts) {
            setOrder(data);
            clearInterval(interval);
          }
        })
        .catch(() => { if (attempts >= maxAttempts) clearInterval(interval); });
    }, 3000);

    return () => clearInterval(interval);
  }, [searchParams, order, params.id]);

  const formatPrice = (price: string | number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
      typeof price === 'string' ? parseFloat(price) : price
    );

  const handlePay = useCallback(() => {
    if (!widgetConfig || !widgetScriptLoaded || !window.WidgetCheckout) return;
    setPaying(true);

    const checkoutConfig: any = {
      currency: widgetConfig.currency,
      amountInCents: widgetConfig.amountInCents,
      reference: widgetConfig.reference,
      publicKey: widgetConfig.publicKey,
      signature: { integrity: widgetConfig.signature },
      redirectUrl: widgetConfig.redirectUrl,
    };

    if (widgetConfig.customerData && Object.keys(widgetConfig.customerData).length > 0) {
      checkoutConfig.customerData = widgetConfig.customerData;
    }
    if (widgetConfig.shippingAddress && Object.keys(widgetConfig.shippingAddress).length > 0) {
      checkoutConfig.shippingAddress = widgetConfig.shippingAddress;
    }

    const checkout = new window.WidgetCheckout(checkoutConfig);
    checkout.open(function (result: any) {
      const transaction = result?.transaction;
      if (transaction?.status === 'APPROVED') {
        // Reload order to show paid state
        fetch(`${API_URL}/orders/public/${params.id}`)
          .then((r) => r.json())
          .then((d) => {
            const data = d.data || d;
            if (data.orderNumber) setOrder(data);
          });
      }
      setPaying(false);
    });
  }, [widgetConfig, widgetScriptLoaded, params.id]);

  // Fallback: redirect to payment URL
  const handlePayRedirect = () => {
    if (order?.paymentLink?.url) {
      window.location.href = order.paymentLink.url;
    }
  };
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
  const paymentUrl = order.paymentLink?.url;
  const canPayWidget = !isPaid && !isCancelled && widgetConfig && widgetScriptLoaded;
  const canPayRedirect = !isPaid && !isCancelled && paymentUrl && !canPayWidget;

  // Check if redirected back from Wompi
  const paymentDone = searchParams.get('payment') === 'done';
  const showPolling = paymentDone && !isPaid && !isCancelled;

  const handleContact = () => {
    if (!order.seller.phone) return;
    const phoneDigits = order.seller.phone.replace(/\D/g, '').replace(/^(?!57)(\d{10})$/, '57$1');
    const customerFirst = order.customer?.name?.split(' ')[0] || '';
    const msg = encodeURIComponent(
      `¡Hola! ${customerFirst ? `Soy ${customerFirst}, ` : ''}tengo una pregunta sobre mi pedido ${order.orderNumber}.`
    );
    window.open(`https://wa.me/${phoneDigits}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-dvh bg-[#0c0a06] text-white font-sans">
      {/* Logo */}
      <div className="sticky top-0 z-40 pt-4 pb-2 flex justify-center bg-[#0c0a06]">
        <img src="/icons/logo-final.svg" alt="D Perfume House" className="w-36 h-auto" />
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

      {/* Status banner + CTA */}
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

        {showPolling && (
          <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
            <div className="w-6 h-6 mx-auto mb-2 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
            <p className="text-yellow-400/80 text-sm">Verificando tu pago...</p>
            <p className="text-yellow-400/40 text-xs mt-1">Esto puede tomar unos segundos</p>
          </div>
        )}

        {canPayWidget && (
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full py-4 rounded-full bg-[#e94560] text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#d13a53] transition-all active:scale-[0.98] shadow-lg shadow-[#e94560]/20 disabled:opacity-60"
          >
            {paying ? (
              <>
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                </svg>
                Pagar {formatPrice(order.total)}
              </>
            )}
          </button>
        )}

        {canPayRedirect && (
          <button
            onClick={handlePayRedirect}
            className="w-full py-4 rounded-full bg-[#e94560] text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#d13a53] transition-all active:scale-[0.98] shadow-lg shadow-[#e94560]/20"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
            Pagar {formatPrice(order.total)}
          </button>
        )}

        {!isPaid && !isCancelled && !canPayWidget && !canPayRedirect && !showPolling && (
          <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
            <p className="text-yellow-400/80 text-sm">Preparando pago...</p>
            <p className="text-yellow-400/40 text-xs mt-1">Contacta a tu asesor si persiste</p>
          </div>
        )}

        {order.seller.phone && (
          <button
            onClick={handleContact}
            className="w-full py-3 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#25D366]/20 transition-all active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contactar asesor
          </button>
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
