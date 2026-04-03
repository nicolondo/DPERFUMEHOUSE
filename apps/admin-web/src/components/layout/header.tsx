'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight, LogOut, User } from 'lucide-react';
import { getAdminUser, logoutAdmin } from '@/lib/auth';

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Usuarios',
  products: 'Productos',
  sync: 'Sincronizacion',
  requests: 'Solicitudes',
  orders: 'Pedidos',
  commissions: 'Comisiones',
  payouts: 'Pagos a Vendedores',
  settings: 'Configuracion',
};

export function Header() {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = getAdminUser();

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg) => ({
    label: breadcrumbMap[seg] || seg,
    path: '/' + segments.slice(0, segments.indexOf(seg) + 1).join('/'),
  }));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-glass-border bg-surface-raised/80 backdrop-blur-xl px-4 lg:px-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 pl-12 lg:pl-0 min-w-0 overflow-hidden">
        {breadcrumbs.map((crumb, idx) => (
          <div key={crumb.path} className="flex items-center gap-1.5 min-w-0">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />}
            <span
              className={`truncate ${
                idx === breadcrumbs.length - 1
                  ? 'text-sm font-medium text-white'
                  : 'text-sm text-white/50'
              }`}
            >
              {crumb.label}
            </span>
          </div>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-white/50 hover:bg-glass-200 hover:text-white transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-danger" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-200 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple-muted text-accent-purple text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-white">{user?.name || 'Admin'}</p>
              <p className="text-[11px] text-white/50">{user?.email || ''}</p>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-glass-border bg-surface-raised py-1 shadow-glass backdrop-blur-xl">
              <button
                onClick={logoutAdmin}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-glass-200 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
