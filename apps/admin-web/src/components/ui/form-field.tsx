'use client';

import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}

export function FormField({ label, error, required, children, className, hint }: FormFieldProps) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <label className="block text-sm font-medium text-white/70">
        {label}
        {required && <span className="ml-0.5 text-status-danger">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-white/40">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-status-danger">{error}</p>
      )}
    </div>
  );
}
