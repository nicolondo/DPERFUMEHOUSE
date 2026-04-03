'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        'rounded-2xl border border-glass-border bg-glass-100 shadow-glass backdrop-blur-xl p-4 sm:p-6',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 sm:space-y-2 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-white/50">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-white truncate">{value}</p>
        </div>
        <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-accent-purple-muted text-accent-purple">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-status-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-status-danger" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              isPositive ? 'text-status-success' : 'text-status-danger'
            )}
          >
            {isPositive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-white/50">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
