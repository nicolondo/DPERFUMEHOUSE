'use client';

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
  fullHeight?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  showClose = true,
  fullHeight = false,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="backdrop animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet on mobile, centered on desktop */}
      <div
        className={cn(
          'fixed z-[60] animate-slide-up bg-surface-raised border border-glass-border shadow-glass backdrop-blur-xl',
          'inset-x-0 bottom-0 rounded-t-3xl pb-safe-bottom',
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0 sm:w-full sm:max-w-lg',
          fullHeight ? 'top-12 sm:top-1/2 sm:max-h-[85vh]' : 'max-h-[85vh]',
          className
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between px-4 pb-3">
            <h2 className="text-lg font-semibold text-white">
              {title}
            </h2>
            {showClose && (
              <button
                onClick={onClose}
                className="touch-target flex items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-glass-200"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={cn('overflow-y-auto overflow-x-visible px-4 pb-24', fullHeight ? 'flex-1' : 'max-h-[70vh]')}>
          {children}
        </div>
      </div>
    </div>
  );
}
