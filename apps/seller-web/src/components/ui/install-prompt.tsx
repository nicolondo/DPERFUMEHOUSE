'use client';

import { useState, useEffect } from 'react';

type Browser = 'safari' | 'chrome' | 'other';

function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;

  // iOS Safari (not Chrome on iOS)
  if (/iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)) {
    return 'safari';
  }
  // Safari on macOS
  if (/^((?!chrome|android).)*safari/i.test(ua)) {
    return 'safari';
  }
  // Chrome / Chromium-based
  if (/Chrome|CriOS/i.test(ua)) {
    return 'chrome';
  }
  return 'other';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

const DISMISS_KEY = 'dph-install-prompt-dismissed';

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [browser, setBrowser] = useState<Browser>('other');

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isStandalone()) return;

    // Don't show if dismissed in the last 7 days
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
    }

    setBrowser(detectBrowser());
    // Small delay so it doesn't flash during page load
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-in fade-in duration-300"
      onClick={dismiss}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl border border-[hsl(40,20%,20%)] bg-[hsl(40,30%,8%)] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 pb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(36,25%,53%)] to-[hsl(37,48%,79%)] flex items-center justify-center shadow-lg">
            <span className="text-2xl">✨</span>
          </div>
          <div>
            <h3 className="text-[hsl(40,20%,97%)] font-semibold text-base">
              Instalar D Perfume House
            </h3>
            <p className="text-[hsl(40,20%,55%)] text-xs mt-0.5">
              Acceso rápido desde tu inicio
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-5 pb-4">
          {browser === 'safari' ? <SafariSteps /> : <ChromeSteps />}
        </div>

        {/* Footer */}
        <div className="flex border-t border-[hsl(40,20%,15%)] divide-x divide-[hsl(40,20%,15%)]">
          <button
            onClick={dismiss}
            className="flex-1 py-3.5 text-sm text-[hsl(40,20%,50%)] hover:text-[hsl(40,20%,70%)] transition-colors"
          >
            Ahora no
          </button>
          <button
            onClick={dismiss}
            className="flex-1 py-3.5 text-sm font-semibold text-[hsl(36,25%,60%)] hover:text-[hsl(36,25%,75%)] transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function SafariSteps() {
  return (
    <div className="space-y-3">
      <Step
        number={1}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="16,6 12,2 8,6" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
          </svg>
        }
        text={
          <>
            Toca el botón <span className="text-[hsl(36,25%,65%)] font-medium">Compartir</span>{' '}
            <InlineShareIcon /> en la barra inferior
          </>
        }
      />
      <Step
        number={2}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round" />
            <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
          </svg>
        }
        text={
          <>
            Desplázate y selecciona{' '}
            <span className="text-[hsl(36,25%,65%)] font-medium">"Agregar a Inicio"</span>
          </>
        }
      />
      <Step
        number={3}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <polyline points="20,6 9,17 4,12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text={
          <>
            Toca <span className="text-[hsl(36,25%,65%)] font-medium">"Agregar"</span> para confirmar
          </>
        }
      />
    </div>
  );
}

function ChromeSteps() {
  return (
    <div className="space-y-3">
      <Step
        number={1}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        }
        text={
          <>
            Toca el menú <span className="text-[hsl(36,25%,65%)] font-medium">⋮</span> (tres puntos)
            en la esquina superior derecha
          </>
        }
      />
      <Step
        number={2}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text={
          <>
            Selecciona{' '}
            <span className="text-[hsl(36,25%,65%)] font-medium">"Agregar a pantalla de inicio"</span>{' '}
            o <span className="text-[hsl(36,25%,65%)] font-medium">"Instalar app"</span>
          </>
        }
      />
      <Step
        number={3}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <polyline points="20,6 9,17 4,12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text={
          <>
            Confirma tocando <span className="text-[hsl(36,25%,65%)] font-medium">"Instalar"</span>
          </>
        }
      />
    </div>
  );
}

function Step({
  number,
  icon,
  text,
}: {
  number: number;
  icon: React.ReactNode;
  text: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[hsl(40,20%,13%)] border border-[hsl(40,20%,18%)] flex items-center justify-center text-[hsl(36,25%,55%)]">
        {icon}
      </div>
      <div className="pt-1">
        <p className="text-[hsl(40,20%,80%)] text-sm leading-snug">{text}</p>
      </div>
    </div>
  );
}

function InlineShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="hsl(36,25%,65%)"
      strokeWidth={2}
      className="inline w-4 h-4 -mt-0.5"
    >
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16,6 12,2 8,6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
    </svg>
  );
}
