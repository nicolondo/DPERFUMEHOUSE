'use client';

import { useEffect, useState } from 'react';
import { isAuthenticated, getAdminUser } from '@/lib/auth';
import { AdminLayout } from '@/components/layout/admin-layout';
import { PageSpinner } from '@/components/ui/spinner';

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checked, setChecked] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      setDenied(true);
      window.location.replace('/login');
      return;
    }
    const user = getAdminUser();
    if (!user || user.role !== 'ADMIN') {
      setDenied(true);
      window.location.replace('/login');
      return;
    }
    setChecked(true);
  }, []);

  if (denied) {
    return null;
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageSpinner />
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
