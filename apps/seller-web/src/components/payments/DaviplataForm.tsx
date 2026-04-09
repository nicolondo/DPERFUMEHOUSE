'use client';

import { useState } from 'react';

interface DaviplataFormProps {
  defaultIdType?: string;
  defaultId?: string;
  onSubmit: (data: { legalId: string; legalIdType: string }) => void;
  loading: boolean;
}

const ID_TYPES = [
  { value: 'CC', label: 'CC · Cédula de Ciudadanía' },
  { value: 'CE', label: 'CE · Cédula de Extranjería' },
  { value: 'TI', label: 'TI · Tarjeta de Identidad' },
  { value: 'PP', label: 'PP · Pasaporte' },
];

export function DaviplataForm({
  defaultIdType = 'CC',
  defaultId = '',
  onSubmit,
  loading,
}: DaviplataFormProps) {
  const [legalIdType, setLegalIdType] = useState(defaultIdType);
  const [legalId, setLegalId] = useState(defaultId);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!legalId.trim()) {
      setError('Ingresa tu número de documento.');
      return;
    }
    onSubmit({ legalId: legalId.trim(), legalIdType });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 p-4 text-sm text-white/60">
        <p className="font-medium text-white/80 mb-1">Pago con Daviplata</p>
        <p className="text-white/40">
          Ingresa tu documento. Serás redirigido a Wompi para completar el OTP con tu número Daviplata.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-white/50 mb-1 block">Tipo de doc.</label>
          <select
            value={legalIdType}
            onChange={(e) => setLegalIdType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm focus:outline-none focus:border-[#d3a86f]/50"
          >
            {ID_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.value}</option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <label className="text-xs text-white/50 mb-1 block">Número de documento</label>
          <input
            type="text"
            inputMode="numeric"
            value={legalId}
            onChange={(e) => setLegalId(e.target.value.replace(/\D/g, ''))}
            placeholder="Número"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-[#d3a86f] text-black font-semibold text-sm hover:bg-[#c4976a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Redirigiendo a Daviplata...' : 'Continuar con Daviplata'}
      </button>
    </form>
  );
}
