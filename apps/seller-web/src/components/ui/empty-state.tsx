'use client';

import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-glass-100 text-brand-gold">
        {icon}
      </div>
      <h3 className="mb-1 text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mb-4 max-w-xs text-sm text-white/50">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
