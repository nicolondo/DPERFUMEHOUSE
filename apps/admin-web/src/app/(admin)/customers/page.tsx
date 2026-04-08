'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomers, fetchSellers } from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { formatDate, formatPhone } from '@/lib/utils';
import { Search, Mail, Phone, ShoppingBag, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function CustomersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, sellerFilter],
    queryFn: () =>
      fetchCustomers({
        page,
        pageSize: 20,
        search: search || undefined,
        sellerId: sellerFilter || undefined,
      }),
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers'],
    queryFn: fetchSellers,
  });

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {item.email && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Mail className="h-3 w-3" />
                {item.email}
              </span>
            )}
            {item.phone && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Phone className="h-3 w-3" />
                {formatPhone(item.phone)}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      render: (item) => (
        <span className="text-sm text-white/70">
          {item.documentType && item.documentNumber
            ? `${item.documentType} ${item.documentNumber}`
            : '-'}
        </span>
      ),
    },
    {
      key: 'seller',
      header: 'Vendedor',
      render: (item) => (
        <div>
          {item.seller?.id ? (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/users/${item.seller.id}`); }}
              className="text-sm text-accent-purple hover:underline"
            >
              {item.seller.name}
            </button>
          ) : (
            <p className="text-sm text-white">{item.seller?.name || '-'}</p>
          )}
          <p className="text-xs text-white/50">{item.seller?.email || ''}</p>
        </div>
      ),
    },
    {
      key: 'purchases',
      header: 'Compras',
      render: (item) => (
        <div>
          <p className="text-sm font-medium text-white">{formatCurrency(item.totalPurchases || 0)}</p>
          <p className="text-xs text-white/40">{item.totalOrders || 0} pedido{item.totalOrders !== 1 ? 's' : ''}</p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      render: (item) => (
        <span className="text-sm text-white/50">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Clientes</h1>
        <p className="page-description">Clientes creados por los vendedores</p>
      </div>

      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            placeholder="Buscar por nombre, email o telefono..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={sellerFilter}
          onChange={(e) => {
            setSellerFilter(e.target.value);
            setPage(1);
          }}
          className="w-56"
        >
          <option value="">Todos los vendedores</option>
          {(Array.isArray(sellers) ? sellers : []).map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={data?.meta?.total || 0}
        onPageChange={setPage}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => router.push(`/customers/${item.id}`)}
        emptyMessage="No hay clientes registrados"
      />
    </div>
  );
}
