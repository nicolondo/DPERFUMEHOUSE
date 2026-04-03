'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 sm:h-9 min-w-0 w-full rounded-lg border bg-glass-100 px-3 py-1.5 text-sm text-white',
          'placeholder:text-white/30',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'transition-colors',
          error
            ? 'border-status-danger/50 focus:ring-status-danger/20'
            : 'border-glass-border focus:border-accent-purple/50 focus:ring-accent-purple/20',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 sm:h-9 min-w-0 w-full rounded-lg border bg-glass-100 px-3 py-1.5 text-sm text-white',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'transition-colors',
          error
            ? 'border-status-danger/50 focus:ring-status-danger/20'
            : 'border-glass-border focus:border-accent-purple/50 focus:ring-accent-purple/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] min-w-0 w-full rounded-lg border bg-glass-100 px-3 py-2 text-sm text-white',
          'placeholder:text-white/30',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'transition-colors',
          error
            ? 'border-status-danger/50 focus:ring-status-danger/20'
            : 'border-glass-border focus:border-accent-purple/50 focus:ring-accent-purple/20',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
