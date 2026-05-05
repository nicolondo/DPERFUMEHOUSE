'use client';

import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { verifyMonabitPayment } from '@/lib/api';

interface MonabitCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providerUrl: string;
  collectionId: string;
  orderNumber: string;
}

export function MonabitCheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  providerUrl,
  collectionId,
  orderNumber,
}: MonabitCheckoutModalProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'confirming' | 'success'>('loading');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmedRef = useRef(false);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      if (confirmedRef.current) return;
      try {
        const { confirmed } = await verifyMonabitPayment(collectionId);
        if (confirmed) {
          confirmedRef.current = true;
          stopPolling();
          setStatus('success');
          setTimeout(() => {
            onSuccess();
          }, 1800);
        }
      } catch {
        // Silently continue polling
      }
    }, 3000);
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setStatus('loading');
      setIframeLoaded(false);
      confirmedRef.current = false;
      return;
    }
    // Start polling after iframe loads
  }, [isOpen]);

  useEffect(() => {
    if (iframeLoaded && isOpen && !confirmedRef.current) {
      setStatus('ready');
      startPolling();
    }
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeLoaded, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a2e] border-b border-white/10 flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-white">Pago con Tarjeta</p>
          <p className="text-xs text-white/40">Pedido #{orderNumber}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d1a] z-10">
            <Loader2 className="h-8 w-8 text-accent-purple animate-spin mb-3" />
            <p className="text-sm text-white/60">Cargando pasarela de pago…</p>
          </div>
        )}

        {/* Confirming overlay */}
        {status === 'confirming' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d1a]/90 z-10">
            <Loader2 className="h-8 w-8 text-accent-purple animate-spin mb-3" />
            <p className="text-sm text-white/60">Verificando pago…</p>
          </div>
        )}

        {/* Success overlay */}
        {status === 'success' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d1a] z-10 gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle className="h-9 w-9 text-green-400" />
            </div>
            <p className="text-lg font-bold text-white">¡Pago Confirmado!</p>
            <p className="text-sm text-white/50">Pedido #{orderNumber}</p>
          </div>
        )}

        {/* Iframe */}
        <iframe
          src={providerUrl}
          title="Pago Monabit"
          className="w-full h-full border-none"
          onLoad={() => setIframeLoaded(true)}
          allow="payment"
        />
        {/* Hide Monabit branding logo — pointer-events:none so clicks still reach iframe */}
        <div
          className="absolute pointer-events-none"
          style={{ top: 10, right: 'max(calc(50% - 275px), 8px)', width: 210, height: 85, background: '#fff', zIndex: 20 }}
        />
      </div>

      {/* Footer hint */}
      {status === 'ready' && (
        <div className="px-4 py-2 bg-[#1a1a2e] border-t border-white/10 flex-shrink-0">
          <p className="text-center text-xs text-white/30">
            El pago se confirmará automáticamente al completarse
          </p>
        </div>
      )}
    </div>
  );
}
