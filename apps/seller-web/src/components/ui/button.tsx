'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-purple text-white hover:bg-accent-purple-light active:opacity-90 disabled:opacity-30',
  secondary:
    'bg-accent-gold text-surface hover:bg-accent-gold-light active:opacity-90 disabled:opacity-30',
  outline:
    'border border-glass-border-light text-white bg-transparent hover:bg-glass-200 active:bg-glass-300 disabled:opacity-30',
  ghost:
    'text-white/70 bg-transparent hover:bg-glass-100 active:bg-glass-200 disabled:opacity-30',
  danger:
    'bg-status-danger text-white hover:opacity-90 active:opacity-80 disabled:opacity-30',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-base rounded-xl gap-2',
  lg: 'h-13 px-6 text-lg rounded-xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-150 touch-target',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          (disabled || loading) && 'pointer-events-none opacity-70',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
