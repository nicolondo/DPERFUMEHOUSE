'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="p-3 sm:p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
