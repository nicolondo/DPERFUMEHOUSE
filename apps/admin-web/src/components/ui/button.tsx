'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent-purple text-white hover:bg-accent-purple-light shadow-glow-purple disabled:opacity-30',
  secondary: 'bg-glass-200 text-white/70 hover:bg-glass-300 hover:text-white disabled:opacity-30',
  danger: 'bg-status-danger text-white hover:opacity-90 disabled:opacity-30',
  ghost: 'text-white/60 hover:bg-glass-100 hover:text-white disabled:opacity-30',
  outline: 'border border-glass-border-light bg-transparent text-white/70 hover:bg-glass-100 hover:text-white disabled:opacity-30',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 sm:h-8 px-3 text-xs gap-1.5',
  md: 'h-10 sm:h-9 px-3 sm:px-4 text-sm gap-2',
  lg: 'h-11 px-5 sm:px-6 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
