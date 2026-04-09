'use client';

interface BancolombiaTransferFormProps {
  onSubmit: () => void;
  loading: boolean;
}

export function BancolombiaTransferForm({ onSubmit, loading }: BancolombiaTransferFormProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 p-4 text-sm text-white/60 space-y-2">
        <p className="font-medium text-white/80">¿Cómo funciona?</p>
        <ol className="list-decimal list-inside space-y-1 text-white/50">
          <li>Haz clic en "Continuar con Bancolombia".</li>
          <li>Serás redirigido al portal de Bancolombia.</li>
          <li>Autoriza la transferencia con tu usuario y clave.</li>
          <li>Regresa automáticamente con el pago confirmado.</li>
        </ol>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-[#d3a86f] text-black font-semibold text-sm hover:bg-[#c4976a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Preparando tu pago...' : 'Continuar con Bancolombia →'}
      </button>
    </div>
  );
}
