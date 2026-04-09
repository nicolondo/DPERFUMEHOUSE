'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import {
  PaymentMethodSelector,
  AcceptanceCheckbox,
  CardForm,
  PSEForm,
  NequiForm,
  BancolombiaTransferForm,
  BancolombiaCollectForm,
  DaviplataForm,
  PaymentPolling,
} from './index';
import type { PaymentMethodType } from './PaymentMethodSelector';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Bank {
  financial_institution_code: string;
  financial_institution_name: string;
}

interface DirectPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  total: number;
  customerDocumentType?: string;
  customerDocumentNumber?: string;
  customerPhone?: string;
  onSuccess?: () => void;
}

export function DirectPaymentModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  total,
  customerDocumentType,
  customerDocumentNumber,
  customerPhone,
  onSuccess,
}: DirectPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [wompiPublicKey, setWompiPublicKey] = useState('');
  const [acceptanceToken, setAcceptanceToken] = useState('');
  const [acceptPermalink, setAcceptPermalink] = useState('');
  const [accepted, setAccepted] = useState(true);
  const [pseBanks, setPseBanks] = useState<Bank[]>([]);
  const [wompiLoaded, setWompiLoaded] = useState(false);
  const [wompiError, setWompiError] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [nequiWaiting, setNequiWaiting] = useState(false);
  const [collectRef, setCollectRef] = useState<{ businessAgreementCode: string; paymentIntentionIdentifier: string } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedMethod(null);
      setAccepted(false);
      setWompiLoaded(false);
      setWompiError('');
      setPaymentError('');
      setPaymentStatus(null);
      setNequiWaiting(false);
      setCollectRef(null);
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    // Fetch Wompi config
    fetch(`${API_URL}/payments/wompi-public-data/${orderId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        setWompiPublicKey(d.publicKey || '');
        setAcceptanceToken(d.acceptanceToken || '');
        setAcceptPermalink(d.acceptPermalink || 'https://wompi.com/assets/downloadble/reglamento.pdf');
        setWompiLoaded(true);
      })
      .catch(() => setWompiError('No se pudo cargar la configuración de pago. Intenta cerrar y abrir de nuevo.'));

    // Fetch PSE banks
    fetch(`${API_URL}/payments/pse/banks`)
      .then((r) => r.json())
      .then((data) => setPseBanks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isOpen, orderId]);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const processPayment = useCallback(async (methodData: Record<string, any>) => {
    if (!acceptanceToken) return;
    if (!accepted) { setPaymentError('Debes aceptar los términos y condiciones de Wompi.'); return; }
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const res = await fetch(`${API_URL}/payments/direct-transaction/${orderId}`, {
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
        case 'PSE':
        case 'BANCOLOMBIA_TRANSFER':
        case 'DAVIPLATA':
          if (redirectUrl) { window.open(redirectUrl, '_blank'); setPaymentStatus('REDIRECT_SENT'); }
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
              const pollRes = await fetch(`${API_URL}/payments/transaction-status/${orderId}`);
              if (!pollRes.ok) return;
              const pollData = await pollRes.json();
              const s = pollData.status;
              if (s === 'APPROVED' || s === 'DECLINED' || s === 'ERROR' || s === 'VOIDED') {
                clearInterval(pollingRef.current!); pollingRef.current = null;
                setPaymentStatus(s); setNequiWaiting(false);
                if (s === 'APPROVED') onSuccess?.();
              }
            } catch {}
          }, 4000);
          break;
        case 'CARD':
          setPaymentStatus(status || 'PENDING');
          if (status === 'APPROVED') { onSuccess?.(); }
          else if (status === 'PENDING') {
            pollingRef.current = setInterval(async () => {
              try {
                const pollRes = await fetch(`${API_URL}/payments/transaction-status/${orderId}`);
                if (!pollRes.ok) return;
                const pollData = await pollRes.json();
                const s = pollData.status;
                if (s !== 'PENDING') {
                  clearInterval(pollingRef.current!); pollingRef.current = null;
                  setPaymentStatus(s);
                  if (s === 'APPROVED') onSuccess?.();
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
  }, [orderId, acceptanceToken, accepted, selectedMethod, onSuccess]);

  const handleRetry = () => {
    setPaymentStatus(null);
    setNequiWaiting(false);
    setPaymentError('');
    setSelectedMethod(null);
    setAccepted(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cobrar pedido #${orderNumber}`} fullHeight>
      <div className="space-y-4 pb-4">
        {/* Total */}
        <div className="rounded-xl bg-[#d3a86f]/5 border border-[#d3a86f]/20 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-white/50">Total a cobrar</span>
          <span className="text-xl font-bold text-[#d3a86f]">{formatPrice(total)}</span>
        </div>

        {/* Terminal states */}
        {paymentStatus === 'APPROVED' && (
          <PaymentPolling status="APPROVED" onContinue={() => { onSuccess?.(); onClose(); }} />
        )}
        {(paymentStatus === 'DECLINED' || paymentStatus === 'ERROR' || paymentStatus === 'VOIDED') && (
          <PaymentPolling status={paymentStatus} onRetry={handleRetry} />
        )}
        {nequiWaiting && paymentStatus === 'PENDING' && (
          <PaymentPolling status="PENDING" methodLabel="Nequi" />
        )}
        {paymentStatus === 'COLLECT_READY' && collectRef && (
          <BancolombiaCollectForm onSubmit={() => {}} loading={false} reference={collectRef} amount={total} />
        )}
        {paymentStatus === 'REDIRECT_SENT' && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-center space-y-2">
            <p className="text-blue-400 font-medium">Link de pago abierto</p>
            <p className="text-blue-400/60 text-sm">Se abrió la página de pago en una nueva pestaña. El cliente debe completar el proceso allí.</p>
            <button onClick={() => { onSuccess?.(); onClose(); }} className="text-xs text-blue-400/50 hover:text-blue-400 underline">Cerrar y marcar como pendiente</button>
          </div>
        )}

        {/* Error */}
        {wompiError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm">{wompiError}</p>
          </div>
        )}

        {/* Payment form */}
        {!paymentStatus && !nequiWaiting && !wompiError && (
          <>
            {!wompiLoaded ? (
              <div className="flex items-center gap-2 justify-center py-4 text-white/30 text-sm">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                Cargando métodos de pago...
              </div>
            ) : (
              <>
                <PaymentMethodSelector selected={selectedMethod} onSelect={(m) => { setSelectedMethod(m); setPaymentError(''); }} />
                {selectedMethod && (
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
                      <PSEForm banks={pseBanks} defaultIdType={customerDocumentType || 'CC'} defaultId={customerDocumentNumber || ''} loading={paymentProcessing}
                        onSubmit={(d) => processPayment({ bankCode: d.bankCode, userType: d.userType, legalIdType: d.legalIdType, legalId: d.legalId })} />
                    )}
                    {selectedMethod === 'NEQUI' && (
                      <NequiForm defaultPhone={customerPhone || ''} loading={paymentProcessing} waiting={false}
                        onSubmit={(phoneNumber) => processPayment({ phoneNumber })} />
                    )}
                    {selectedMethod === 'BANCOLOMBIA_TRANSFER' && (
                      <BancolombiaTransferForm loading={paymentProcessing} onSubmit={() => processPayment({})} />
                    )}
                    {selectedMethod === 'BANCOLOMBIA_COLLECT' && (
                      <BancolombiaCollectForm loading={paymentProcessing} onSubmit={() => processPayment({})} />
                    )}
                    {selectedMethod === 'DAVIPLATA' && (
                      <DaviplataForm defaultIdType={customerDocumentType || 'CC'} defaultId={customerDocumentNumber || ''} loading={paymentProcessing}
                        onSubmit={(d) => processPayment({ legalId: d.legalId, legalIdType: d.legalIdType })} />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
