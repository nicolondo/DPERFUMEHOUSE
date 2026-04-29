'use client';

import { useState } from 'react';

interface CardFormProps {
  publicKey: string;
  onToken: (token: string, installments: number) => void;
  loading: boolean;
}

function formatCardNumber(value: string) {
  return value.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').substring(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 12, 24];

const WOMPI_TOKENS_URL_SANDBOX = 'https://sandbox.wompi.co/v1/tokens/cards';
const WOMPI_TOKENS_URL_PROD    = 'https://production.wompi.co/v1/tokens/cards';

export function CardForm({ publicKey, onToken, loading }: CardFormProps) {
  const [number, setNumber] = useState('');
  const [cvv, setCvv] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holder, setHolder] = useState('');
  const [installments, setInstallments] = useState(1);
  const [tokenizing, setTokenizing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const isProd = publicKey.startsWith('pub_prod');
  const tokensUrl = isProd ? WOMPI_TOKENS_URL_PROD : WOMPI_TOKENS_URL_SANDBOX;

  async function handleTokenize(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const [mm, yy] = expiry.split('/');
    if (!mm || !yy || !number || !cvv || !holder) {
      setError('Completa todos los campos de la tarjeta.');
      return;
    }

    setTokenizing(true);
    try {
      const res = await fetch(tokensUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicKey}`,
        },
        body: JSON.stringify({
          number: number.replace(/\s/g, ''),
          cvc: cvv,
          exp_month: mm.padStart(2, '0'),
          exp_year: yy,
          card_holder: holder,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result?.data?.id) {
        const msg = result?.error?.messages
          ? Object.values(result.error.messages).flat().join(', ')
          : 'Error al tokenizar la tarjeta.';
        throw new Error(msg as string);
      }

      onToken(result.data.id, installments);
    } catch (err: any) {
      setError(err.message || 'Error al tokenizar la tarjeta.');
    } finally {
      setTokenizing(false);
    }
  }

  const handleCardScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanning(true);
    try {
      // Read file → load into Image → draw on canvas (downscaled) → JPEG base64
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });
      const maxW = 1280;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(img, 0, 0, w, h);
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = jpegDataUrl.split(',')[1];
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.number) setNumber(data.number.replace(/(.{4})/g, '$1 ').trim());
        if (data.expiry) setExpiry(data.expiry);
        if (data.name) setHolder(data.name);
      }
    } catch {
      // silent
    } finally {
      setScanning(false);
    }
  };

  return (
    <form onSubmit={handleTokenize} className="space-y-4">
      <div>
        <label className="text-xs text-white/50 mb-1 block">Número de tarjeta</label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 5678 9012 3456"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50 font-mono tracking-widest"
          />
          {/* AI card scan */}
          <label
            title="Escanear tarjeta con IA"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#d3a86f]/50 hover:text-[#d3a86f] transition-colors"
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleCardScan}
            />
            {scanning ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Vencimiento</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/AA"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50 font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">CVV / CVC</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="•••"
            maxLength={4}
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50 font-mono"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-white/50 mb-1 block">Nombre en la tarjeta</label>
        <input
          type="text"
          autoComplete="cc-name"
          placeholder="Como aparece en la tarjeta"
          value={holder}
          onChange={(e) => setHolder(e.target.value.toUpperCase())}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50 uppercase"
        />
      </div>
      <div>
        <label className="text-xs text-white/50 mb-2 block">Cuotas</label>
        <div className="flex flex-wrap gap-2">
          {INSTALLMENT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setInstallments(n)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                installments === n
                  ? 'bg-[#d3a86f] text-black'
                  : 'bg-[#1a1610] border border-[#d3a86f]/20 text-white/60 hover:border-[#d3a86f]/40'
              }`}
            >
              {n === 1 ? 'Contado' : `${n}x`}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={tokenizing || loading}
        className="w-full py-3 rounded-xl bg-[#d3a86f] text-black font-semibold text-sm hover:bg-[#c4976a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {tokenizing ? 'Verificando tarjeta...' : loading ? 'Procesando...' : 'Pagar con tarjeta'}
      </button>
    </form>
  );
}
