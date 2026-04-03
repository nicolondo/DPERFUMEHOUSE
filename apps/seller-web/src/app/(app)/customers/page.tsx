'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Phone, Mail, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useCustomers } from '@/hooks/use-customers';
import { getInitials, formatPhone } from '@/lib/utils';
import Link from 'next/link';
import type { Customer } from '@/lib/types';

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCustomers(search || undefined);

  const customers = data?.data ?? [];

  return (
    <div className="pb-24">
      <PageHeader title="Clientes" />

      <div className="px-4 space-y-4">
        {/* Search */}
        <Input
          placeholder="Buscar por nombre, email o telefono..."
          leftIcon={<Search className="h-5 w-5" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* List */}
        {isLoading ? (
          <PageSpinner />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title={search ? 'Sin resultados' : 'Sin clientes'}
            description={
              search
                ? 'No se encontraron clientes con esa busqueda'
                : 'Agrega tu primer cliente para empezar'
            }
            action={
              !search
                ? { label: 'Agregar Cliente', onClick: () => router.push('/customers/new') }
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {customers.map((customer: Customer) => (
              <Link key={customer.id} href={`/customers/${customer.id}`} className="block">
                <Card className="flex items-center gap-4 p-4 active:bg-glass-200 transition-colors">
                  {/* Avatar */}
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-purple-muted text-sm font-bold text-accent-purple">
                    {getInitials(customer.name)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {customer.name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-white/30">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhone(customer.phone)}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-white/20" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link href="/customers/new" className="fab !w-auto !rounded-full px-5 gap-2">
        <Plus className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase">Crear Nuevo</span>
      </Link>
    </div>
  );
}
