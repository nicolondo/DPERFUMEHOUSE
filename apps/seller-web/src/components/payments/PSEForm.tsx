'use client';

import { useState, useMemo } from 'react';

interface Bank {
  financial_institution_code: string;
  financial_institution_name: string;
}

interface PSEFormProps {
  banks: Bank[];
  defaultIdType?: string;
  defaultId?: string;
  onSubmit: (data: {
    bankCode: string;
    userType: number;
    legalIdType: string;
    legalId: string;
  }) => void;
  loading: boolean;
}

const ID_TYPES = [
  { value: 'CC', label: 'CC · Cédula de Ciudadanía' },
  { value: 'CE', label: 'CE · Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PP', label: 'PP · Pasaporte' },
  { value: 'TI', label: 'TI · Tarjeta de Identidad' },
];

export function PSEForm({ banks, defaultIdType = 'CC', defaultId = '', onSubmit, loading }: PSEFormProps) {
  const [bankCode, setBankCode] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [userType, setUserType] = useState<0 | 1>(0);
  const [legalIdType, setLegalIdType] = useState(defaultIdType);
  const [legalId, setLegalId] = useState(defaultId);
  const [error, setError] = useState('');

  const PRIORITY_BANKS = ['BANCOLOMBIA', 'DAVIVIENDA'];

  const filteredBanks = useMemo(() => {
    const list = banks
      .filter((b) => b.financial_institution_code !== '0')
      .filter((b) =>
        b.financial_institution_name.toLowerCase().includes(bankSearch.toLowerCase()),
      );

    return list.sort((a, b) => {
      const ai = PRIORITY_BANKS.findIndex((p) => a.financial_institution_name.toUpperCase().includes(p));
      const bi = PRIORITY_BANKS.findIndex((p) => b.financial_institution_name.toUpperCase().includes(p));
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      return aRank - bRank;
    });
  }, [banks, bankSearch]);

  const selectedBank = banks.find((b) => b.financial_institution_code === bankCode);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!bankCode) { setError('Selecciona un banco.'); return; }
    if (!legalId.trim()) { setError('Ingresa tu número de documento.'); return; }
    onSubmit({ bankCode, userType, legalIdType, legalId: legalId.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Bank selector */}
      <div className="relative">
        <label className="text-xs text-white/50 mb-1 block">Banco</label>
        <button
          type="button"
          onClick={() => setBankOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-sm hover:border-[#d3a86f]/30 transition-colors"
        >
          <span className={selectedBank ? 'text-white' : 'text-white/25'}>
            {selectedBank ? selectedBank.financial_institution_name : 'Selecciona tu banco'}
          </span>
          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>

        {bankOpen && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl bg-[#1a1610] border border-[#d3a86f]/20 shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-white/5">
              <input
                type="text"
                placeholder="Buscar banco..."
                autoFocus
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 text-white text-sm placeholder:text-white/25 focus:outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredBanks.map((b) => (
                <button
                  key={b.financial_institution_code}
                  type="button"
                  onClick={() => {
                    setBankCode(b.financial_institution_code);
                    setBankOpen(false);
                    setBankSearch('');
                  }}
                  className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                    bankCode === b.financial_institution_code
                      ? 'bg-[#d3a86f]/10 text-[#d3a86f]'
                      : 'text-white/70 hover:bg-[#d3a86f]/5'
                  }`}
                >
                  {b.financial_institution_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Person type */}
      <div>
        <label className="text-xs text-white/50 mb-2 block">Tipo de persona</label>
        <div className="flex gap-3">
          {([0, 1] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setUserType(type)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                userType === type
                  ? 'border-[#d3a86f] bg-[#d3a86f]/10 text-[#d3a86f]'
                  : 'border-[#d3a86f]/15 bg-[#1a1610] text-white/50 hover:border-[#d3a86f]/30'
              }`}
            >
              {type === 0 ? 'Persona Natural' : 'Persona Jurídica'}
            </button>
          ))}
        </div>
      </div>

      {/* ID */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-white/50 mb-1 block">Tipo</label>
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
        {loading ? 'Redirigiendo al banco...' : 'Continuar con PSE'}
      </button>
    </form>
  );
}
