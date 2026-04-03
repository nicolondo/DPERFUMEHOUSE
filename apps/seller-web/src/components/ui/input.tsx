'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-white/70"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl border bg-glass-100 px-4 py-3 text-base text-white transition-colors',
              'placeholder:text-white/30',
              'focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20',
              'disabled:bg-glass-50 disabled:text-white/30',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-status-danger/50 focus:border-status-danger focus:ring-status-danger/20'
                : 'border-glass-border',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-status-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1 text-sm text-white/40">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-white/70"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border bg-glass-100 px-4 py-3 text-base text-white transition-colors',
            'placeholder:text-white/30',
            'focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20',
            'disabled:bg-glass-50 disabled:text-white/30',
            error
              ? 'border-status-danger/50 focus:border-status-danger focus:ring-status-danger/20'
              : 'border-glass-border',
            className
          )}
          rows={3}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-status-danger">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
