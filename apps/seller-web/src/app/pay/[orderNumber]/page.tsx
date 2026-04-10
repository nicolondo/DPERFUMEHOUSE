'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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

interface PseBank {
  financial_institution_code: string;
  financial_institution_name: string;
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
function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/* ------------------------------------------------------------------ */
/*  PayPage Component                                                  */
/* ------------------------------------------------------------------ */
export default function PayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.orderNumber as string;

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
  const [publicData, setPublicData] = useState<PublicData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [acceptanceChecked, setAcceptanceChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [nequiWaiting, setNequiWaiting] = useState(false);
  const [collectReference, setCollectReference] = useState<CollectReference | undefined>();
  const [banks, setBanks] = useState<PseBank[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Check for redirect result (from Wompi widget redirect)
  useEffect(() => {
    const txId = searchParams.get('id');
    if (txId) {
      setTransactionId(txId);
      setPaymentStatus('PENDING');
    }
  }, [searchParams]);

  // Fetch order data & widget config
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/payments/widget-config/${orderId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || 'No se pudo cargar la información del pedido.');
        }
        const data: WidgetConfig = await res.json();
        setWidgetConfig(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el pedido.');
      } finally {
        setLoading(false);
      }
    }
    if (orderId) fetchData();
  }, [orderId]);

  // Fetch public data when a direct payment method is selected
  useEffect(() => {
    async function fetchPublicData() {
      try {
        const res = await fetch(`${API_URL}/payments/wompi-public-data/${orderId}`);
        if (res.ok) {
          const data: PublicData = await res.json();
          setPublicData(data);
        }
      } catch {
        // Non-critical, widget still works
      }
    }

    if (paymentMethod && paymentMethod !== 'WIDGET' && !publicData) {
      fetchPublicData();
    }
  }, [paymentMethod, orderId, publicData]);

  // Fetch PSE banks when PSE is selected
  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch(`${API_URL}/payments/pse/banks`);
        if (res.ok) {
          const data = await res.json();
          setBanks(data.data || data || []);
        }
      } catch {
        // Will show empty bank list
      }
    }
    if (paymentMethod === 'PSE' && banks.length === 0) {
      fetchBanks();
    }
  }, [paymentMethod, banks.length]);

  // Poll transaction status
  useEffect(() => {
    if (!transactionId || !paymentStatus || paymentStatus !== 'PENDING') return;

    async function checkStatus() {
      try {
        const res = await fetch(
          `${API_URL}/payments/transaction-status/${orderId}?transactionId=${transactionId}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== 'PENDING') {
            setPaymentStatus(data.status);
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch {
        // Continue polling
      }
    }

    checkStatus();
    pollingRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [transactionId, paymentStatus, orderId]);

  // Open Wompi Widget
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
        signature: {
          integrity: widgetConfig.signature,
        },
      });

      checkout.open((result: any) => {
        const transaction = result?.transaction;
        if (transaction) {
          setTransactionId(transaction.id);
          setPaymentStatus(transaction.status || 'PENDING');
        }
      });
    } catch (err: any) {
      setError(err.message || 'Error al abrir el widget de pago.');
    } finally {
      setSubmitting(false);
    }
  }, [widgetConfig]);

  // Submit direct transaction
  const submitDirectTransaction = useCallback(
    async (methodData: Record<string, any>) => {
      if (!publicData || !widgetConfig) return;
      setSubmitting(true);
      setError('');

      try {
        const res = await fetch(`${API_URL}/payments/direct-transaction/${orderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: paymentMethod,
            acceptanceToken: publicData.acceptanceToken,
            ...methodData,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al procesar el pago.');

        // Handle different response types
        if (data.collectReference) {
          setCollectReference(data.collectReference);
        }

        if (data.data?.redirect_url) {
          window.location.href = data.data.redirect_url;
          return;
        }

        if (data.data?.id) {
          setTransactionId(data.data.id);
          setPaymentStatus(data.data.status || 'PENDING');

          if (paymentMethod === 'NEQUI') {
            setNequiWaiting(true);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error al procesar el pago.');
      } finally {
        setSubmitting(false);
      }
    },
    [publicData, widgetConfig, orderId, paymentMethod],
  );

  // Handle card token
  const handleCardToken = useCallback(
    (token: string, installments: number) => {
      submitDirectTransaction({
        token,
        installments,
        customerEmail: widgetConfig?.order?.customerName || '',
      });
    },
    [submitDirectTransaction, widgetConfig],
  );

  // Reset to try again
  const handleRetry = useCallback(() => {
    setPaymentStatus(null);
    setTransactionId(null);
    setPaymentMethod(null);
    setNequiWaiting(false);
    setCollectReference(undefined);
    setError('');
  }, []);

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0c09] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-3 border-[#d3a86f]/20 border-t-[#d3a86f] animate-spin mx-auto" />
          <p className="text-white/50 text-sm">Cargando tu pedido...</p>
        </div>
      </div>
    );
  }

  // Error state (no data)
  if (error && !widgetConfig) {
    return (
      <div className="min-h-screen bg-[#0e0c09] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/15">
            <svg
              className="w-7 h-7 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <p className="text-white font-semibold">No se pudo cargar el pedido</p>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Payment result
  if (paymentStatus) {
    const methodLabels: Record<string, string> = {
      CARD: 'Tarjeta',
      NEQUI: 'Nequi',
      PSE: 'PSE',
      BANCOLOMBIA_TRANSFER: 'Bancolombia',
      BANCOLOMBIA_COLLECT: 'Corresponsal',
      DAVIPLATA: 'Daviplata',
    };

    return (
      <div className="min-h-screen bg-[#0e0c09] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <PaymentResult
            status={paymentStatus}
            methodLabel={paymentMethod ? methodLabels[paymentMethod] : undefined}
            onRetry={
              paymentStatus === 'DECLINED' || paymentStatus === 'ERROR' || paymentStatus === 'VOIDED'
                ? handleRetry
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  const order = widgetConfig?.order;

  return (
    <div className="min-h-screen bg-[#0e0c09]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e0c09]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-white text-lg tracking-tight">
                D Perfume House
              </h1>
              <p className="text-white/40 text-xs mt-0.5">Pago seguro</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-medium">SSL</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Order Summary */}
        {order && (
          <div className="rounded-2xl border border-[#d3a86f]/15 bg-[#141110] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/50 uppercase tracking-wider">
                  Pedido {order.orderNumber}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="p-4 space-y-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-12 h-12 rounded-xl object-cover border border-white/5"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#d3a86f]/10 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-[#d3a86f]/40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-white/40">
                      {item.quantity > 1 ? `${item.quantity} × ` : ''}
                      {formatCurrency(item.price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-4 py-3 border-t border-white/5 bg-[#d3a86f]/5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Total a pagar</span>
                <span className="text-lg font-bold text-[#d3a86f]">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Section */}
        <div className="space-y-5">
          {/* Quick pay with widget */}
          <div>
            <button
              type="button"
              onClick={openWompiWidget}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-[#d3a86f] text-black font-semibold text-sm hover:bg-[#c4976a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Abriendo pasarela...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                    />
                  </svg>
                  Pagar con Wompi
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30 uppercase tracking-wider">
              o paga directamente
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Payment method selector */}
          <PaymentMethodSelector selected={paymentMethod} onSelect={setPaymentMethod} />

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
                <CardForm
                  publicKey={publicData.publicKey}
                  onToken={handleCardToken}
                  loading={submitting}
                />
              )}

              {paymentMethod === 'NEQUI' && (
                <NequiForm
                  defaultPhone={widgetConfig?.order?.customerPhone || ''}
                  onSubmit={(phone) =>
                    submitDirectTransaction({ phoneNumber: phone })
                  }
                  loading={submitting}
                  waiting={nequiWaiting}
                />
              )}

              {paymentMethod === 'BANCOLOMBIA_TRANSFER' && (
                <BancolombiaTransferForm
                  onSubmit={() => submitDirectTransaction({})}
                  loading={submitting}
                />
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
                <DaviplataForm
                  onSubmit={(data) => submitDirectTransaction(data)}
                  loading={submitting}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-4 pb-8 space-y-2">
          <div className="flex items-center justify-center gap-2 text-white/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
            <span className="text-xs">Pagos procesados por Wompi</span>
          </div>
          <p className="text-white/15 text-xs">© D Perfume House</p>
        </div>
      </div>
    </div>
  );
}