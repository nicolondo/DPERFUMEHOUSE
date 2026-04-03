'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, ShoppingBag, Settings, LogOut, UserPlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendingOrdersCount } from '@/hooks/use-orders';
import { useLeadStats } from '@/hooks/use-leads';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth.store';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  action?: () => void;
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { data: pendingCount } = usePendingOrdersCount();
  const { data: leadStats } = useLeadStats();
  const user = useAuthStore((s) => s.user);

  const navItems: NavItem[] = [
    {
      label: 'Inicio',
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: '/dashboard',
    },
    {
      label: 'Clientes',
      icon: <Users className="h-5 w-5" />,
      href: '/customers',
    },
    {
      label: 'Pedidos',
      icon: <ShoppingBag className="h-5 w-5" />,
      href: '/orders',
    },
    {
      label: 'Leads',
      icon: <Sparkles className="h-5 w-5" />,
      href: '/leads',
    },
    ...(user?.canManageSellers
      ? [
          {
            label: 'Vendedores',
            icon: <UserPlus className="h-5 w-5" />,
            href: '/sellers',
          },
        ]
      : []),
    {
      label: 'Config',
      icon: <Settings className="h-5 w-5" />,
      href: '/config',
    },
    {
      label: 'Salir',
      icon: <LogOut className="h-5 w-5" />,
      href: '#',
      action: logout,
    },
  ];

  const isActive = (href: string) => {
    if (href === '#') return false;
    return pathname.startsWith(href);
  };

  return (
    <nav className="shrink-0 border-t border-glass-border bg-surface-raised/80 shadow-bottom-nav backdrop-blur-xl" style={{ touchAction: 'none' }}>
      <div
        className="flex items-center justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  router.push(item.href);
                }
              }}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-4 text-xs transition-colors touch-target',
                active
                  ? 'text-accent-gold'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent-gold" />
              )}

              <div className="relative">
                {item.icon}
                {/* Pending orders badge */}
                {item.label === 'Pedidos' && pendingCount && pendingCount > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-bold text-white">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                ) : null}
                {/* New leads badge */}
                {item.label === 'Leads' && leadStats?.newLeads && leadStats.newLeads > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                    {leadStats.newLeads > 99 ? '99+' : leadStats.newLeads}
                  </span>
                ) : null}
              </div>

              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
