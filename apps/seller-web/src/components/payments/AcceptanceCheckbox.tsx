'use client';

interface AcceptanceCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  permalink: string;
}

export function AcceptanceCheckbox({ checked, onChange, permalink }: AcceptanceCheckboxProps) {
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
            <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
