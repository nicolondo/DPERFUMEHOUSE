"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminUser, isAuthenticated } from '@/lib/auth';
import { PageSpinner } from '@/components/ui/spinner';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const user = getAdminUser();
    if (!user || user.role !== 'ADMIN') {
      router.replace('/login');
      return;
    }

    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <PageSpinner />
    </div>
  );
}
