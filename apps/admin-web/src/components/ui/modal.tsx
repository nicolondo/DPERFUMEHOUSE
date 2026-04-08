'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        mouseDownTarget.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current && mouseDownTarget.current === overlayRef.current) {
          onClose();
        }
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
      <div
        className={cn(
          'relative z-10 w-full rounded-2xl border border-glass-border bg-surface-raised shadow-glass backdrop-blur-xl',
          'max-h-[90vh] overflow-y-auto',
          sizeClasses[size],
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-glass-border px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/40 hover:bg-glass-200 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4">{children}</div>
      </div>
    </div>
  );
}
