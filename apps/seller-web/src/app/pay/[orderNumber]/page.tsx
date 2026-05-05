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
  customer: { name: string; email?: string | null; phone?: string | null; documentType?: string | null; documentNumber?: string | null };
  seller: { name: string; phone: string };
  paymentLink: { url: string; status: string; provider?: string; providerUrl?: string | null } | null;
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
const CardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
  </svg>
);
const BankIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
);
const TransferIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);
const StoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
  </svg>
);

const PAYMENT_METHODS = [
  { id: 'CARD', Icon: CardIcon, label: 'Tarjeta', desc: 'Crédito o débito' },
  { id: 'PSE', Icon: BankIcon, label: 'PSE', desc: 'Débito bancario' },
  { id: 'NEQUI', Icon: PhoneIcon, label: 'Nequi', desc: 'Pago por app' },
  { id: 'BANCOLOMBIA_TRANSFER', Icon: TransferIcon, label: 'Bancolombia', desc: 'Transferencia' },
  { id: 'BANCOLOMBIA_COLLECT', Icon: StoreIcon, label: 'Corresponsal', desc: 'Pago en efectivo' },
];

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
  const [monabitUrl, setMonabitUrl] = useState<string | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | null>(null);
  const [publicData, setPublicData] = useState<PublicData | null>(null);
  const [publicDataLoading, setPublicDataLoading] = useState(true);
  const [publicDataError, setPublicDataError] = useState(false);
  const [pseBanks, setPseBanks] = useState<Array<{ financial_institution_name: string; financial_institution_code: string }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [acceptanceChecked, setAcceptanceChecked] = useState(true);
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [nequiWaiting, setNequiWaiting] = useState(false);
  const [collectReference, setCollectReference] = useState<CollectReference | undefined>();
  /* PSE fields */
  const [pseBankCode, setPseBankCode] = useState('');
  const [pseUserType, setPseUserType] = useState('0');
  const [pseLegalIdType, setPseLegalIdType] = useState('CC');
  const [pseLegalId, setPseLegalId] = useState('');
  const [pseEmail, setPseEmail] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // true when user returns from bank redirect (prevents re-redirect loop)
  const isReturnFromRedirect = useRef(false);

  /* ---- redirect result ---- */
  useEffect(() => {
    const txId = searchParams.get('id');
    if (txId) {
      setTransactionId(txId);
      setPaymentStatus('PENDING');
      isReturnFromRedirect.current = true;
    }
  }, [searchParams]);

  /* ---- fetch public data (wompi acceptance token) ---- */
  const fetchPublicData = useCallback(async () => {
    setPublicDataLoading(true);
    setPublicDataError(false);
    try {
      const res = await fetch(`${API_URL}/payments/wompi-public-data/${orderNumber}`);
      if (res.ok) {
        setPublicData(await res.json());
      } else {
        setPublicDataError(true);
      }
    } catch {
      setPublicDataError(true);
    } finally {
      setPublicDataLoading(false);
    }
  }, [orderNumber]);

  /* ---- fetch order + widget config + pse banks ---- */
  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [orderRes, widgetRes, banksRes] = await Promise.all([
          fetch(`${API_URL}/orders/public/${orderNumber}`),
          fetch(`${API_URL}/payments/widget-config/${orderNumber}`),
          fetch(`${API_URL}/payments/pse/banks`),
        ]);
        if (!orderRes.ok) throw new Error('No se pudo cargar el pedido.');
        const orderData: OrderPublic = await orderRes.json();
        setOrder(orderData);

        // If the active payment link belongs to a provider with its own
        // hosted checkout (e.g. Monabit), embed it in an iframe instead of
        // redirecting the customer away from our platform.
        if (
          orderData.paymentLink?.provider &&
          orderData.paymentLink.provider !== 'wompi' &&
          orderData.paymentLink.providerUrl &&
          orderData.paymentStatus !== 'COMPLETED'
        ) {
          setMonabitUrl(orderData.paymentLink.providerUrl);
          setLoading(false);
          return;
        }

        if (widgetRes.ok) {
          const wData: WidgetConfig = await widgetRes.json();
          setWidgetConfig(wData);
        }
        if (banksRes.ok) {
          const bData = await banksRes.json();
          const list = Array.isArray(bData) ? bData : (bData.data || bData.banks || []);
          // Filter out placeholder entry (code "0")
          const filtered = list.filter((b: any) => b.financial_institution_code !== '0');
          const PRIORITY = ['bancolombia', 'davivienda'];
          filtered.sort((a: any, b: any) => {
            const ai = PRIORITY.findIndex((p) => a.financial_institution_name.toLowerCase().includes(p));
            const bi = PRIORITY.findIndex((p) => b.financial_institution_name.toLowerCase().includes(p));
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return a.financial_institution_name.localeCompare(b.financial_institution_name);
          });
          setPseBanks(filtered);
        }
      } catch (err: any) {
        setError(err.message || 'Error al cargar el pedido.');
      } finally {
        setLoading(false);
      }
    }
    if (orderNumber) {
      fetchAll();
      fetchPublicData();
    }
  }, [orderNumber, fetchPublicData]);

  /* ---- poll transaction status ---- */
  useEffect(() => {
    if (!transactionId || paymentStatus !== 'PENDING') return;
    async function check() {
      try {
        const res = await fetch(`${API_URL}/payments/transaction-status/${orderNumber}?transactionId=${transactionId}`);
        if (res.ok) {
          const d = await res.json();
          // PSE / Bancolombia Transfer: redirect to bank when async URL is ready
          if (d.asyncPaymentUrl && !isReturnFromRedirect.current) {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            window.location.href = d.asyncPaymentUrl;
            return;
          }
          // Bancolombia Collect: show payment reference when ready
          if (d.collectReference?.businessAgreementCode) {
            setCollectReference(d.collectReference);
          }
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
    setSubmitting(true);
    setError('');
    try {
      // Always fetch a fresh acceptance token — Wompi tokens are single-use
      const pdRes = await fetch(`${API_URL}/payments/wompi-public-data/${orderNumber}`);
      if (!pdRes.ok) throw new Error('No se pudo conectar con la pasarela de pago.');
      const freshData = await pdRes.json();
      setPublicData(freshData);

      const res = await fetch(`${API_URL}/payments/direct-transaction/${orderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, acceptanceToken: freshData.acceptanceToken, ...methodData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al procesar el pago.');

      // Extract collectReference from initial response (Wompi returns it immediately)
      if (data.data?.payment_method?.extra?.business_agreement_code) {
        setCollectReference({
          businessAgreementCode: data.data.payment_method.extra.business_agreement_code,
          paymentIntentionIdentifier: data.data.payment_method.extra.payment_intention_identifier,
        });
      } else if (data.collectReference) {
        setCollectReference(data.collectReference);
      }

      if (data.data?.id) {
        const txId = data.data.id;

        // For bank-redirect methods: poll for async_payment_url before setting status
        // (Wompi generates it asynchronously, may not be in the initial response)
        if (paymentMethod === 'BANCOLOMBIA_TRANSFER' || paymentMethod === 'DAVIPLATA') {
          // Check top-level field first (API now returns it explicitly)
          const bankUrl =
            data.asyncPaymentUrl ||
            data.data?.payment_method?.extra?.async_payment_url;
          if (bankUrl) {
            window.location.href = bankUrl;
            return;
          }
          // Poll up to 10 times (600ms apart) waiting for Wompi to generate the URL
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise((r) => setTimeout(r, 600));
            try {
              const pollRes = await fetch(`${API_URL}/payments/transaction-status/${orderNumber}?transactionId=${txId}`);
              if (pollRes.ok) {
                const pollData = await pollRes.json();
                if (pollData.asyncPaymentUrl) {
                  window.location.href = pollData.asyncPaymentUrl;
                  return;
                }
              }
            } catch { /* keep trying */ }
          }
          // Fallback: set pending state so background polling can take over
          setTransactionId(txId);
          setPaymentStatus(data.data?.status || 'PENDING');
          return;
        }

        setTransactionId(txId);
        setPaymentStatus(data.data.status || 'PENDING');
        if (paymentMethod === 'NEQUI') setNequiWaiting(true);
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago.');
    } finally {
      setSubmitting(false);
    }
  }, [orderNumber, paymentMethod]);

  const handleCardToken = useCallback((token: string, installments: number) => {
    submitDirectTransaction({ token, installments, customerEmail: order?.customer?.email || '' });
  }, [submitDirectTransaction, order]);

  const handleRetry = useCallback(() => {
    setPaymentStatus(null); setTransactionId(null); setPaymentMethod(null);
    setNequiWaiting(false); setCollectReference(undefined); setError('');
    setAcceptanceChecked(true);
    setPseBankCode(''); setPseLegalId(''); setPseEmail('');
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
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
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
          <img src="/icons/logo-dperfumehouse.svg" alt="D Perfume House" style={{ width: 200 }} className="mx-auto opacity-90" />
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#fff7eb]">¡Pago recibido!</h1>
          <p className="text-[#9c8568]">El pedido <strong className="text-[#c9a96e]">#{num}</strong> fue pagado exitosamente.</p>
        </div>
      </div>
    );
  }

  /* ---- Payment result (skip for Corresponsal while PENDING — show reference instead) ---- */
  if (paymentStatus && !(paymentMethod === 'BANCOLOMBIA_COLLECT' && paymentStatus === 'PENDING')) {
    const labels: Record<string, string> = {
      CARD: 'Tarjeta', NEQUI: 'Nequi', PSE: 'PSE',
      BANCOLOMBIA_TRANSFER: 'Bancolombia', BANCOLOMBIA_COLLECT: 'Corresponsal', DAVIPLATA: 'Daviplata',
    };
    // PENDING after returning from bank redirect — show verification state with retry
    if (paymentStatus === 'PENDING' && isReturnFromRedirect.current) {
      return (
        <div className="min-h-screen bg-[#0a0703] flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center space-y-5">
            <img src="/icons/logo-dperfumehouse.svg" alt="D Perfume House" style={{ width: 200 }} className="mx-auto opacity-90" />
            <div className="w-14 h-14 rounded-full border-2 border-[#c9a96e]/30 border-t-[#c9a96e] animate-spin mx-auto" />
            <div className="space-y-2">
              <p className="text-[#fff7eb] font-semibold">Verificando tu pago...</p>
              <p className="text-[#6b4f35] text-sm">Estamos confirmando el estado de tu transacción con Bancolombia.</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 px-5 py-2.5 rounded-xl border border-[#2e1f0e] text-[#9c8568] text-sm hover:border-[#c9a96e]/30 transition-colors cursor-pointer"
            >
              Intentar con otro método de pago
            </button>
          </div>
        </div>
      );
    }
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

  if (!order && !monabitUrl) return null;

  /* ---- Monabit hosted checkout (iframe) ---- */
  if (monabitUrl) {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#0a0703]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#16110a] border-b border-[#2e1f0e] flex-shrink-0">
          <img src="/icons/logo-dperfumehouse.svg" alt="D Perfume House" style={{ height: 28 }} className="opacity-90" />
          <div className="flex-1" />
          <span className="text-xs text-[#6b4f35]">Pago seguro</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b4f35" strokeWidth={1.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        {/* Iframe */}
        <div className="relative flex-1">
          <iframe
            src={monabitUrl}
            title="Pago"
            className="absolute inset-0 w-full h-full border-none"
            allow="payment"
          />
          {/* Hide Monabit branding logo — pointer-events:none so clicks still reach iframe */}
          <div
            className="absolute pointer-events-none"
            style={{ top: 130, right: 'max(calc(50% - 258px), 12px)', width: 140, height: 50, background: '#fff', zIndex: 10 }}
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
          src="/icons/logo-dperfumehouse.svg"
          alt="D Perfume House"
          style={{ width: 200 }}
          className="mx-auto opacity-90"
        />

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl bg-[#1a140b] border border-[#2e1f0e] flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth={1.5} className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
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
          {PAYMENT_METHODS.map((m) => {
            const isSelected = paymentMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  const next = paymentMethod === m.id ? null : m.id;
                  setPaymentMethod(next);
                  setAcceptanceChecked(true);
                  // Pre-fill PSE fields from customer data
                  if (next === 'PSE' && order) {
                    if (order.customer.email) setPseEmail(order.customer.email);
                    if (order.customer.documentNumber) setPseLegalId(order.customer.documentNumber);
                    if (order.customer.documentType) {
                      const dt = order.customer.documentType.toUpperCase();
                      if (['CC', 'NIT', 'CE', 'PP'].includes(dt)) setPseLegalIdType(dt);
                    }
                  }
                  if (next && !publicData && !publicDataLoading) fetchPublicData();
                  // Smooth scroll to payment details
                  if (next) {
                    setTimeout(() => {
                      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 150);
                  }
                }}
                className={`rounded-2xl border p-4 text-center transition-all duration-150 cursor-pointer active:scale-[0.96] ${
                  isSelected
                    ? 'border-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_12px_rgba(201,169,110,0.15)]'
                    : 'border-[#2e1f0e] bg-[#16110a] hover:border-[#4a3825] hover:bg-[#1c1610]'
                }`}
              >
                <div className={`flex justify-center mb-1.5 ${ isSelected ? 'text-[#c9a96e]' : 'text-[#6b4f35]' }`}>
                  <m.Icon />
                </div>
                <p className={`text-sm font-semibold ${ isSelected ? 'text-[#c9a96e]' : 'text-[#bfa685]' }`}>{m.label}</p>
                <p className="text-[10px] text-[#6b4f35] mt-0.5">{m.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Payment details section — scroll target */}
        <div ref={paymentSectionRef} />

        {/* publicData states */}
        {paymentMethod && publicDataLoading && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-5 h-5 rounded-full border-2 border-[#c9a96e]/20 border-t-[#c9a96e] animate-spin" />
            <p className="text-sm text-[#6b4f35]">Cargando opciones de pago...</p>
          </div>
        )}
        {paymentMethod && !publicDataLoading && publicDataError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-center justify-between gap-3">
            <p className="text-red-400 text-sm">No se pudo conectar con la pasarela de pago.</p>
            <button
              onClick={fetchPublicData}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[#c9a96e] text-[#0a0703] text-xs font-semibold cursor-pointer hover:bg-[#b8934d] transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

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
            {paymentMethod === 'PSE' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#9c8568] mb-1.5 block">Banco</label>
                  <select
                    value={pseBankCode}
                    onChange={(e) => setPseBankCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#c9a96e]/15 text-[#fff7eb] text-base focus:outline-none focus:border-[#c9a96e]/50 cursor-pointer"
                  >
                    <option value="">Selecciona tu banco...</option>
                    {pseBanks.map((b) => (
                      <option key={b.financial_institution_code} value={b.financial_institution_code}>
                        {b.financial_institution_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#9c8568] mb-1.5 block">Tipo de persona</label>
                    <select
                      value={pseUserType}
                      onChange={(e) => setPseUserType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#c9a96e]/15 text-[#fff7eb] text-base focus:outline-none focus:border-[#c9a96e]/50 cursor-pointer"
                    >
                      <option value="0">Natural</option>
                      <option value="1">Jurídica</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#9c8568] mb-1.5 block">Tipo de documento</label>
                    <select
                      value={pseLegalIdType}
                      onChange={(e) => setPseLegalIdType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#c9a96e]/15 text-[#fff7eb] text-base focus:outline-none focus:border-[#c9a96e]/50 cursor-pointer"
                    >
                      <option value="CC">Cédula (CC)</option>
                      <option value="NIT">NIT</option>
                      <option value="CE">Cédula Extranjería</option>
                      <option value="PP">Pasaporte</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#9c8568] mb-1.5 block">Número de documento</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1234567890"
                    value={pseLegalId}
                    onChange={(e) => setPseLegalId(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#c9a96e]/15 text-[#fff7eb] placeholder:text-[#4a3825] text-base focus:outline-none focus:border-[#c9a96e]/50 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9c8568] mb-1.5 block">Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={pseEmail}
                    onChange={(e) => setPseEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#c9a96e]/15 text-[#fff7eb] placeholder:text-[#4a3825] text-base focus:outline-none focus:border-[#c9a96e]/50"
                  />
                </div>
                <button
                  type="button"
                  disabled={!pseBankCode || !pseLegalId || !pseEmail || submitting}
                  onClick={() => submitDirectTransaction({
                    financialInstitutionCode: pseBankCode,
                    userType: pseUserType,
                    userLegalIdType: pseLegalIdType,
                    userLegalId: pseLegalId,
                    customerEmail: pseEmail,
                  })}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #a07840 100%)', color: '#0a0703' }}
                >
                  {submitting ? 'Procesando...' : 'Pagar con PSE'}
                </button>
              </div>
            )}
            {paymentMethod === 'NEQUI' && (
              <NequiForm
                defaultPhone={order?.customer?.phone || ''}
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
                amount={widgetConfig ? widgetConfig.amountInCents / 100 : publicData ? publicData.amountInCents / 100 : undefined}
              />
            )}
            {paymentMethod === 'DAVIPLATA' && (
              <DaviplataForm onSubmit={(data) => submitDirectTransaction(data)} loading={submitting} />
            )}
          </div>
        )}


        {/* Footer */}
        <div className="text-center pt-2 pb-6 space-y-1">
          <p className="text-[#4a3825] text-xs">Pago procesado de forma segura</p>
          <p className="text-[#3a2c1a] text-xs">© {new Date().getFullYear()} D Perfume House</p>
        </div>
      </div>
    </div>
  );
}