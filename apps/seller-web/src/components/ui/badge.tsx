'use client';

import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'orange' | 'brown';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-glass-200 text-white/70',
  success: 'bg-status-success-muted text-status-success',
  warning: 'bg-status-warning-muted text-status-warning',
  danger: 'bg-status-danger-muted text-status-danger',
  info: 'bg-status-info-muted text-status-info',
  purple: 'bg-accent-purple-muted text-accent-purple',
  orange: 'bg-status-orange-muted text-status-orange',
  brown: 'bg-status-brown-muted text-status-brown',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'status-pill uppercase',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Convenience mappers
const orderStatusMap: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Borrador', variant: 'default' },
  PENDING_PAYMENT: { label: 'Pago Pendiente', variant: 'warning' },
  PAID: { label: 'Pagado', variant: 'success' },
  SHIPPED: { label: 'Enviado', variant: 'orange' },
  DELIVERED: { label: 'Entregado', variant: 'brown' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase() as OrderStatus;
  const config = orderStatusMap[normalized] ?? { label: status, variant: 'default' as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const paymentStatusMap: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  COMPLETED: { label: 'Completado', variant: 'success' },
  FAILED: { label: 'Fallido', variant: 'danger' },
  EXPIRED: { label: 'Expirado', variant: 'default' },
  REFUNDED: { label: 'Reembolsado', variant: 'default' },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase() as PaymentStatus;
  const config = paymentStatusMap[normalized] ?? { label: status, variant: 'default' as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
