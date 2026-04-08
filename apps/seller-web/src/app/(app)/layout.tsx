'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageSpinner } from '@/components/ui/spinner';
import { NotificationPrompt } from '@/components/ui/notification-prompt';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Prevent iOS zoom via gestures
  useEffect(() => {
    const handler = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', handler, { passive: false });
    document.addEventListener('gesturechange', handler, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', handler);
      document.removeEventListener('gesturechange', handler);
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <PageSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-surface pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
      <NotificationPrompt />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
