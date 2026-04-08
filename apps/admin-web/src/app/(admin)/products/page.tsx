'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProducts,
  fetchProductCategories,
  toggleProductBlocked,
  triggerSync,
  uploadProductImage,
  bulkDeactivateProducts,
  bulkActivateProducts,
} from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import {
  Search,
  RefreshCw,
  Ban,
  Check,
  EyeOff,
  Camera,
  CheckSquare,
  Square,
  MinusSquare,
  X,
} from 'lucide-react';

type StatusFilter = 'active' | 'inactive' | 'all';

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPageState] = useState(() => Number(searchParams.get('page')) || 1);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => (searchParams.get('status') as StatusFilter) || 'active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sync state to URL
  const updateURL = (params: Record<string, string | number>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (!v || v === 'active' && k === 'status' || v === 1 && k === 'page') {
        sp.delete(k);
      } else {
        sp.set(k, String(v));
      }
    });
    const qs = sp.toString();
    router.replace(`/products${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const setPage = (p: number) => {
    setPageState(p);
    updateURL({ page: p, search, category, status: statusFilter });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, category, statusFilter],
    queryFn: () =>
      fetchProducts({
        page,
        pageSize: 20,
        search: search || undefined,
        category: category || undefined,
        status: statusFilter,
      } as any),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: fetchProductCategories,
  });

  useEffect(() => {
    if (category && !categories.includes(category)) {
      setCategory('');
      setPage(1);
    }
  }, [category, categories]);

  const products = data?.data || [];
  const totalProducts = data?.meta?.total || 0;

  const toggleBlockMutation = useMutation({
    mutationFn: toggleProductBlocked,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: ({ variantId, file }: { variantId: string; file: File }) =>
      uploadProductImage(variantId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setUploadingId(null);
    },
    onError: () => setUploadingId(null),
  });

  const bulkDeactivateMutation = useMutation({
    mutationFn: bulkDeactivateProducts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds(new Set());
    },
  });

  const bulkActivateMutation = useMutation({
    mutationFn: bulkActivateProducts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds(new Set());
    },
  });

  const handleImageClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setUploadingId(itemId);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadMutation.mutate({ variantId: itemId, file });
      } else {
        setUploadingId(null);
      }
    };
    input.click();
  };

  const getThumb = (item: any) => {
    if (item.images?.length > 0) {
      const primary = item.images.find((i: any) => i.isPrimary) || item.images[0];
      return primary.thumbnailUrl || primary.url;
    }
    return null;
  };

  // Selection logic
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const allPageSelected =
    products.length > 0 && products.every((p: any) => selectedIds.has(p.id));
  const somePageSelected =
    products.some((p: any) => selectedIds.has(p.id)) && !allPageSelected;

  const toggleSelectAll = () => {
    if (allPageSelected) {
      const next = new Set(selectedIds);
      products.forEach((p: any) => next.delete(p.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      products.forEach((p: any) => next.add(p.id));
      setSelectedIds(next);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-10',
      headerRender: () => (
        <button onClick={toggleSelectAll} className="p-1 text-white/50 hover:text-accent-purple">
          {allPageSelected ? (
            <CheckSquare className="h-4 w-4 text-accent-purple" />
          ) : somePageSelected ? (
            <MinusSquare className="h-4 w-4 text-accent-purple/60" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ),
      render: (item) => (
        <button
          onClick={(e) => toggleSelect(item.id, e)}
          className="p-1 text-white/30 hover:text-accent-purple"
        >
          {selectedIds.has(item.id) ? (
            <CheckSquare className="h-4 w-4 text-accent-purple" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ),
    },
    {
      key: 'image',
      header: '',
      className: 'w-14',
      render: (item) => {
        const thumb = getThumb(item);
        const isUploading = uploadingId === item.id && uploadMutation.isPending;
        return (
          <button
            onClick={(e) => handleImageClick(e, item.id)}
            className="group relative h-10 w-10 overflow-hidden rounded-lg border border-glass-border bg-glass-50 hover:border-accent-purple/50 hover:ring-2 hover:ring-accent-purple/20 transition-all cursor-pointer"
            title="Click para subir o cambiar foto"
          >
            {isUploading ? (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
              </div>
            ) : thumb ? (
              <>
                <img src={thumb} alt={item.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                  <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/30 group-hover:text-accent-purple transition-colors">
                <Camera className="h-4 w-4" />
              </div>
            )}
          </button>
        );
      },
    },
    {
      key: 'name',
      header: 'Producto',
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.name}</p>
          {item.attributes && Object.keys(item.attributes).length > 0 && (
            <p className="text-xs text-accent-purple">
              {Object.entries(item.attributes)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      render: (item) => (
        <span className="font-medium">{formatCurrency(item.price || 0)}</span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (item) => (
        <Badge variant={item.stock > 0 ? 'success' : 'danger'}>
          {item.stock ?? 0}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      render: (item) => (
        <span className="text-sm text-white/70 truncate max-w-[150px] block">
          {item.categoryName || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => {
        const isInactive = !item.isActive;
        const isBlocked = item.isBlocked;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBlockMutation.mutate(item.id);
            }}
            className="inline-flex items-center gap-1.5"
          >
            {isInactive ? (
              <Badge variant="outline">
                <EyeOff className="mr-1 h-3 w-3" />
                Inactivo
              </Badge>
            ) : isBlocked ? (
              <Badge variant="danger">
                <Ban className="mr-1 h-3 w-3" />
                Bloqueado
              </Badge>
            ) : (
              <Badge variant="success">
                <Check className="mr-1 h-3 w-3" />
                Activo
              </Badge>
            )}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-description">
            Catalogo de productos sincronizados desde Odoo
          </p>
        </div>
        <Button
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => syncMutation.mutate()}
          loading={syncMutation.isPending}
        >
          Sincronizar con Odoo
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-accent-purple-muted border border-accent-purple/30 px-4 py-3">
          <span className="text-sm font-medium text-accent-purple">
            {selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''} seleccionado
            {selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              icon={<Ban className="h-3.5 w-3.5" />}
              onClick={() => bulkDeactivateMutation.mutate(Array.from(selectedIds))}
              loading={bulkDeactivateMutation.isPending}
            >
              Desactivar
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Check className="h-3.5 w-3.5" />}
              onClick={() => bulkActivateMutation.mutate(Array.from(selectedIds))}
              loading={bulkActivateMutation.isPending}
            >
              Activar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            placeholder="Buscar por nombre o variante..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageState(1);
              updateURL({ page: 1, search: e.target.value, category, status: statusFilter });
            }}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPageState(1); updateURL({ page: 1, search: '', category, status: statusFilter }); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value as StatusFilter;
            setStatusFilter(v);
            setPageState(1);
            updateURL({ page: 1, search, category, status: v });
          }}
          className="w-40"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </Select>
        <Select
          value={category}
          onChange={(e) => {
            const v = e.target.value;
            setCategory(v);
            setPageState(1);
            updateURL({ page: 1, search, category: v, status: statusFilter });
          }}
          className="w-48"
        >
          <option value="">Todas las categorias</option>
          {categories.map((categoryName) => (
            <option key={categoryName} value={categoryName}>
              {categoryName}
            </option>
          ))}
        </Select>
      </div>

      {syncMutation.isSuccess && syncMutation.data && (
        <div className="rounded-lg bg-status-success-muted p-3 text-sm text-status-success">
          Sincronizacion completada:{' '}
          {(syncMutation.data as any).created || 0} creados,{' '}
          {(syncMutation.data as any).updated || 0} actualizados,{' '}
          {(syncMutation.data as any).deactivated || 0} desactivados.
        </div>
      )}

      <DataTable
        columns={columns}
        data={products}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={totalProducts}
        onPageChange={setPage}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => router.push(`/products/${item.id}`)}
        emptyMessage="No se encontraron productos"
      />
    </div>
  );
}
