'use client';

import { useState, useCallback, useEffect } from 'react';

/* ------------------------------------------------------------------ */
/*  WompiAcceptance                                                   */
/* ------------------------------------------------------------------ */
export function WompiAcceptance({
  checked,
  onChange,
  permalink,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  permalink: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
            checked
              ? 'bg-[#d3a86f] border-[#d3a86f]'
              : 'bg-transparent border-[#d3a86f]/30 group-hover:border-[#d3a86f]/60'
          }`}
        >
          {checked && (
            <svg
              className="w-3 h-3 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-white/60 leading-snug">
        He leído y acepto los{' '}
        <a
          href={permalink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#d3a86f] underline underline-offset-2 hover:text-[#d3a86f]/80"
        >
          términos y condiciones
        </a>{' '}
        de Wompi para el procesamiento de pagos.
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  PaymentMethodSelector                                             */
/* ------------------------------------------------------------------ */
const paymentMethods = [
  {
    id: 'CARD',
    label: 'Tarjeta',
    description: 'Crédito o débito',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  {
    id: 'PSE',
    label: 'PSE',
    description: 'Débito bancario',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    ),
  },
  {
    id: 'NEQUI',
    label: 'Nequi',
    description: 'Pago por app',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
      </svg>
    ),
  },
  {
    id: 'BANCOLOMBIA_TRANSFER',
    label: 'Bancolombia',
    description: 'Transferencia',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    id: 'BANCOLOMBIA_COLLECT',
    label: 'Corresponsal',
    description: 'Pago en efectivo',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
      </svg>
    ),
  },
];

export function PaymentMethodSelector({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
        Método de pago
      </p>
      <div className="grid grid-cols-3 gap-2">
        {paymentMethods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
              selected === m.id
                ? 'border-[#d3a86f] bg-[#d3a86f]/10 text-[#d3a86f]'
                : 'border-[#d3a86f]/15 bg-[#1a1610] text-white/50 hover:border-[#d3a86f]/30 hover:text-white/70'
            }`}
          >
            <span className={selected === m.id ? 'text-[#d3a86f]' : 'text-white/40'}>
              {m.icon}
            </span>
            <span className="text-xs font-semibold leading-none">{m.label}</span>
            <span className="text-[10px] leading-none opacity-70">{m.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CardForm                                                          */
/* ------------------------------------------------------------------ */
const installmentOptions = [1, 2, 3, 6, 12, 24];

export function CardForm({
  publicKey,
  onToken,
  loading,
}: {
  publicKey: string;
  onToken: (token: string, installments: number) => void;
  loading: boolean;
}) {
  const [cardNumber, setCardNumber] = useState('');
  const [cvc, setCvc] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [installments, setInstallments] = useState(1);
  const [tokenizing, setTokenizing] = useState(false);
  const [error, setError] = useState('');

  const tokenUrl = publicKey.startsWith('pub_prod')
    ? 'https://production.wompi.co/v1/tokens/cards'
    : 'https://sandbox.wompi.co/v1/tokens/cards';

  function formatExpiry(val: string) {
    const digits = val.replace(/\D/g, '').substring(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const [month, year] = expiry.split('/');
    if (!month || !year || !cardNumber || !cvc || !cardHolder) {
      setError('Completa todos los campos de la tarjeta.');
      return;
    }

    setTokenizing(true);
    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicKey}`,
        },
        body: JSON.stringify({
          number: cardNumber.replace(/\s/g, ''),
          cvc,
          exp_month: month.padStart(2, '0'),
          exp_year: year,
          card_holder: cardHolder,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.data?.id) {
        const msg = data?.error?.messages
          ? Object.values(data.error.messages).flat().join(', ')
          : 'Error al tokenizar la tarjeta.';
        throw new Error(msg);
      }

      onToken(data.data.id, installments);
    } catch (err: any) {
      setError(err.message || 'Error al tokenizar la tarjeta.');
    } finally {
      setTokenizing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-white/50 mb-1 block">Número de tarjeta</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="1234 5678 9012 3456"
          value={cardNumber}
          onChange={(e) =>
            setCardNumber(
              e.target.value
                .replace(/\D/g, '')
                .substring(0, 16)
                .replace(/(.{4})/g, '$1 ')
                .trim(),
            )
          }
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50 font-mono tracking-widest"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Vencimiento</label>
          <input
            type="text"
            inputMode="numeric"
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
            placeholder="•••"
            maxLength={4}
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').substring(0, 4))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50 font-mono"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1 block">Nombre en la tarjeta</label>
        <input
          type="text"
          placeholder="Como aparece en la tarjeta"
          value={cardHolder}
          onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50 uppercase"
        />
      </div>

      <div>
        <label className="text-xs text-white/50 mb-2 block">Cuotas</label>
        <div className="flex flex-wrap gap-2">
          {installmentOptions.map((n) => (
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

      {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>}

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

/* ------------------------------------------------------------------ */
/*  NequiForm                                                         */
/* ------------------------------------------------------------------ */
export function NequiForm({
  defaultPhone = '',
  onSubmit,
  loading,
  waiting = false,
}: {
  defaultPhone?: string;
  onSubmit: (phone: string) => void;
  loading: boolean;
  waiting?: boolean;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState('');

  if (waiting) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full border-4 border-[#d3a86f]/30 border-t-[#d3a86f] animate-spin" />
        </div>
        <div>
          <p className="text-white font-semibold">Revisa tu app de Nequi</p>
          <p className="text-white/50 text-sm mt-1">
            Abre Nequi y acepta la solicitud de pago.
            <br />
            Esta pantalla se actualizará automáticamente.
          </p>
        </div>
        <p className="text-white/30 text-xs">
          ¿No llegó la notificación? Cierra y vuelve a abrir Nequi.
        </p>
      </div>
    );
  }

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
      {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>}
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

/* ------------------------------------------------------------------ */
/*  BancolombiaTransferForm                                           */
/* ------------------------------------------------------------------ */
export function BancolombiaTransferForm({
  onSubmit,
  loading,
}: {
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 p-4 text-sm text-white/60 space-y-2">
        <p className="font-medium text-white/80">¿Cómo funciona?</p>
        <ol className="list-decimal list-inside space-y-1 text-white/50">
          <li>Haz clic en &quot;Continuar con Bancolombia&quot;.</li>
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

/* ------------------------------------------------------------------ */
/*  BancolombiaCollectForm                                            */
/* ------------------------------------------------------------------ */
interface CollectReference {
  businessAgreementCode: string;
  paymentIntentionIdentifier: string;
}

export function BancolombiaCollectForm({
  onSubmit,
  loading,
  reference,
  amount,
}: {
  onSubmit: () => void;
  loading: boolean;
  reference?: CollectReference;
  amount?: number;
}) {
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
          <li>Haz clic en &quot;Generar referencia&quot;.</li>
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

/* ------------------------------------------------------------------ */
/*  DaviplataForm                                                     */
/* ------------------------------------------------------------------ */
const daviplataDocTypes = [
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
}: {
  defaultIdType?: string;
  defaultId?: string;
  onSubmit: (data: { legalId: string; legalIdType: string }) => void;
  loading: boolean;
}) {
  const [idType, setIdType] = useState(defaultIdType);
  const [idNumber, setIdNumber] = useState(defaultId);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!idNumber.trim()) {
      setError('Ingresa tu número de documento.');
      return;
    }
    onSubmit({ legalId: idNumber.trim(), legalIdType: idType });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 p-4 text-sm text-white/60">
        <p className="font-medium text-white/80 mb-1">Pago con Daviplata</p>
        <p className="text-white/40">
          Ingresa tu documento. Serás redirigido a Wompi para completar el OTP con tu número
          Daviplata.
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-white/50 mb-1 block">Tipo de doc.</label>
          <select
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white text-sm focus:outline-none focus:border-[#d3a86f]/50"
          >
            {daviplataDocTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.value}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <label className="text-xs text-white/50 mb-1 block">Número de documento</label>
          <input
            type="text"
            inputMode="numeric"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="Número"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1610] border border-[#d3a86f]/15 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#d3a86f]/50"
          />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">{error}</p>}
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

/* ------------------------------------------------------------------ */
/*  PaymentResult                                                     */
/* ------------------------------------------------------------------ */
export function PaymentResult({
  status,
  methodLabel,
  onRetry,
  onContinue,
}: {
  status: string;
  methodLabel?: string;
  onRetry?: () => void;
  onContinue?: () => void;
}) {
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
          <p className="text-red-400 font-bold text-lg">
            Pago {status === 'DECLINED' ? 'rechazado' : 'fallido'}
          </p>
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

  // PENDING
  return (
    <div className="text-center py-8 space-y-4">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-[#d3a86f]/20 border-t-[#d3a86f] animate-spin" />
      </div>
      <div>
        <p className="text-white font-semibold">Procesando tu pago</p>
        <p className="text-white/50 text-sm mt-1">
          {methodLabel
            ? `Esperando confirmación de ${methodLabel}...`
            : 'Verificando estado del pago...'}
        </p>
      </div>
      {methodLabel === 'Nequi' && (
        <div className="mt-4 mx-auto max-w-xs rounded-xl border border-[#d3a86f]/20 bg-[#d3a86f]/5 px-4 py-3 text-left space-y-2">
          <p className="text-[#d3a86f] text-xs font-semibold uppercase tracking-wider">
            ¿Cómo confirmar el pago?
          </p>
          <ol className="text-white/70 text-sm space-y-1 list-none">
            <li className="flex gap-2">
              <span className="text-[#d3a86f] font-bold">1.</span> Abre la app de{' '}
              <span className="text-white font-medium">Nequi</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#d3a86f] font-bold">2.</span> Ve a{' '}
              <span className="text-white font-medium">Notificaciones</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#d3a86f] font-bold">3.</span> Acepta el cobro pendiente
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
