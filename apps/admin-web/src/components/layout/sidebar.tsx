'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Coins,
  Wallet,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Network,
  RefreshCw,
  PackageSearch,
  Cog,
  CreditCard,
  Settings2,
  Truck,
  Layers,
  Sparkles,
  FlaskConical,
  Target,
} from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string; icon: React.ReactNode }[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: 'Usuarios',
    href: '/users',
    icon: <Users className="h-5 w-5" />,
  },
  {
    label: 'Productos',
    icon: <Package className="h-5 w-5" />,
    children: [
      { label: 'Catalogo', href: '/products', icon: <Package className="h-4 w-4" /> },
      { label: 'Sincronizacion', href: '/products/sync', icon: <RefreshCw className="h-4 w-4" /> },
      { label: 'Solicitudes Sin Stock', href: '/products/requests', icon: <PackageSearch className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Clientes',
    href: '/customers',
    icon: <Users className="h-5 w-5" />,
  },
  {
    label: 'Pedidos',
    href: '/orders',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    label: 'Fragancias',
    icon: <FlaskConical className="h-5 w-5" />,
    children: [
      { label: 'Perfiles', href: '/fragrances', icon: <FlaskConical className="h-4 w-4" /> },
      { label: 'Leads', href: '/fragrances/leads', icon: <Target className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Comisiones',
    href: '/commissions',
    icon: <Coins className="h-5 w-5" />,
  },
  {
    label: 'Pagos a Vendedores',
    href: '/payouts',
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    label: 'Configuracion',
    icon: <Settings className="h-5 w-5" />,
    children: [
      { label: 'Odoo', href: '/settings?tab=odoo', icon: <Cog className="h-4 w-4" /> },
      { label: 'Pagos', href: '/settings?tab=payments', icon: <CreditCard className="h-4 w-4" /> },
      { label: 'Envíos', href: '/settings?tab=shipping', icon: <Truck className="h-4 w-4" /> },
      { label: 'Escala comisiones', href: '/settings?tab=escalas', icon: <Layers className="h-4 w-4" /> },
      { label: 'General', href: '/settings?tab=general', icon: <Settings2 className="h-4 w-4" /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Usuarios', 'Productos', 'Fragancias', 'Configuracion']);

  function toggleSection(label: string) {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  }

  // Collect all known child path portions (without query strings) for prefix matching
  const allChildPaths = navigation.flatMap((item) =>
    item.children?.map((c) => c.href.split('?')[0]) ?? (item.href ? [item.href] : [])
  );

  function isActive(href: string) {
    // Split href into path and query string parts
    const [hrefPath, hrefQuery] = href.split('?');

    // If the href has a query string, match on path + query params
    if (hrefQuery) {
      if (pathname !== hrefPath) return false;
      const params = new URLSearchParams(hrefQuery);
      for (const [key, value] of params.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }

    // Exact path match
    if (pathname === hrefPath) {
      // Only match if there isn't a more specific child route that also matches
      const hasMoreSpecificMatch = allChildPaths.some(
        (p) => p !== hrefPath && p.startsWith(hrefPath + '/') && pathname.startsWith(p)
      );
      return !hasMoreSpecificMatch;
    }

    // Prefix matching: only if no sibling route is more specific
    const hasMoreSpecificRoute = allChildPaths.some(
      (p) => p !== hrefPath && p.startsWith(hrefPath + '/')
    );
    if (hasMoreSpecificRoute) return false;
    return pathname.startsWith(hrefPath + '/');
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-glass-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold text-surface font-bold text-sm">
          DP
        </div>
        <div>
          <h1 className="text-sm font-bold text-white">D Perfume House</h1>
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((item) => {
          if (item.children) {
            const isExpanded = expandedSections.includes(item.label);
            const hasActiveChild = item.children.some((child) => isActive(child.href));

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleSection(item.label)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    hasActiveChild
                      ? 'text-accent-gold bg-accent-gold-muted'
                      : 'text-white/50 hover:bg-glass-200 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-glass-border pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                          isActive(child.href)
                            ? 'text-accent-gold bg-accent-gold-muted font-medium'
                            : 'text-white/50 hover:bg-glass-200 hover:text-white'
                        )}
                      >
                        {child.icon}
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href!)
                  ? 'text-accent-gold bg-accent-gold-muted'
                  : 'text-white/50 hover:bg-glass-200 hover:text-white'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-glass-200 p-2 shadow-glass lg:hidden"
      >
        <Menu className="h-5 w-5 text-white/60" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-surface-raised/80 border-r border-glass-border backdrop-blur-xl shadow-xl transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1 text-white/40 hover:bg-glass-200 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 lg:border-r lg:border-glass-border lg:bg-surface-raised/80 lg:backdrop-blur-xl">
        {sidebarContent}
      </aside>
    </>
  );
}
