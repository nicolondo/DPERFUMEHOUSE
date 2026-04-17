'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  fetchUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  fetchUser,
  fetchProductCategories,
  fetchSettings,
} from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { formatPercent } from '@/lib/utils';
import { Plus, Search, Pencil, TrendingUp } from 'lucide-react';

type CommissionScaleTier = {
  minSales: number;
  maxSales?: number;
  ratePercent: number;
};

const DEFAULT_COMMISSION_SCALE: CommissionScaleTier[] = [
  { minSales: 0, maxSales: 5000000, ratePercent: 20 },
  { minSales: 5000000, maxSales: 10000000, ratePercent: 25 },
  { minSales: 10000000, ratePercent: 30 },
];

function parseCommissionScaleSettings(settings: any[] | undefined): CommissionScaleTier[] {
  const raw = settings?.find((s: any) => s.key === 'commission_scale_tiers_json')?.value;
  if (!raw) return DEFAULT_COMMISSION_SCALE;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_COMMISSION_SCALE;

    const normalized = parsed
      .map((tier: any) => ({
        minSales: Number(tier?.minSales || 0),
        maxSales:
          tier?.maxSales === null || tier?.maxSales === undefined || tier?.maxSales === ''
            ? undefined
            : Number(tier.maxSales),
        ratePercent: Number(tier?.ratePercent || 0),
      }))
      .filter((tier: CommissionScaleTier) => Number.isFinite(tier.minSales) && Number.isFinite(tier.ratePercent));

    return normalized.length > 0 ? normalized : DEFAULT_COMMISSION_SCALE;
  } catch {
    return DEFAULT_COMMISSION_SCALE;
  }
}

const createUserSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email invalido'),
  role: z.enum(['SELLER_L1', 'SELLER_L2']),
  parentId: z.string().optional(),
  commissionRate: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().min(0).max(100).optional(),
  ),
  commissionRateL2: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().min(0).max(100).optional(),
  ),
  commissionScaleEnabled: z.boolean().optional(),
  commissionScaleUseGlobal: z.boolean().optional(),
  commissionScaleOverride: z
    .array(
      z.object({
        minSales: z.coerce.number().min(0),
        maxSales: z.preprocess(
          (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
          z.number().min(0).optional(),
        ),
        ratePercent: z.coerce.number().min(0).max(100),
      }),
    )
    .optional(),
  allowedCategories: z.array(z.string()).optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email invalido'),
  phone: z.string().optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'SELLER_L1', 'SELLER_L2']),
  parentId: z.string().optional().or(z.literal('')),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  commissionRateL2: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  canManageSellers: z.boolean().optional(),
  bankName: z.string().optional().or(z.literal('')),
  bankAccountType: z.string().optional().or(z.literal('')),
  bankAccountNumber: z.string().optional().or(z.literal('')),
  bankAccountHolder: z.string().optional().or(z.literal('')),
  usdtWalletTrc20: z.string().optional().or(z.literal('')),
  commissionScaleEnabled: z.boolean().optional(),
  commissionScaleUseGlobal: z.boolean().optional(),
  commissionScaleOverride: z
    .array(
      z.object({
        minSales: z.coerce.number().min(0),
        maxSales: z.preprocess(
          (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
          z.number().min(0).optional(),
        ),
        ratePercent: z.coerce.number().min(0).max(100),
      }),
    )
    .optional(),
  allowedCategories: z.array(z.string()).optional(),
});

type EditUserForm = z.infer<typeof editUserSchema>;

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  SELLER_L1: 'Vendedor L1',
  SELLER_L2: 'Vendedor L2',
};

const roleVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  ADMIN: 'danger',
  SELLER_L1: 'info',
  SELLER_L2: 'default',
};

export default function UsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter, statusFilter],
    queryFn: () =>
      fetchUsers({
        page,
        pageSize: 20,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleUserStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      createForm.reset();
    },
  });

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: 'SELLER_L1',
      allowedCategories: [],
      commissionScaleEnabled: true,
      commissionScaleUseGlobal: true,
      commissionScaleOverride: [],
    },
  });

  const watchRole = createForm.watch('role');
  const selectedCreateCategories = createForm.watch('allowedCategories') || [];
  const createScaleEnabled = createForm.watch('commissionScaleEnabled') || false;
  const createScaleUseGlobal = createForm.watch('commissionScaleUseGlobal') ?? true;
  const createScaleOverride = createForm.watch('commissionScaleOverride') || [];

  const { data: productCategories = [] } = useQuery({
    queryKey: ['products', 'categories', 'users-create'],
    queryFn: fetchProductCategories,
    enabled: showCreate || !!editingUser,
  });

  const { data: generalSettings } = useQuery({
    queryKey: ['settings', 'general', 'users-create'],
    queryFn: () => fetchSettings('general'),
    enabled: showCreate,
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ['settings', 'commissions', 'users-create'],
    queryFn: () => fetchSettings('commissions'),
    enabled: showCreate || !!editingUser,
  });

  const globalCommissionScale = parseCommissionScaleSettings(commissionSettings);

  useEffect(() => {
    if (!showCreate) return;
    const settingsMap = new Map((generalSettings || []).map((s: any) => [s.key, s.value]));
    const defaultCategory = (settingsMap.get('default_new_user_category') as string) || '';
    createForm.setValue('allowedCategories', defaultCategory ? [defaultCategory] : [], {
      shouldDirty: false,
    });
  }, [showCreate, generalSettings, createForm]);

  useEffect(() => {
    if (!showCreate || !createScaleEnabled || createScaleUseGlobal) return;
    const current = createForm.getValues('commissionScaleOverride') || [];
    if (current.length === 0) {
      createForm.setValue('commissionScaleOverride', globalCommissionScale, {
        shouldDirty: true,
      });
    }
  }, [
    showCreate,
    createScaleEnabled,
    createScaleUseGlobal,
    createForm,
    globalCommissionScale,
  ]);

  const updateCreateScaleTier = (
    index: number,
    key: 'minSales' | 'maxSales' | 'ratePercent',
    value: string,
  ) => {
    const raw = value.replace(/\./g, '').replace(/,/g, '');
    const current = [...(createForm.getValues('commissionScaleOverride') || [])];
    if (!current[index]) return;
    current[index] = {
      ...current[index],
      [key]: raw === '' && key === 'maxSales' ? undefined : Number(raw || 0),
    };
    createForm.setValue('commissionScaleOverride', current, { shouldDirty: true });
  };

  const addCreateScaleTier = () => {
    const current = createForm.getValues('commissionScaleOverride') || [];
    createForm.setValue(
      'commissionScaleOverride',
      [...current, { minSales: 0, maxSales: undefined, ratePercent: 0 }],
      { shouldDirty: true },
    );
  };

  const removeCreateScaleTier = (index: number) => {
    const current = createForm.getValues('commissionScaleOverride') || [];
    createForm.setValue(
      'commissionScaleOverride',
      current.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const toggleCreateCategory = (category: string) => {
    const current = createForm.getValues('allowedCategories') || [];
    const exists = current.includes(category);
    createForm.setValue(
      'allowedCategories',
      exists ? current.filter((c) => c !== category) : [...current, category],
      { shouldDirty: true },
    );
  };

  const { data: l1Sellers } = useQuery({
    queryKey: ['users', 'l1-sellers'],
    queryFn: () => fetchUsers({ role: 'SELLER_L1', pageSize: 100 }),
    enabled: showCreate || !!editingUser,
  });

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.name}</p>
          <p className="text-xs text-white/50">{item.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (item) => (
        <Badge variant={roleVariant[item.role] || 'default'}>
          {roleLabels[item.role] || item.role}
        </Badge>
      ),
    },
    {
      key: 'commissionRate',
      header: 'Comision L1/L2',
      render: (item) => (
        item.commissionScaleEnabled ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-400" title="Escala escalonada habilitada">
            <TrendingUp className="h-4 w-4" />
            Escala
            <span className="text-white/50">/</span>
            <span className="text-white/70">{item.commissionRateL2 != null ? formatPercent(item.commissionRateL2) : '-'}</span>
          </span>
        ) : (
          <span className="text-sm">
            {item.commissionRate != null ? formatPercent(item.commissionRate) : '-'}
            {' / '}
            {item.commissionRateL2 != null ? formatPercent(item.commissionRateL2) : '-'}
          </span>
        )
      ),
    },
    {
      key: 'parentName',
      header: 'Padre',
      render: (item) => (
        <span className="text-sm text-white/70">{item.parentName || item.parent?.name || '-'}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMutation.mutate(item.id);
          }}
          className="inline-flex items-center"
        >
          <Badge variant={item.pendingApproval ? 'warning' : item.isActive ? 'success' : 'default'}>
            {item.pendingApproval ? 'Pendiente Aprobación' : item.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingUser(item);
          }}
          className="rounded-lg p-1.5 text-white/30 hover:bg-glass-100 hover:text-white/70"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Vendedores</h1>
          <p className="page-description">Gestiona vendedores y usuarios del sistema</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
          Crear Vendedor
        </Button>
      </div>

      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="w-44"
        >
          <option value="">Todos los roles</option>
          <option value="SELLER_L1">Vendedor L1</option>
          <option value="SELLER_L2">Vendedor L2</option>
          <option value="ADMIN">Admin</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="pending">Pendiente Aprobación</option>
          <option value="inactive">Inactivos</option>
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
        onRowClick={(item) => router.push(`/users/${item.id}`)}
        keyExtractor={(item) => item.id}
        emptyMessage="No se encontraron usuarios"
      />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear Vendedor" size="md">
        <form
          onSubmit={createForm.handleSubmit((vals) => {
            const payload: any = {
              ...vals,
              allowedCategories: vals.allowedCategories || [],
            };
            if (vals.commissionRate !== undefined) {
              payload.commissionRate = vals.commissionRate / 100;
            }
            if (vals.commissionRateL2 !== undefined) {
              payload.commissionRateL2 = vals.commissionRateL2 / 100;
            }
            payload.commissionScaleEnabled = !!vals.commissionScaleEnabled;
            payload.commissionScaleUseGlobal = vals.commissionScaleUseGlobal ?? true;
            payload.commissionScaleOverride =
              vals.commissionScaleEnabled && !(vals.commissionScaleUseGlobal ?? true)
                ? (vals.commissionScaleOverride || []).map((tier) => ({
                    minSales: Number(tier.minSales || 0),
                    maxSales:
                      tier.maxSales === undefined || tier.maxSales === null || tier.maxSales === ('' as any)
                        ? undefined
                        : Number(tier.maxSales),
                    ratePercent: Number(tier.ratePercent || 0),
                  }))
                : undefined;
            createMutation.mutate(payload);
          })}
          className="space-y-4"
        >
          {createMutation.error && (
            <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
              {(() => {
                const err = createMutation.error as any;
                const apiMessage = err?.response?.data?.message;
                if (Array.isArray(apiMessage)) return apiMessage.join(', ');
                return apiMessage || err?.response?.data?.error || 'Error al crear usuario';
              })()}
            </div>
          )}

          <FormField label="Nombre" error={createForm.formState.errors.name?.message} required>
            <Input {...createForm.register('name')} placeholder="Nombre completo" error={!!createForm.formState.errors.name} />
          </FormField>

          <FormField label="Email" error={createForm.formState.errors.email?.message} required>
            <Input {...createForm.register('email')} type="email" placeholder="email@ejemplo.com" error={!!createForm.formState.errors.email} />
          </FormField>

          <FormField label="Rol" error={createForm.formState.errors.role?.message} required>
            <Select {...createForm.register('role')} error={!!createForm.formState.errors.role}>
              <option value="SELLER_L1">Vendedor L1</option>
              <option value="SELLER_L2">Vendedor L2</option>
            </Select>
          </FormField>

          {watchRole === 'SELLER_L2' && (
            <FormField label="Vendedor Padre (L1)" error={createForm.formState.errors.parentId?.message}>
              <Select {...createForm.register('parentId')} error={!!createForm.formState.errors.parentId}>
                <option value="">Seleccionar padre...</option>
                {(l1Sellers?.data || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!createScaleEnabled && (
              <FormField label="Comision L1 (%)" error={createForm.formState.errors.commissionRate?.message} hint="Ej: 30 = 30%">
                <Input
                  {...createForm.register('commissionRate')}
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="10"
                  error={!!createForm.formState.errors.commissionRate}
                />
              </FormField>
            )}
            <FormField label="Comision L2 (%)" error={createForm.formState.errors.commissionRateL2?.message} hint="Ej: 5 = 5%">
              <Input
                {...createForm.register('commissionRateL2')}
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="5"
                error={!!createForm.formState.errors.commissionRateL2}
              />
            </FormField>
          </div>

          <div className="rounded-lg border border-glass-border p-4 space-y-3">
            <p className="text-sm font-semibold text-white/80">Escala de Comisiones Mensual</p>

            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={createScaleEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  createForm.setValue('commissionScaleEnabled', enabled, { shouldDirty: true });
                  if (enabled) {
                    createForm.setValue('commissionScaleUseGlobal', true, { shouldDirty: true });
                  }
                }}
                className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
              />
              Habilitar escala escalonada para este vendedor
            </label>

            {createScaleEnabled && (
              <>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={createScaleUseGlobal}
                    onChange={(e) => {
                      const useGlobal = e.target.checked;
                      createForm.setValue('commissionScaleUseGlobal', useGlobal, { shouldDirty: true });
                      if (!useGlobal && createScaleOverride.length === 0) {
                        createForm.setValue('commissionScaleOverride', globalCommissionScale, {
                          shouldDirty: true,
                        });
                      }
                    }}
                    className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
                  />
                  Usar configuración global
                </label>

                {!createScaleUseGlobal && (
                  <div className="space-y-3 rounded-lg border border-glass-border/70 p-3">
                    <p className="text-xs text-white/60">
                      Se cargan los valores globales por defecto para que los puedas ajustar.
                    </p>
                    {createScaleOverride.map((tier, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                        <FormField label="Desde (COP)">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(tier.minSales ?? 0)}
                            onChange={(e) => updateCreateScaleTier(index, 'minSales', e.target.value)}
                          />
                        </FormField>
                        <FormField label="Hasta (COP)">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={tier.maxSales !== undefined ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(tier.maxSales) : ''}
                            onChange={(e) => updateCreateScaleTier(index, 'maxSales', e.target.value)}
                            placeholder="Sin tope"
                          />
                        </FormField>
                        <FormField label="Comisión (%)">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={tier.ratePercent ?? 0}
                            onChange={(e) => updateCreateScaleTier(index, 'ratePercent', e.target.value)}
                          />
                        </FormField>
                        <Button type="button" variant="ghost" onClick={() => removeCreateScaleTier(index)}>
                          Eliminar
                        </Button>
                      </div>
                    ))}

                    <Button type="button" variant="outline" onClick={addCreateScaleTier}>
                      Agregar tramo
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-glass-border pt-4">
            <p className="mb-3 text-sm font-semibold text-white/70">Categorias Permitidas</p>
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-auto rounded-lg border border-glass-border p-3 sm:grid-cols-2">
              {productCategories.length === 0 && (
                <p className="text-sm text-white/50">No hay categorias disponibles.</p>
              )}
              {productCategories.map((category) => (
                <label key={category} className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={selectedCreateCategories.includes(category)}
                    onChange={() => toggleCreateCategory(category)}
                    className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
                  />
                  {category}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/50">
              Si no activas ninguna categoria, el usuario no tendra acceso a productos. Si hay una categoria por defecto en Configuracion General, aparece preseleccionada aqui.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Crear Vendedor
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          l1Sellers={l1Sellers?.data || []}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}
    </div>
  );
}

function EditUserModal({
  user,
  l1Sellers,
  onClose,
  onSuccess,
}: {
  user: any;
  l1Sellers: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: fullUser } = useQuery({
    queryKey: ['user', user.id],
    queryFn: () => fetchUser(user.id),
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['products', 'categories'],
    queryFn: fetchProductCategories,
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ['settings', 'commissions', 'users-edit'],
    queryFn: () => fetchSettings('commissions'),
  });

  const globalCommissionScale = parseCommissionScaleSettings(commissionSettings);

  const form = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'SELLER_L1',
      parentId: user.parentId || '',
      commissionRate: user.commissionRate != null ? Number(user.commissionRate) * 100 : 10,
      commissionRateL2: user.commissionRateL2 != null ? Number(user.commissionRateL2) * 100 : 5,
      isActive: user.isActive ?? true,
      canManageSellers: user.canManageSellers ?? false,
      bankName: user.bankName || '',
      bankAccountType: user.bankAccountType || '',
      bankAccountNumber: user.bankAccountNumber || '',
      bankAccountHolder: user.bankAccountHolder || '',
      usdtWalletTrc20: user.usdtWalletTrc20 || '',
      commissionScaleEnabled: user.commissionScaleEnabled ?? false,
      commissionScaleUseGlobal: user.commissionScaleUseGlobal ?? true,
      commissionScaleOverride: Array.isArray(user.commissionScaleOverride)
        ? user.commissionScaleOverride
        : [],
      allowedCategories: [],
    },
  });

  const selectedCategories = form.watch('allowedCategories') || [];
  const editScaleEnabled = form.watch('commissionScaleEnabled') || false;
  const editScaleUseGlobal = form.watch('commissionScaleUseGlobal') ?? true;
  const editScaleOverride = form.watch('commissionScaleOverride') || [];

  const toggleAllowedCategory = (category: string) => {
    const current = form.getValues('allowedCategories') || [];
    const exists = current.includes(category);
    form.setValue(
      'allowedCategories',
      exists ? current.filter((c) => c !== category) : [...current, category],
      { shouldDirty: true },
    );
  };

  const [phoneCode, setPhoneCode] = useState(user.phoneCode || '+57');

  const updateEditScaleTier = (
    index: number,
    key: 'minSales' | 'maxSales' | 'ratePercent',
    value: string,
  ) => {
    const raw = value.replace(/\./g, '').replace(/,/g, '');
    const current = [...(form.getValues('commissionScaleOverride') || [])];
    if (!current[index]) return;
    current[index] = {
      ...current[index],
      [key]: raw === '' && key === 'maxSales' ? undefined : Number(raw || 0),
    };
    form.setValue('commissionScaleOverride', current, { shouldDirty: true });
  };

  const addEditScaleTier = () => {
    const current = form.getValues('commissionScaleOverride') || [];
    form.setValue(
      'commissionScaleOverride',
      [...current, { minSales: 0, maxSales: undefined, ratePercent: 0 }],
      { shouldDirty: true },
    );
  };

  const removeEditScaleTier = (index: number) => {
    const current = form.getValues('commissionScaleOverride') || [];
    form.setValue(
      'commissionScaleOverride',
      current.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const mutation = useMutation({
    mutationFn: (data: EditUserForm) => {
      const payload: any = {
        ...data,
        phoneCode,
        commissionRate: (data.commissionRate || 0) / 100,
        commissionRateL2: (data.commissionRateL2 || 0) / 100,
        parentId: data.parentId || null,
        bankName: data.bankName || null,
        bankAccountType: data.bankAccountType || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankAccountHolder: data.bankAccountHolder || null,
        usdtWalletTrc20: data.usdtWalletTrc20 || null,
        commissionScaleEnabled: !!data.commissionScaleEnabled,
        commissionScaleUseGlobal: data.commissionScaleUseGlobal ?? true,
        commissionScaleOverride:
          data.commissionScaleEnabled && !(data.commissionScaleUseGlobal ?? true)
            ? (data.commissionScaleOverride || []).map((tier) => ({
                minSales: Number(tier.minSales || 0),
                maxSales:
                  tier.maxSales === undefined || tier.maxSales === null || tier.maxSales === ('' as any)
                    ? undefined
                    : Number(tier.maxSales),
                ratePercent: Number(tier.ratePercent || 0),
              }))
            : [],
      };
      if (form.formState.dirtyFields.allowedCategories) {
        payload.allowedCategories = data.allowedCategories || [];
      }
      return updateUser(user.id, payload);
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user', user.id], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onSuccess();
    },
  });

  useEffect(() => {
    if (!fullUser || !Array.isArray((fullUser as any).allowedCategories)) return;
    const cats = (fullUser as any).allowedCategories
      .map((c: any) => c?.categoryName)
      .filter((c: any): c is string => !!c);
    form.setValue('allowedCategories', cats, { shouldDirty: false });
  }, [fullUser, form]);

  useEffect(() => {
    if (!editScaleEnabled || editScaleUseGlobal) return;
    const current = form.getValues('commissionScaleOverride') || [];
    if (current.length === 0) {
      form.setValue('commissionScaleOverride', globalCommissionScale, { shouldDirty: true });
    }
  }, [editScaleEnabled, editScaleUseGlobal, form, globalCommissionScale]);

  const watchRole = form.watch('role');

  return (
    <Modal open onClose={onClose} title="Editar Usuario" size="lg">
      <form onSubmit={form.handleSubmit((vals) => mutation.mutate(vals))} className="space-y-4">
        {mutation.isError && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            {(mutation.error as any)?.response?.data?.message || 'Error al actualizar'}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nombre" error={form.formState.errors.name?.message} required>
            <Input {...form.register('name')} error={!!form.formState.errors.name} />
          </FormField>
          <FormField label="Email" error={form.formState.errors.email?.message} required>
            <Input type="email" {...form.register('email')} error={!!form.formState.errors.email} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Telefono" error={form.formState.errors.phone?.message}>
            <PhoneInput
              value={form.watch('phone') || ''}
              onChange={(v) => form.setValue('phone', v)}
              phoneCode={phoneCode}
              onCodeChange={setPhoneCode}
              placeholder="3001234567"
            />
          </FormField>
          <FormField label="Rol" error={form.formState.errors.role?.message} required>
            <Select {...form.register('role')} error={!!form.formState.errors.role}>
              <option value="ADMIN">Admin</option>
              <option value="SELLER_L1">Vendedor L1</option>
              <option value="SELLER_L2">Vendedor L2</option>
            </Select>
          </FormField>
        </div>

        {watchRole === 'SELLER_L2' && (
          <FormField label="Vendedor Padre (L1)" error={form.formState.errors.parentId?.message}>
            <Select {...form.register('parentId')} error={!!form.formState.errors.parentId}>
              <option value="">Sin padre</option>
              {l1Sellers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!editScaleEnabled && (
            <FormField label="Comision L1 (%)" error={form.formState.errors.commissionRate?.message} hint="Ej: 30 = 30%">
              <Input
                {...form.register('commissionRate')}
                type="number"
                step="1"
                min="0"
                max="100"
                error={!!form.formState.errors.commissionRate}
              />
            </FormField>
          )}
          <FormField label="Comision L2 (%)" error={form.formState.errors.commissionRateL2?.message} hint="Ej: 5 = 5%">
            <Input
              {...form.register('commissionRateL2')}
              type="number"
              step="1"
              min="0"
              max="100"
              error={!!form.formState.errors.commissionRateL2}
            />
          </FormField>
        </div>

        <div className="rounded-lg border border-glass-border p-4 space-y-3">
          <p className="text-sm font-semibold text-white/80">Escala de Comisiones Mensual</p>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={editScaleEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                form.setValue('commissionScaleEnabled', enabled, { shouldDirty: true });
                if (enabled) {
                  form.setValue('commissionScaleUseGlobal', true, { shouldDirty: true });
                }
              }}
              className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
            />
            Habilitar escala escalonada para este vendedor
          </label>

          {editScaleEnabled && (
            <>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={editScaleUseGlobal}
                  onChange={(e) => {
                    const useGlobal = e.target.checked;
                    form.setValue('commissionScaleUseGlobal', useGlobal, { shouldDirty: true });
                    if (!useGlobal && editScaleOverride.length === 0) {
                      form.setValue('commissionScaleOverride', globalCommissionScale, {
                        shouldDirty: true,
                      });
                    }
                  }}
                  className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
                />
                Usar configuración global
              </label>

              {!editScaleUseGlobal && (
                <div className="space-y-3 rounded-lg border border-glass-border/70 p-3">
                  <p className="text-xs text-white/60">
                    Se cargan los valores globales por defecto para que los puedas ajustar.
                  </p>
                  {editScaleOverride.map((tier, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                      <FormField label="Desde (COP)">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(tier.minSales ?? 0)}
                          onChange={(e) => updateEditScaleTier(index, 'minSales', e.target.value)}
                        />
                      </FormField>
                      <FormField label="Hasta (COP)">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={tier.maxSales !== undefined ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(tier.maxSales) : ''}
                          onChange={(e) => updateEditScaleTier(index, 'maxSales', e.target.value)}
                          placeholder="Sin tope"
                        />
                      </FormField>
                      <FormField label="Comisión (%)">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={tier.ratePercent ?? 0}
                          onChange={(e) => updateEditScaleTier(index, 'ratePercent', e.target.value)}
                        />
                      </FormField>
                      <Button type="button" variant="ghost" onClick={() => removeEditScaleTier(index)}>
                        Eliminar
                      </Button>
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={addEditScaleTier}>
                    Agregar tramo
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-glass-border p-3">
          <input
            type="checkbox"
            id="isActive"
            {...form.register('isActive')}
            className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-white/70">
            Usuario activo
          </label>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-glass-border p-3">
          <input
            type="checkbox"
            id="canManageSellers"
            {...form.register('canManageSellers')}
            className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
          />
          <label htmlFor="canManageSellers" className="text-sm font-medium text-white/70">
            Puede gestionar sub-vendedores
          </label>
        </div>

        <div className="border-t border-glass-border pt-4">
          <p className="text-sm font-semibold text-white/70 mb-3">Categorias Permitidas</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-56 overflow-auto rounded-lg border border-glass-border p-3">
            {allCategories.length === 0 && (
              <p className="text-sm text-white/50">No hay categorias disponibles.</p>
            )}
            {allCategories.map((category) => (
              <label key={category} className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleAllowedCategory(category)}
                  className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
                />
                {category}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/50">
            Si no activas ninguna categoria, el usuario no tendra acceso a productos.
          </p>
        </div>

        <div className="border-t border-glass-border pt-4">
          <p className="text-sm font-semibold text-white/70 mb-3">Informacion Bancaria</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Banco">
              <Input {...form.register('bankName')} placeholder="Bancolombia" />
            </FormField>
            <FormField label="Tipo de Cuenta">
              <Select {...form.register('bankAccountType')}>
                <option value="">Seleccionar...</option>
                <option value="savings">Ahorros</option>
                <option value="checking">Corriente</option>
              </Select>
            </FormField>
            <FormField label="Numero de Cuenta">
              <Input {...form.register('bankAccountNumber')} placeholder="12345678901" />
            </FormField>
            <FormField label="Titular de la Cuenta">
              <Input {...form.register('bankAccountHolder')} placeholder="Nombre del titular" />
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="Wallet USDT (TRC20)">
              <Input {...form.register('usdtWalletTrc20')} placeholder="TRC20 wallet address" />
            </FormField>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-glass-border pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
