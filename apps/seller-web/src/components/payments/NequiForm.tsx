'use client';

import { useState } from 'react';

interface NequiFormProps {
  defaultPhone?: string;
  onSubmit: (phoneNumber: string) => void;
  loading: boolean;
  /** When set, shows "waiting for Nequi" polling screen */
  waiting?: boolean;
}

export function NequiForm({ defaultPhone = '', onSubmit, loading, waiting = false }: NequiFormProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Ingresa tu número celular Nequi de 10 dígitos.');
      return;
    }
    onSubmit(digits);
  }

  if (waiting) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full border-4 border-[#d3a86f]/30 border-t-[#d3a86f] animate-spin" />
        </div>
        <div>
          <p className="text-white font-semibold">Revisa tu app de Nequi</p>
          <p className="text-white/50 text-sm mt-1">
            Abre Nequi y acepta la solicitud de pago.<br />
            Esta pantalla se actualizará automáticamente.
          </p>
        </div>
        <p className="text-white/30 text-xs">
          ¿No llegó la notificación? Cierra y vuelve a abrir Nequi.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-white/50 mb-1 block">Número celular Nequi</label>
        <div className="flex items-center rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 overflow-hidden focus-within:border-[#d3a86f]/50">
          <span className="pl-3.5 pr-2 text-white/40 text-sm font-mono">+57</span>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="300 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').substring(0, 10))}
            className="flex-1 py-2.5 pr-3.5 bg-transparent text-white placeholder:text-white/20 text-sm focus:outline-none"
          />
        </div>
        <p className="text-white/30 text-xs mt-1">
          Ingresa el número que tienes asociado a tu cuenta Nequi.
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-[#d3a86f] text-black font-semibold text-sm hover:bg-[#c4976a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Enviando solicitud...' : 'Pagar con Nequi'}
      </button>
    </form>
  );
}
