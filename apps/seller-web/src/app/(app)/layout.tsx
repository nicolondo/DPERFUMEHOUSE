'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageSpinner } from '@/components/ui/spinner';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();

  usePushNotifications();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo(0, 0);
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
    <div className="flex flex-col h-dvh bg-surface overflow-hidden">
      <main className="flex-1 overflow-y-auto overscroll-none">
        <div className="min-h-[calc(100%+1px)]">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
