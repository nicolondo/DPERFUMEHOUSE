'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetchUser, updateUser, toggleUserStatus, deleteUser, fetchUsers, fetchProductCategories, fetchSettings, fetchCustomers, fetchOrders } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Modal } from '@/components/ui/modal';
import { FormField } from '@/components/ui/form-field';
import { PageSpinner } from '@/components/ui/spinner';
import { DataTable, Column } from '@/components/ui/data-table';
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils';
import { ArrowLeft, Mail, Shield, Users, TrendingUp, User, Pencil, Save, Phone, Building2, Wallet, Plus, Trash2, Contact, ShoppingBag } from 'lucide-react';

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

const commissionStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  APPROVED: 'info',
  PAID: 'success',
  CANCELLED: 'danger',
};

const editSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres'),
  email: z.string().email('Email invalido'),
  phone: z.string().optional().or(z.literal('')),
  role: z.enum(['SELLER_L1', 'SELLER_L2', 'ADMIN']),
  parentId: z.string().optional().or(z.literal('')),
  commissionRate: z.coerce.number().min(0).max(100),
  commissionRateL2: z.coerce.number().min(0).max(100),
  canManageSellers: z.boolean().optional(),
  bankName: z.string().optional().or(z.literal('')),
  bankAccountType: z.string().optional().or(z.literal('')),
  bankAccountNumber: z.string().optional().or(z.literal('')),
  bankAccountHolder: z.string().optional().or(z.literal('')),
  identificationNumber: z.string().optional().or(z.literal('')),
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

type EditForm = z.infer<typeof editSchema>;

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: customersData } = useQuery({
    queryKey: ['customers', 'by-seller', userId],
    queryFn: () => fetchCustomers({ sellerId: userId, pageSize: 200 }),
    enabled: !!userId,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'by-seller', userId],
    queryFn: () => fetchOrders({ sellerId: userId, pageSize: 100 }),
    enabled: !!userId,
  });

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  const { data: commissionSettingsMain } = useQuery({
    queryKey: ['settings', 'commissions', 'user-detail'],
    queryFn: () => fetchSettings('commissions'),
  });

  const globalCommissionScaleMain = parseCommissionScaleSettings(commissionSettingsMain);

  const toggleMutation = useMutation({
    mutationFn: () => toggleUserStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      router.push('/users');
    },
  });

  if (isLoading) return <PageSpinner />;

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
          Volver
        </Button>
        <div className="rounded-xl border border-status-danger/30 bg-status-danger-muted p-6 text-center">
          <p className="text-sm text-status-danger">Error al cargar el usuario.</p>
        </div>
      </div>
    );
  }

  const commissionColumns: Column<any>[] = [
    {
      key: 'orderNumber',
      header: 'Pedido',
      render: (item) => <span className="font-medium">#{item.order?.orderNumber || item.orderNumber || item.orderId?.slice(0, 8)}</span>,
    },
    {
      key: 'level',
      header: 'Nivel',
      render: (item) => <Badge variant="outline">{item.level || '-'}</Badge>,
    },
    {
      key: 'rate',
      header: 'Tasa',
      render: (item) => <span>{item.rate != null ? formatPercent(item.rate) : '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Monto',
      render: (item) => <span className="font-medium">{formatCurrency(item.amount || 0)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => (
        <Badge variant={commissionStatusVariant[item.status] || 'default'}>{item.status}</Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (item) => <span className="text-white/50">{formatDate(item.createdAt)}</span>,
    },
  ];

  const subSellerColumns: Column<any>[] = [
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
      key: 'commissionRate',
      header: 'Comision',
      render: (item) => <span>{item.commissionRate != null ? formatPercent(item.commissionRate) : '-'}</span>,
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (item) => (
        <Badge variant={item.isActive ? 'success' : 'default'}>{item.isActive ? 'Activo' : 'Inactivo'}</Badge>
      ),
    },
  ];

  const orderStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    PENDING: 'default',
    PENDING_PAYMENT: 'warning',
    PAID: 'success',
    CONFIRMED: 'success',
    SHIPPED: 'info',
    IN_TRANSIT: 'warning',
    DELIVERED: 'success',
    CANCELLED: 'danger',
  };

  const sellerOrders = (ordersData?.data || ordersData || []) as any[];

  const orderColumns: Column<any>[] = [
    {
      key: 'orderNumber',
      header: 'Pedido',
      render: (item) => (
        <button
          onClick={() => router.push(`/orders/${item.id}`)}
          className="font-medium text-accent hover:underline cursor-pointer"
        >
          #{item.orderNumber}
        </button>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (item) => <span>{item.customer?.name || '-'}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (item) => <span className="font-medium">{formatCurrency(item.total || 0)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => (
        <Badge variant={orderStatusVariant[item.status] || 'default'}>{item.status}</Badge>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Pago',
      render: (item) => (
        <Badge variant={item.paymentStatus === 'COMPLETED' ? 'success' : item.paymentStatus === 'FAILED' ? 'danger' : 'warning'}>
          {item.paymentStatus || 'PENDING'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (item) => <span className="text-white/50">{formatDate(item.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
        Volver a Vendedores
      </Button>

      {/* Profile Card */}
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple-muted text-2xl font-bold text-accent-purple">
              {user.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">{user.name}</h1>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Mail className="h-4 w-4" />
                {user.email}
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Phone className="h-4 w-4" />
                  {user.phone}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Badge variant={roleVariant[user.role] || 'default'}>
                  {roleLabels[user.role] || user.role}
                </Badge>
                <Badge variant={user.pendingApproval ? 'warning' : user.isActive ? 'success' : 'default'}>
                  {user.pendingApproval ? 'Pendiente Aprobación' : user.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
                {user.canManageSellers && (
                  <Badge variant="info">Gestiona Vendedores</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => setShowEdit(true)}
            >
              Editar
            </Button>
            <Button
              variant={user.isActive ? 'danger' : 'primary'}
              onClick={() => toggleMutation.mutate()}
              loading={toggleMutation.isPending}
            >
              {user.isActive ? 'Desactivar' : user.pendingApproval ? 'Aprobar' : 'Activar'}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => setShowDelete(true)}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Comision L1 / L2</p>
              <p className="text-lg font-bold text-white">
                {user.commissionScaleEnabled ? (
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    <span className="text-accent">Escala</span>
                  </span>
                ) : (
                  user.commissionRate != null ? formatPercent(user.commissionRate) : '-'
                )}
                {' / '}
                {user.commissionRateL2 != null ? formatPercent(user.commissionRateL2) : '-'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-success-muted text-status-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Ingresos Totales</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(user.totalRevenue || user.stats?.totalRevenue || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold-muted text-accent-gold">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Comisiones Totales</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(user.totalCommissions || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning-muted text-status-warning">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Total Pedidos</p>
              <p className="text-lg font-bold text-white">
                {user.totalOrders || user.stats?.totalOrders || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Sub-vendedores</p>
              <p className="text-lg font-bold text-white">
                {user.subSellers?.length || user.children?.length || 0}
              </p>
            </div>
          </div>
        </Card>
        {user.role === "SELLER_L2" && user.parent && (
          <div
            className="rounded-2xl border border-glass-border bg-glass-100 shadow-glass backdrop-blur-xl p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => router.push("/users/" + user.parent!.id)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/50">Vendedor Padre (L1)</p>
                <p className="text-sm font-semibold text-white truncate">{user.parent.name}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Commission Scale Summary */}
      {user.commissionScaleEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Escala de Comisiones
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant={user.commissionScaleUseGlobal !== false ? 'default' : 'warning'}>
                {user.commissionScaleUseGlobal !== false ? 'Escala Global' : 'Escala Personalizada'}
              </Badge>
              <span className="text-xs text-white/50">Tasa base: {formatPercent(user.commissionRate)}</span>
            </div>
            {(() => {
              const tiers: CommissionScaleTier[] =
                !user.commissionScaleUseGlobal && Array.isArray(user.commissionScaleOverride) && user.commissionScaleOverride.length > 0
                  ? (user.commissionScaleOverride as CommissionScaleTier[])
                  : globalCommissionScaleMain;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/50">
                        <th className="pb-2 text-left font-medium">Desde</th>
                        <th className="pb-2 text-left font-medium">Hasta</th>
                        <th className="pb-2 text-left font-medium">Tasa</th>
                        <th className="pb-2 text-left font-medium">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 text-white/70">{formatCurrency(tier.minSales)}</td>
                          <td className="py-1.5 text-white/70">
                            {tier.maxSales != null ? formatCurrency(tier.maxSales) : '∞'}
                          </td>
                          <td className="py-1.5 font-medium text-white">{tier.ratePercent}%</td>
                          <td className="py-1.5 text-accent-purple">
                            +{Math.max(0, tier.ratePercent - Math.round((user.commissionRate || 0) * 100)).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Bank / Payment Info */}
      {(user.bankName || user.bankAccountNumber || user.identificationNumber || user.usdtWalletTrc20 || user.bankCertificateUrl) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Datos Bancarios / Pago
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {user.bankName && (
              <div>
                <p className="text-xs font-medium text-white/50">Banco</p>
                <p className="text-sm text-white">{user.bankName}</p>
              </div>
            )}
            {user.bankAccountType && (
              <div>
                <p className="text-xs font-medium text-white/50">Tipo Cuenta</p>
                <p className="text-sm text-white">{user.bankAccountType}</p>
              </div>
            )}
            {user.bankAccountNumber && (
              <div>
                <p className="text-xs font-medium text-white/50">Numero Cuenta</p>
                <p className="text-sm text-white">{user.bankAccountNumber}</p>
              </div>
            )}
            {user.bankAccountHolder && (
              <div>
                <p className="text-xs font-medium text-white/50">Titular</p>
                <p className="text-sm text-white">{user.bankAccountHolder}</p>
              </div>
            )}
            {user.identificationNumber && (
              <div>
                <p className="text-xs font-medium text-white/50">Identificación / Cédula</p>
                <p className="text-sm text-white">{user.identificationNumber}</p>
              </div>
            )}
            {user.usdtWalletTrc20 && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-white/50">
                  <Wallet className="mr-1 inline h-3 w-3" />
                  Wallet USDT TRC20
                </p>
                <p className="text-sm font-mono text-white">{user.usdtWalletTrc20}</p>
              </div>
            )}
            {user.bankCertificateUrl && (
              <div className="sm:col-span-3">
                <p className="text-xs font-medium text-white/50">Certificación Bancaria</p>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${user.bankCertificateUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Ver certificado
                </a>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Sales History */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-white">Historial de Ventas</h3>
          {sellerOrders.length > 0 && (
            <Badge variant="default" className="ml-auto">{sellerOrders.length} pedidos</Badge>
          )}
        </div>
        <div className="p-4">
          <DataTable
            columns={orderColumns}
            data={sellerOrders}
            emptyMessage="No hay pedidos registrados"
            keyExtractor={(item) => item.id}
          />
        </div>
      </Card>

      {/* Commissions */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Historial de Comisiones</h3>
        </div>
        <div className="p-4">
          <DataTable
            columns={commissionColumns}
            data={user.commissions || []}
            emptyMessage="No hay comisiones registradas"
            keyExtractor={(item) => item.id}
          />
        </div>
      </Card>

      {/* Sub-sellers */}
      {user.role === 'SELLER_L1' && (
        <Card padding={false}>
          <div className="border-b border-glass-border px-6 py-4">
            <h3 className="text-lg font-semibold text-white">Sub-vendedores (L2)</h3>
          </div>
          <div className="p-4">
            <DataTable
              columns={subSellerColumns}
              data={user.subSellers || user.children || []}
              emptyMessage="No tiene sub-vendedores asignados"
              keyExtractor={(item) => item.id}
              onRowClick={(item) => router.push(`/users/${item.id}`)}
            />
          </div>
        </Card>
      )}

      {/* Customers */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Contact className="h-5 w-5" /> Clientes ({customersData?.data?.length ?? 0})
          </h3>
        </div>
        <div className="p-4">
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Cliente',
                render: (c: any) => (
                  <div>
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-xs text-white/50">{c.email}</p>
                  </div>
                ),
              },
              {
                key: 'phone',
                header: 'Teléfono',
                render: (c: any) => <span className="text-white/70">{c.phone ? `${c.phoneCode || ''} ${c.phone}`.trim() : '-'}</span>,
              },
              {
                key: 'city',
                header: 'Ciudad',
                render: (c: any) => <span className="text-white/70">{c.addresses?.[0]?.city || '-'}</span>,
              },
              {
                key: 'createdAt',
                header: 'Fecha',
                render: (c: any) => <span className="text-white/50">{formatDate(c.createdAt)}</span>,
              },
            ]}
            data={customersData?.data ?? []}
            emptyMessage="Este vendedor no tiene clientes registrados"
            keyExtractor={(c) => c.id}
            onRowClick={(c) => router.push(`/customers/${c.id}`)}
          />
        </div>
      </Card>

      {/* Edit Modal */}
      {showEdit && (
        <EditUserModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ['user', userId] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Eliminar Vendedor"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            ¿Estás seguro de que deseas eliminar a{' '}
            <span className="font-semibold text-white">{user.name}</span>? Esta acción es{' '}
            <span className="font-semibold text-status-danger">irreversible</span> y eliminará todos sus datos asociados.
          </p>
          {deleteMutation.isError && (
            <p className="text-xs text-status-danger">
              {(deleteMutation.error as any)?.response?.data?.message || 'No se pudo eliminar el vendedor'}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowDelete(false)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'SELLER_L1',
      parentId: user.parentId || '',
      commissionRate: Math.round((parseFloat(user.commissionRate) || 0.1) * 100),
      commissionRateL2: Math.round((parseFloat(user.commissionRateL2) || 0.05) * 100),
      canManageSellers: user.canManageSellers ?? false,
      bankName: user.bankName || '',
      bankAccountType: user.bankAccountType || '',
      bankAccountNumber: user.bankAccountNumber || '',
      bankAccountHolder: user.bankAccountHolder || '',
      identificationNumber: user.identificationNumber || '',
      usdtWalletTrc20: user.usdtWalletTrc20 || '',
      commissionScaleEnabled: user.commissionScaleEnabled ?? false,
      commissionScaleUseGlobal: user.commissionScaleUseGlobal ?? true,
      commissionScaleOverride: Array.isArray(user.commissionScaleOverride)
        ? user.commissionScaleOverride
        : [],
      allowedCategories: [],
    },
  });

  const watchRole = form.watch('role');
  const selectedCategories = form.watch('allowedCategories') || [];
  const scaleEnabled = form.watch('commissionScaleEnabled') || false;
  const scaleUseGlobal = form.watch('commissionScaleUseGlobal') ?? true;
  const scaleOverride = form.watch('commissionScaleOverride') || [];

  const [phoneCode, setPhoneCode] = useState(user.phoneCode || '+57');

  const { data: l1Sellers } = useQuery({
    queryKey: ['users', 'l1-sellers'],
    queryFn: () => fetchUsers({ role: 'SELLER_L1', pageSize: 100 }),
    enabled: watchRole === 'SELLER_L2',
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['products', 'categories', 'user-detail-edit'],
    queryFn: fetchProductCategories,
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ['settings', 'commissions', 'user-detail-edit'],
    queryFn: () => fetchSettings('commissions'),
  });

  const globalCommissionScale = parseCommissionScaleSettings(commissionSettings);

  useEffect(() => {
    if (!Array.isArray(user.allowedCategories)) return;
    const categories = user.allowedCategories
      .map((item: any) => item?.categoryName)
      .filter((category: any): category is string => !!category);
    form.setValue('allowedCategories', categories, { shouldDirty: false });
  }, [user, form]);

  const toggleAllowedCategory = (category: string) => {
    const current = form.getValues('allowedCategories') || [];
    const exists = current.includes(category);
    form.setValue(
      'allowedCategories',
      exists ? current.filter((item) => item !== category) : [...current, category],
      { shouldDirty: true },
    );
  };

  const updateScaleTier = (
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

  const addScaleTier = () => {
    const current = form.getValues('commissionScaleOverride') || [];
    form.setValue(
      'commissionScaleOverride',
      [...current, { minSales: 0, maxSales: undefined, ratePercent: 0 }],
      { shouldDirty: true },
    );
  };

  const removeScaleTier = (index: number) => {
    const current = form.getValues('commissionScaleOverride') || [];
    form.setValue(
      'commissionScaleOverride',
      current.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const mutation = useMutation({
    mutationFn: (data: EditForm) => updateUser(user.id, data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user', user.id], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onSuccess();
    },
  });

  useEffect(() => {
    if (!scaleEnabled || scaleUseGlobal) return;
    const current = form.getValues('commissionScaleOverride') || [];
    if (current.length === 0) {
      form.setValue('commissionScaleOverride', globalCommissionScale, { shouldDirty: true });
    }
  }, [scaleEnabled, scaleUseGlobal, form, globalCommissionScale]);

  const onSubmit = (data: EditForm) => {
    const payload: any = {
      ...data,
      phoneCode,
      commissionRate: data.commissionRate / 100,
      commissionRateL2: data.commissionRateL2 / 100,
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
    if (!payload.phone) delete payload.phone;
    if (!payload.parentId) delete payload.parentId;
    if (!payload.bankName) payload.bankName = null;
    if (!payload.bankAccountType) payload.bankAccountType = null;
    if (!payload.bankAccountNumber) payload.bankAccountNumber = null;
    if (!payload.bankAccountHolder) payload.bankAccountHolder = null;
    if (!payload.identificationNumber) payload.identificationNumber = null;
    if (!payload.usdtWalletTrc20) payload.usdtWalletTrc20 = null;
    mutation.mutate(payload);
  };

  return (
    <Modal open onClose={onClose} title="Editar Vendedor" size="lg">
      <form onSubmit={form.handleSubmit(onSubmit, (errs) => console.error('[edit user] validation errors', errs))} className="space-y-5">
        {mutation.isError && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            {(mutation.error as any)?.response?.data?.message || 'Error al actualizar'}
          </div>
        )}

        {Object.keys(form.formState.errors).length > 0 && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            <p className="font-semibold">Por favor corrige los siguientes campos:</p>
            <ul className="ml-4 mt-1 list-disc">
              {Object.entries(form.formState.errors).map(([key, err]: any) => (
                <li key={key}>
                  {key}: {err?.message || 'invalido'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-white/70">Informacion Basica</h4>
          <div className="h-px bg-glass-border" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nombre" error={form.formState.errors.name?.message} required>
            <Input {...form.register('name')} />
          </FormField>
          <FormField label="Email" error={form.formState.errors.email?.message} required>
            <Input type="email" {...form.register('email')} />
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
            <Select {...form.register('role')}>
              <option value="SELLER_L1">Vendedor L1</option>
              <option value="SELLER_L2">Vendedor L2</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!scaleEnabled && (
            <FormField label="Comision L1 (%)" error={form.formState.errors.commissionRate?.message} required>
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                {...form.register('commissionRate')}
              />
            </FormField>
          )}
          <FormField label="Comision L2 (%)" error={form.formState.errors.commissionRateL2?.message}>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              {...form.register('commissionRateL2')}
            />
          </FormField>
        </div>

        <div className="rounded-lg border border-glass-border p-4 space-y-3">
          <p className="text-sm font-semibold text-white/80">Escala de Comisiones Mensual</p>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={scaleEnabled}
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

          {scaleEnabled && (
            <>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={scaleUseGlobal}
                  onChange={(e) => {
                    const useGlobal = e.target.checked;
                    form.setValue('commissionScaleUseGlobal', useGlobal, { shouldDirty: true });
                    if (!useGlobal && scaleOverride.length === 0) {
                      form.setValue('commissionScaleOverride', globalCommissionScale, {
                        shouldDirty: true,
                      });
                    }
                  }}
                  className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
                />
                Usar configuración global
              </label>

              {!scaleUseGlobal && (
                <div className="space-y-3 rounded-lg border border-glass-border/70 p-3">
                  <p className="text-xs text-white/60">
                    Se cargan los valores globales por defecto para que los puedas ajustar.
                  </p>
                  {scaleOverride.map((tier, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                      <FormField label="Desde (COP)">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(tier.minSales ?? 0)}
                          onChange={(e) => updateScaleTier(index, 'minSales', e.target.value)}
                        />
                      </FormField>
                      <FormField label="Hasta (COP)">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={tier.maxSales !== undefined ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(tier.maxSales) : ''}
                          onChange={(e) => updateScaleTier(index, 'maxSales', e.target.value)}
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
                          onChange={(e) => updateScaleTier(index, 'ratePercent', e.target.value)}
                        />
                      </FormField>
                      <Button type="button" variant="ghost" onClick={() => removeScaleTier(index)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                      </Button>
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={addScaleTier}>
                    <Plus className="h-4 w-4 mr-1" /> Agregar tramo
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {watchRole === 'SELLER_L2' && (
          <FormField label="Vendedor L1 (Padre)" error={form.formState.errors.parentId?.message}>
            <Select {...form.register('parentId')}>
              <option value="">Sin padre</option>
              {(l1Sellers?.data || [])
                .filter((s: any) => s.id !== user.id)
                .map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
            </Select>
          </FormField>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-glass-border p-3">
          <input
            type="checkbox"
            id="canManageSellers-detail"
            {...form.register('canManageSellers')}
            className="h-4 w-4 rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
          />
          <label htmlFor="canManageSellers-detail" className="text-sm font-medium text-white/70">
            Puede gestionar sub-vendedores
          </label>
        </div>

        <div className="space-y-1 pt-2">
          <h4 className="text-sm font-semibold text-white/70">Categorias Permitidas</h4>
          <div className="h-px bg-glass-border" />
        </div>

        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-auto rounded-lg border border-glass-border p-3 sm:grid-cols-2">
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

        <p className="text-xs text-white/50">
          Si no activas ninguna categoria, el usuario no tendra acceso a productos.
        </p>

        {/* Bank Info */}
        <div className="space-y-1 pt-2">
          <h4 className="text-sm font-semibold text-white/70">Datos Bancarios</h4>
          <div className="h-px bg-glass-border" />
        </div>

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
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Numero de Cuenta">
            <Input {...form.register('bankAccountNumber')} placeholder="000-000000-00" />
          </FormField>
          <FormField label="Titular">
            <Input {...form.register('bankAccountHolder')} placeholder="Nombre completo" />
          </FormField>
        </div>

        <FormField label="Identificación / Cédula del Titular">
          <Input {...form.register('identificationNumber')} placeholder="1020304050" />
        </FormField>

        {/* USDT */}
        <div className="space-y-1 pt-2">
          <h4 className="text-sm font-semibold text-white/70">Pago Crypto</h4>
          <div className="h-px bg-glass-border" />
        </div>

        <FormField label="Wallet USDT TRC20">
          <Input {...form.register('usdtWalletTrc20')} placeholder="T..." className="font-mono" />
        </FormField>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-glass-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={mutation.isPending}
          >
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
