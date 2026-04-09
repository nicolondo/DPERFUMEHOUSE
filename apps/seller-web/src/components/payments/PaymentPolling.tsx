'use client';

type PollingStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | string;

interface PaymentPollingProps {
  status: PollingStatus;
  methodLabel?: string;
  onRetry?: () => void;
  onContinue?: () => void;
}

export function PaymentPolling({ status, methodLabel, onRetry, onContinue }: PaymentPollingProps) {
  if (status === 'APPROVED') {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 mb-2">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-green-400 font-bold text-lg">¡Pago aprobado!</p>
          <p className="text-white/50 text-sm mt-1">Tu pago fue procesado exitosamente.</p>
        </div>
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="mt-2 px-6 py-2.5 rounded-xl bg-[#d3a86f] text-black font-semibold text-sm hover:bg-[#c4976a] transition-all"
          >
            Ver mi pedido
          </button>
        )}
      </div>
    );
  }

  if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/15 mb-2">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <p className="text-red-400 font-bold text-lg">Pago {status === 'DECLINED' ? 'rechazado' : 'fallido'}</p>
          <p className="text-white/50 text-sm mt-1">
            {status === 'DECLINED'
              ? 'Tu pago fue rechazado. Verifica tus datos o intenta con otro método.'
              : 'Ocurrió un error al procesar el pago. Intenta de nuevo.'}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 px-6 py-2.5 rounded-xl border border-[#d3a86f]/40 text-[#d3a86f] font-semibold text-sm hover:bg-[#d3a86f]/10 transition-all"
          >
            Intentar de nuevo
          </button>
        )}
      </div>
    );
  }

  // PENDING / default — spinner
  return (
    <div className="text-center py-8 space-y-4">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-[#d3a86f]/20 border-t-[#d3a86f] animate-spin" />
      </div>
      <div>
        <p className="text-white font-semibold">Procesando tu pago</p>
        <p className="text-white/50 text-sm mt-1">
          {methodLabel ? `Esperando confirmación de ${methodLabel}...` : 'Verificando estado del pago...'}
        </p>
      </div>
      {methodLabel === 'Nequi' && (
        <div className="mt-4 mx-auto max-w-xs rounded-xl border border-[#d3a86f]/20 bg-[#d3a86f]/5 px-4 py-3 text-left space-y-2">
          <p className="text-[#d3a86f] text-xs font-semibold uppercase tracking-wider">¿Cómo confirmar el pago?</p>
          <ol className="text-white/70 text-sm space-y-1 list-none">
            <li className="flex gap-2"><span className="text-[#d3a86f] font-bold">1.</span> Abre la app de <span className="text-white font-medium">Nequi</span></li>
            <li className="flex gap-2"><span className="text-[#d3a86f] font-bold">2.</span> Ve a <span className="text-white font-medium">Notificaciones</span></li>
            <li className="flex gap-2"><span className="text-[#d3a86f] font-bold">3.</span> Acepta el cobro pendiente</li>
          </ol>
        </div>
      )}
    </div>
  );
}
