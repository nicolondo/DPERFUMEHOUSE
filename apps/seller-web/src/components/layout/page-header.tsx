'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  backHref?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  className?: string;
  subtitle?: string;
}

export function PageHeader({
  title,
  backHref,
  onBack,
  action,
  className,
  subtitle,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const showBack = backHref || onBack;

  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-surface/80 backdrop-blur-xl',
        'px-4 pb-3 pt-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-glass-200 hover:text-white touch-target"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-sm text-white/50">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}
