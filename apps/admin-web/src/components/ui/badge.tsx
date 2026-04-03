'use client';

import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'orange' | 'brown';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-glass-200 text-white/70',
  success: 'bg-status-success-muted text-status-success',
  warning: 'bg-status-warning-muted text-status-warning',
  danger: 'bg-status-danger-muted text-status-danger',
  info: 'bg-accent-purple-muted text-accent-purple',
  outline: 'border border-glass-border text-white/60',
  orange: 'bg-status-orange-muted text-status-orange',
  brown: 'bg-status-brown-muted text-status-brown',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
