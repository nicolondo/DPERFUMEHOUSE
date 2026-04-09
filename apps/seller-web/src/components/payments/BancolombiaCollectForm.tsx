'use client';

interface BancolombiaCollectFormProps {
  onSubmit: () => void;
  loading: boolean;
  /** After payment is created, show these reference numbers */
  reference?: {
    businessAgreementCode: string;
    paymentIntentionIdentifier: string;
  } | null;
  amount?: number;
}

export function BancolombiaCollectForm({
  onSubmit,
  loading,
  reference,
  amount,
}: BancolombiaCollectFormProps) {
  if (reference) {
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/15 mb-3">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold">¡Pago generado!</p>
          <p className="text-white/50 text-sm mt-1">
            Dirígete a cualquier corresponsal Bancolombia con estos datos:
          </p>
        </div>

        <div className="rounded-xl bg-[#1a1610] border border-[#d3a86f]/20 divide-y divide-white/5">
          <div className="px-4 py-3">
            <p className="text-xs text-white/40 mb-0.5">No. de Convenio</p>
            <p className="text-lg font-mono font-bold text-[#d3a86f] tracking-wider">
              {reference.businessAgreementCode}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-white/40 mb-0.5">No. de Pago</p>
            <p className="text-lg font-mono font-bold text-white tracking-wider">
              {reference.paymentIntentionIdentifier}
            </p>
          </div>
          {amount !== undefined && (
            <div className="px-4 py-3">
              <p className="text-xs text-white/40 mb-0.5">Valor a pagar</p>
              <p className="text-lg font-semibold text-white">
                ${amount.toLocaleString('es-CO')} COP
              </p>
            </div>
          )}
        </div>

        <p className="text-white/30 text-xs text-center">
          Guarda estos datos — los necesitarás en el corresponsal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 p-4 text-sm text-white/60 space-y-2">
        <p className="font-medium text-white/80">Pago en corresponsal Bancolombia</p>
        <ol className="list-decimal list-inside space-y-1 text-white/50">
          <li>Haz clic en "Generar referencia".</li>
          <li>Recibirás un número de convenio y un número de pago.</li>
          <li>Ve a cualquier corresponsal Bancolombia (cajeros, tiendas, etc.).</li>
          <li>Proporciona los números para completar el pago en efectivo.</li>
        </ol>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-[#d3a86f] text-black font-semibold text-sm hover:bg-[#c4976a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Generando referencia...' : 'Generar referencia de pago'}
      </button>
    </div>
  );
}
