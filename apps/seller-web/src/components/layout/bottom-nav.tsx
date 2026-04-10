'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, ShoppingBag, Settings, LogOut, UserPlus, Sparkles, FileText, Menu, X, BookOpen, Link2 } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
    {
      label: 'Propuestas',
      icon: <FileText className="h-5 w-5" />,
      href: '/proposals',
    },
  ];

  const menuItems: NavItem[] = [
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
      label: 'Instrucciones',
      icon: <BookOpen className="h-5 w-5" />,
      href: '/instructions',
    },
    {
      label: 'Links de Venta',
      icon: <Link2 className="h-5 w-5" />,
      href: '/product-links',
    },
    {
      label: 'Configuración',
      icon: <Settings className="h-5 w-5" />,
      href: '/config',
    },
    {
      label: 'Cerrar sesión',
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-glass-border bg-surface-raised/95 backdrop-blur-xl max-w-[600px] mx-auto">
      <div
        className="flex items-center justify-around px-5"
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

        {/* Hamburger menu */}
        <div className="relative flex flex-1 flex-col items-center justify-center" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 py-4 text-xs transition-colors touch-target',
              menuOpen || isActive('/config') || isActive('/sellers') || isActive('/instructions') || isActive('/product-links')
                ? 'text-accent-gold'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            {(menuOpen || isActive('/config') || isActive('/sellers') || isActive('/instructions') || isActive('/product-links')) && (
              <div className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent-gold" />
            )}
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="font-medium">Más</span>
          </button>

          {/* Popup menu */}
          {menuOpen && (
            <div className="absolute bottom-full mb-2 right-0 min-w-[180px] rounded-xl border border-glass-border bg-[#1c1710] shadow-xl overflow-hidden">
              {menuItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMenuOpen(false);
                      if (item.action) {
                        item.action();
                      } else {
                        router.push(item.href);
                      }
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors',
                      active ? 'text-accent-gold bg-white/[0.04]' : 'text-white/60 hover:text-white hover:bg-white/[0.04]',
                      item.label === 'Cerrar sesión' && 'text-red-400 hover:text-red-300'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
