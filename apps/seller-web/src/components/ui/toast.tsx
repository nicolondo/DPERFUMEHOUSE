'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  isExiting?: boolean;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-status-success" />,
  error: <XCircle className="h-5 w-5 text-status-danger" />,
  info: <Info className="h-5 w-5 text-status-info" />,
};

const bgStyles: Record<ToastType, string> = {
  success: 'bg-surface-raised/95 border-status-success/20 backdrop-blur-xl',
  error: 'bg-surface-raised/95 border-status-danger/20 backdrop-blur-xl',
  info: 'bg-surface-raised/95 border-status-info/20 backdrop-blur-xl',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, type, message }]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-0 inset-x-0 z-[100] flex flex-col items-center gap-2 pt-safe-top p-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 shadow-lg',
              bgStyles[toast.type],
              toast.isExiting ? 'animate-toast-out' : 'animate-toast-in'
            )}
          >
            {icons[toast.type]}
            <p className="flex-1 text-sm font-medium text-white">
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/40 hover:text-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
