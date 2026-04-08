'use client';

import { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { Bell, X, Share, Plus, MoreVertical } from 'lucide-react';

type Browser = 'safari' | 'chrome-ios' | 'chrome-android' | 'other';

function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // Chrome on iOS contains CriOS
  if (/CriOS/i.test(ua)) return 'chrome-ios';
  // Chrome on Android
  if (/Chrome/i.test(ua) && !isIOS && !/Edg|OPR|Samsung/i.test(ua)) return 'chrome-android';
  // Safari: contains Safari but not Chrome
  if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return 'safari';
  return 'other';
}

export function NotificationPrompt() {
  const { promptPermission } = useNotifications();
  const [show, setShow] = useState(false);
  const [needsPWA, setNeedsPWA] = useState(false);
  const [browser, setBrowser] = useState<Browser>('other');

  useEffect(() => {
    const timer = setTimeout(() => {
      const dismissed = localStorage.getItem('push_prompt_dismissed');
      if (dismissed) return;

      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission !== 'default') return;
      }

      const detected = detectBrowser();
      setBrowser(detected);

      // Detect if iOS Safari without PWA installed
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;

      if (isIOS && !isPWA && !('Notification' in window)) {
        setNeedsPWA(true);
      }

      setShow(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const handleAccept = async () => {
    const granted = await promptPermission();
    if (granted) setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('push_prompt_dismissed', Date.now().toString());
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={handleDismiss} />
      <div
        className="fixed top-4 left-4 right-4 z-50"
        style={{ animation: 'slideDown 0.3s ease-out' }}
      >
        <style>{`@keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="mx-auto max-w-md rounded-xl border border-gold/20 bg-[#1c1710] p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10">
            <Bell className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Activar notificaciones</p>
            <p className="mt-0.5 text-xs text-white/60">
              Recibe alertas de pagos, cuestionarios y propuestas vistas.
            </p>

            {needsPWA ? (
              <div className="mt-3 space-y-2.5">
                <p className="text-xs font-medium text-gold">
                  Primero instala la app{browser === 'safari' ? ' en tu iPhone' : ''}:
                </p>

                {browser === 'chrome-ios' ? (
                  <>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">1</span>
                      <p className="text-xs text-white/70">
                        Toca el ícono <Share className="inline h-3.5 w-3.5 text-blue-400 -mt-0.5" /> de compartir (arriba)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">2</span>
                      <p className="text-xs text-white/70">
                        Busca <span className="font-medium text-white">&quot;Agregar a pantalla de inicio&quot;</span> <Plus className="inline h-3 w-3 text-white/60 -mt-0.5" />
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">3</span>
                      <p className="text-xs text-white/70">
                        Abre desde tu <span className="font-medium text-white">pantalla de inicio</span> y activa
                      </p>
                    </div>
                  </>
                ) : browser === 'chrome-android' ? (
                  <>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">1</span>
                      <p className="text-xs text-white/70">
                        Toca el menú <MoreVertical className="inline h-3.5 w-3.5 text-white/60 -mt-0.5" /> (tres puntos arriba)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">2</span>
                      <p className="text-xs text-white/70">
                        Selecciona <span className="font-medium text-white">&quot;Agregar a pantalla de inicio&quot;</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">3</span>
                      <p className="text-xs text-white/70">
                        Abre desde tu <span className="font-medium text-white">pantalla de inicio</span> y activa
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">1</span>
                      <p className="text-xs text-white/70">
                        Toca <MoreVertical className="inline h-3.5 w-3.5 text-white/60 -mt-0.5" /> (tres puntos abajo)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">2</span>
                      <p className="text-xs text-white/70">
                        Toca <span className="font-medium text-white">&quot;Compartir&quot;</span> <Share className="inline h-3.5 w-3.5 text-blue-400 -mt-0.5" />
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">3</span>
                      <p className="text-xs text-white/70">
                        Busca <span className="font-medium text-white">&quot;Agregar a inicio&quot;</span> <Plus className="inline h-3 w-3 text-white/60 -mt-0.5" />
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold">4</span>
                      <p className="text-xs text-white/70">
                        Abre desde tu <span className="font-medium text-white">pantalla de inicio</span> y activa
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleAccept}
                  className="rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-black"
                >
                  Activar
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg px-3 py-1.5 text-xs text-white/50"
                >
                  Ahora no
                </button>
              </div>
            )}

            {needsPWA && (
              <button
                onClick={handleDismiss}
                className="mt-2 text-xs text-white/40"
              >
                Ahora no
              </button>
            )}
          </div>
          <button onClick={handleDismiss} className="text-white/30">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
