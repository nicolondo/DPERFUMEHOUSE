'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSettings,
  updateSettings,
  testOdooConnection,
  testPaymentConnection,
  testWompiConnection,
  fetchPaymentLogs,
  fetchOdooCompanies,
  fetchOdooPricelists,
  fetchOdooCategories,
  fetchProductCategories,
  fetchDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} from '@/lib/api';
import api from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { FormField } from '@/components/ui/form-field';
import { DataTable, type Column } from '@/components/ui/data-table';
import { PageSpinner } from '@/components/ui/spinner';
import {
  Database,
  CreditCard,
  Sliders,
  Layers,
  Save,
  Plug,
  Copy,
  CheckCircle,
  XCircle,
  Lock,
  Eye,
  EyeOff,
  Truck,
  Plus,
  Trash2,
  Percent,
  Tag,
} from 'lucide-react';

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

type Tab = 'odoo' | 'pagos' | 'envios' | 'escalas' | 'descuentos' | 'general' | 'cuenta';

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'odoo', label: 'Odoo', icon: <Database className="h-4 w-4" /> },
  { key: 'pagos', label: 'Pagos', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'envios', label: 'Envíos', icon: <Truck className="h-4 w-4" /> },
  { key: 'escalas', label: 'Escala de comisiones', icon: <Layers className="h-4 w-4" /> },
  { key: 'descuentos', label: 'Descuentos', icon: <Percent className="h-4 w-4" /> },
  { key: 'general', label: 'General', icon: <Sliders className="h-4 w-4" /> },
  { key: 'cuenta', label: 'Cuenta', icon: <Lock className="h-4 w-4" /> },
];

const tabMap: Record<string, Tab> = {
  odoo: 'odoo',
  payments: 'pagos',
  pagos: 'pagos',
  envios: 'envios',
  shipping: 'envios',
  escalas: 'escalas',
  'commission-scales': 'escalas',
  discounts: 'descuentos',
  descuentos: 'descuentos',
  general: 'general',
  cuenta: 'cuenta',
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') || 'odoo';
  const [activeTab, setActiveTab] = useState<Tab>(tabMap[tabParam] || 'odoo');

  useEffect(() => {
    const mapped = tabMap[tabParam];
    if (mapped) setActiveTab(mapped);
  }, [tabParam]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const urlTab = tab === 'pagos' ? 'payments' : tab;
    router.replace(`/settings?tab=${urlTab}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Configuracion</h1>
        <p className="page-description">Ajustes de integraciones y parametros del sistema</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-glass-border -mx-3 sm:-mx-0 px-3 sm:px-0">
        <nav className="flex gap-1 sm:gap-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 sm:gap-2 border-b-2 px-2 sm:px-1 pb-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-accent-purple text-accent-purple'
                  : 'border-transparent text-white/50 hover:border-glass-border hover:text-white/70'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'odoo' && <OdooSettings />}
      {activeTab === 'pagos' && <PaymentSettings />}
      {activeTab === 'envios' && <ShippingSettings />}
      {activeTab === 'escalas' && <CommissionScaleSettings />}
      {activeTab === 'descuentos' && <DiscountSettings />}
      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'cuenta' && <AccountSettings />}
    </div>
  );
}

/* ─── Quantity Discounts ─── */
type QuantityDiscount = {
  id: string;
  name: string;
  minQuantity: number;
  discountPercent: number;
  categories: string[];
  variantId: string | null;
  variant: { id: string; name: string; sku: string | null; categoryName: string | null } | null;
  isActive: boolean;
  priority: number;
};

function DiscountSettings() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    minQuantity: 3,
    discountPercent: 5,
    categories: [] as string[],
    isActive: true,
    priority: 0,
  });

  const { data: discounts = [], isLoading } = useQuery<QuantityDiscount[]>({
    queryKey: ['discounts'],
    queryFn: fetchDiscounts,
  });

  const { data: productCategories = [] } = useQuery<string[]>({
    queryKey: ['products', 'categories', 'discount-form'],
    queryFn: fetchProductCategories,
  });

  const createMut = useMutation({
    mutationFn: (dto: any) => createDiscount(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      resetForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => updateDiscount(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      resetForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDiscount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateDiscount(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts'] }),
  });

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ name: '', minQuantity: 3, discountPercent: 5, categories: [], isActive: true, priority: 0 });
  }

  function handleEdit(d: QuantityDiscount) {
    setEditId(d.id);
    setForm({
      name: d.name,
      minQuantity: d.minQuantity,
      discountPercent: Number(d.discountPercent),
      categories: (d.categories as string[]) || [],
      isActive: d.isActive,
      priority: d.priority,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dto = {
      name: form.name,
      minQuantity: form.minQuantity,
      discountPercent: form.discountPercent,
      categories: form.categories,
      isActive: form.isActive,
      priority: form.priority,
    };
    if (editId) {
      updateMut.mutate({ id: editId, dto });
    } else {
      createMut.mutate(dto);
    }
  }

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-accent-purple" />
              Descuentos por Cantidad
            </CardTitle>
            <p className="text-sm text-white/50 mt-1">
              Configura descuentos automáticos cuando un cliente compra varias unidades
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo descuento
            </Button>
          )}
        </CardHeader>
      </Card>

      {showForm && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editId ? 'Editar descuento' : 'Nuevo descuento'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Nombre de la regla">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: 3+ unidades = 5% dcto"
                    required
                  />
                </FormField>
                <FormField label="Categorías (opcional)">
                  <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 p-3">
                    {productCategories.length === 0 ? (
                      <p className="text-sm text-white/40">Sin categorías disponibles</p>
                    ) : (
                      productCategories.map((cat) => (
                        <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.categories.includes(cat)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({ ...form, categories: [...form.categories, cat] });
                              } else {
                                setForm({ ...form, categories: form.categories.filter((c) => c !== cat) });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-white/80">{cat}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1">Dejar vacío = aplica a todos los productos</p>
                </FormField>
                <FormField label="Cantidad mínima">
                  <Input
                    type="number"
                    min={2}
                    value={form.minQuantity}
                    onChange={(e) => setForm({ ...form, minQuantity: parseInt(e.target.value) || 2 })}
                    required
                  />
                </FormField>
                <FormField label="% de descuento">
                  <Input
                    type="number"
                    min={0.000001}
                    max={100}
                    step="any"
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </FormField>
                <FormField label="Prioridad (mayor = preferido)">
                  <Input
                    type="number"
                    min={0}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  />
                </FormField>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded"
                  />
                  Activo
                </label>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editId ? 'Guardar cambios' : 'Crear descuento'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {discounts.length === 0 && !showForm ? (
        <Card>
          <div className="p-12 text-center">
            <Percent className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white/70 mb-2">Sin descuentos configurados</h3>
            <p className="text-sm text-white/40 mb-6">
              Crea reglas de descuento para incentivar compras en cantidad
            </p>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Crear primer descuento
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {discounts.map((d) => (
            <Card key={d.id} className={cn(!d.isActive && 'opacity-50')}>
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex items-center justify-center h-12 min-w-12 px-3 rounded-lg bg-accent-purple/10 text-accent-purple font-bold text-sm whitespace-nowrap">
                    {parseFloat(Number(d.discountPercent).toFixed(2))}%
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.name}</p>
                    <p className="text-sm text-white/50 truncate">
                      Compras de {d.minQuantity}+ unidades
                      {d.categories && (d.categories as string[]).length > 0 && <span> · Categorías: <span className="text-white/70">{(d.categories as string[]).join(', ')}</span></span>}
                      {d.variant && <span> · Producto: <span className="text-white/70">{d.variant.name}</span></span>}
                      {(!d.categories || (d.categories as string[]).length === 0) && !d.variant && <span> · Todos los productos</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={d.isActive ? 'success' : 'default'}>
                    {d.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMut.mutate({ id: d.id, isActive: !d.isActive })}
                  >
                    {d.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(d)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('¿Eliminar este descuento?')) deleteMut.mutate(d.id);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CommissionScaleSettings() {
  const queryClient = useQueryClient();
  const [tiers, setTiers] = useState<CommissionScaleTier[]>(DEFAULT_COMMISSION_SCALE);
  const [validationError, setValidationError] = useState('');

  const { data: commissionSettings, isLoading } = useQuery({
    queryKey: ['settings', 'commissions', 'scale'],
    queryFn: () => fetchSettings('commissions'),
  });

  useEffect(() => {
    const raw = (commissionSettings || []).find((s: any) => s.key === 'commission_scale_tiers_json')?.value;
    if (!raw) {
      setTiers(DEFAULT_COMMISSION_SCALE);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setTiers(
          parsed.map((tier: any) => ({
            minSales: Number(tier?.minSales || 0),
            maxSales:
              tier?.maxSales === undefined || tier?.maxSales === null || tier?.maxSales === ''
                ? undefined
                : Number(tier.maxSales),
            ratePercent: Number(tier?.ratePercent || 0),
          })),
        );
      } else {
        setTiers(DEFAULT_COMMISSION_SCALE);
      }
    } catch {
      setTiers(DEFAULT_COMMISSION_SCALE);
    }
  }, [commissionSettings]);

  const validateTiers = (rows: CommissionScaleTier[]) => {
    if (rows.length === 0) return 'Debes definir al menos un tramo';

    const sorted = [...rows].sort((a, b) => a.minSales - b.minSales);
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      if (!Number.isFinite(row.minSales) || row.minSales < 0) {
        return 'Todos los valores Desde deben ser mayores o iguales a 0';
      }
      if (!Number.isFinite(row.ratePercent) || row.ratePercent < 0 || row.ratePercent > 100) {
        return 'Todos los porcentajes deben estar entre 0 y 100';
      }
      if (row.maxSales !== undefined) {
        if (!Number.isFinite(row.maxSales) || row.maxSales < 0) {
          return 'Todos los valores Hasta deben ser mayores o iguales a 0';
        }
        if (row.maxSales < row.minSales) {
          return 'Hasta no puede ser menor que Desde';
        }
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        if (prev.maxSales === undefined) {
          return 'Un tramo abierto (sin Hasta) debe ser el último';
        }
        if (row.minSales <= prev.maxSales) {
          return 'Hay solapamiento entre tramos de comisión';
        }
      }
    }

    return '';
  };

  const updateTier = (index: number, key: 'minSales' | 'maxSales' | 'ratePercent', value: string) => {
    const raw = value.replace(/\./g, '').replace(/,/g, '');
    const next = [...tiers];
    next[index] = {
      ...next[index],
      [key]: raw === '' && key === 'maxSales' ? undefined : Number(raw || 0),
    };
    setTiers(next);
  };

  const formatCOP = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
  };

  const addTier = () => setTiers((prev) => [...prev, { minSales: 0, maxSales: undefined, ratePercent: 0 }]);
  const removeTier = (index: number) => setTiers((prev) => prev.filter((_, i) => i !== index));

  const saveMutation = useMutation({
    mutationFn: () => {
      const normalized = [...tiers].sort((a, b) => a.minSales - b.minSales);
      const error = validateTiers(normalized);
      if (error) {
        throw new Error(error);
      }
      return updateSettings([
        {
          key: 'commission_scale_tiers_json',
          value: JSON.stringify(normalized),
        },
      ]);
    },
    onSuccess: () => {
      setValidationError('');
      queryClient.invalidateQueries({ queryKey: ['settings', 'commissions'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error: any) => {
      setValidationError(error?.message || 'Error al guardar la escala');
    },
  });

  if (isLoading) return <PageSpinner />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escala de Comisiones</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          Define la escala global por defecto. Al personalizar un vendedor, estos valores se precargan para editarlos.
        </p>

        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end rounded-lg border border-glass-border p-3">
              <FormField label="Desde (COP)">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatCOP(tier.minSales)}
                  onChange={(e) => updateTier(index, 'minSales', e.target.value)}
                />
              </FormField>
              <FormField label="Hasta (COP)">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={tier.maxSales !== undefined ? formatCOP(tier.maxSales) : ''}
                  onChange={(e) => updateTier(index, 'maxSales', e.target.value)}
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
                  onChange={(e) => updateTier(index, 'ratePercent', e.target.value)}
                />
              </FormField>
              <Button type="button" variant="ghost" onClick={() => removeTier(index)}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addTier}>
            <Plus className="h-4 w-4 mr-1" /> Agregar tramo
          </Button>
        </div>

        {(validationError || saveMutation.isError) && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            {validationError || 'Error al guardar la escala'}
          </div>
        )}

        {saveMutation.isSuccess && (
          <div className="rounded-lg bg-status-success-muted p-3 text-sm text-status-success">
            Escala de comisiones guardada correctamente.
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> Guardar Escala
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OdooSettings() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [database, setDatabase] = useState('');
  const [uid, setUid] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [pricelistId, setPricelistId] = useState('');
  const [pricelists, setPricelists] = useState<{ id: number; name: string }[]>([]);
  const [loadingPricelists, setLoadingPricelists] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Cuentas contables por medio de pago
  const [accountOnline, setAccountOnline] = useState('');
  const [accountCash, setAccountCash] = useState('');
  const [accountTransfer, setAccountTransfer] = useState('');
  const [accountUsdt, setAccountUsdt] = useState('');
  const [accountCommissions, setAccountCommissions] = useState('');
  const [commissionsJournalId, setCommissionsJournalId] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'odoo'],
    queryFn: () => fetchSettings('odoo'),
  });

  useEffect(() => {
    if (settings) {
      const map = new Map(settings.map((s: any) => [s.key, s.value]));
      setUrl((map.get('odoo_url') as string) || '');
      setDatabase((map.get('odoo_db') as string) || '');
      setUid((map.get('odoo_uid') as string) || '');
      setApiKey((map.get('odoo_api_key') as string) || '');
      setCompanyId((map.get('odoo_company_id') as string) || '');
      setPricelistId((map.get('odoo_pricelist_id') as string) || '');
      setAccountOnline((map.get('odoo_account_online') as string) || '');
      setAccountCash((map.get('odoo_account_cash') as string) || '');
      setAccountTransfer((map.get('odoo_account_transfer') as string) || '');
      setAccountUsdt((map.get('odoo_account_usdt') as string) || '');
      setAccountCommissions((map.get('odoo_account_commissions') as string) || '');
      setCommissionsJournalId((map.get('odoo_commissions_journal_id') as string) || '');
      try {
        const categs = map.get('odoo_sync_categories') as string;
        if (categs) setSelectedCategories(JSON.parse(categs));
      } catch { /* ignore */ }
    }
  }, [settings]);

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const result = await fetchOdooCompanies();
      setCompanies(Array.isArray(result) ? result : []);
    } catch {
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadPricelists = async () => {
    setLoadingPricelists(true);
    try {
      const result = await fetchOdooPricelists();
      setPricelists(Array.isArray(result) ? result : []);
    } catch {
      setPricelists([]);
    } finally {
      setLoadingPricelists(false);
    }
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const result = await fetchOdooCategories();
      setCategories(Array.isArray(result) ? result : []);
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleCategory = (id: number) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Load companies, pricelists, categories when Odoo settings are available
  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const map = new Map(settings.map((s: any) => [s.key, s.value]));
      if (map.get('odoo_url') && map.get('odoo_db') && map.get('odoo_uid') && map.get('odoo_api_key')) {
        loadCompanies();
        loadPricelists();
        loadCategories();
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSettings([
        { key: 'odoo_url', value: url },
        { key: 'odoo_db', value: database },
        { key: 'odoo_uid', value: uid },
        { key: 'odoo_api_key', value: apiKey },
        { key: 'odoo_company_id', value: companyId },
        { key: 'odoo_pricelist_id', value: pricelistId },
        { key: 'odoo_sync_categories', value: JSON.stringify(selectedCategories) },
        { key: 'odoo_account_online', value: accountOnline },
        { key: 'odoo_account_cash', value: accountCash },
        { key: 'odoo_account_transfer', value: accountTransfer },
        { key: 'odoo_account_usdt', value: accountUsdt },
        { key: 'odoo_account_commissions', value: accountCommissions },
        { key: 'odoo_commissions_journal_id', value: commissionsJournalId },
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'odoo'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: testOdooConnection,
    onSuccess: (data) => setTestResult(data || { success: true, message: 'Conexion exitosa' }),
    onError: () => setTestResult({ success: false, message: 'Error al conectar con Odoo' }),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexion Odoo</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <FormField label="URL" required>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://odoo.example.com"
          />
        </FormField>
        <FormField label="Base de Datos" required>
          <Input
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder="nombre_base_datos"
          />
        </FormField>
        <FormField label="UID" required>
          <Input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="1"
          />
        </FormField>
        <FormField label="API Key" required>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Tu API key de Odoo"
          />
        </FormField>

        <FormField label="Compañia" hint="Selecciona la compañia de Odoo para sincronizar">
          <div className="flex gap-2">
            <Select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="flex-1"
            >
              <option value="">Seleccionar compañia...</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCompanies}
              loading={loadingCompanies}
              className="whitespace-nowrap"
            >
              Cargar
            </Button>
          </div>
        </FormField>

        <FormField label="Lista de Precios" hint="Selecciona la lista de precios para los productos sincronizados">
          <div className="flex gap-2">
            <Select
              value={pricelistId}
              onChange={(e) => setPricelistId(e.target.value)}
              className="flex-1"
            >
              <option value="">Precio de lista (por defecto)</option>
              {pricelists.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPricelists}
              loading={loadingPricelists}
              className="whitespace-nowrap"
            >
              Cargar
            </Button>
          </div>
        </FormField>

        <FormField label="Categorias a Sincronizar" hint="Selecciona las categorias de productos a importar. Si no seleccionas ninguna, se importan todas.">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar categoria..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={loadCategories}
                loading={loadingCategories}
                className="whitespace-nowrap"
              >
                Cargar
              </Button>
            </div>
            {categories.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-glass-border p-2 space-y-1">
                {categories
                  .filter(c => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  .map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-glass-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                      className="rounded border-glass-border text-accent-purple focus:ring-accent-purple/50"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedCategories.length > 0 && (
              <p className="text-xs text-white/50">
                {selectedCategories.length} categoria(s) seleccionada(s)
              </p>
            )}
          </div>
        </FormField>

        {testResult && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg p-3 text-sm',
              testResult.success ? 'bg-status-success-muted text-status-success' : 'bg-status-danger-muted text-status-danger'
            )}
          >
            {testResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {testResult.message}
          </div>
        )}

        {/* Cuentas contables por medio de pago */}
        <div className="border-t border-glass-border pt-4 mt-2">
          <h4 className="text-sm font-semibold text-white mb-3">Cuentas Contables por Medio de Pago</h4>
          <p className="text-xs text-white/50 mb-4">Ingresa el código contable (PUC) de la cuenta en Odoo para cada medio de pago. Se usará al registrar pagos en facturas.</p>
          <div className="space-y-3">
            <FormField label="Pago Online (Wompi / Pasarela)" hint="Código de cuenta contable en Odoo (ej: 111001)">
              <Input
                value={accountOnline}
                onChange={(e) => setAccountOnline(e.target.value)}
                placeholder="Ej: 111001"
              />
            </FormField>
            <FormField label="Efectivo" hint="Código de cuenta contable en Odoo (ej: 110505)">
              <Input
                value={accountCash}
                onChange={(e) => setAccountCash(e.target.value)}
                placeholder="Ej: 110505"
              />
            </FormField>
            <FormField label="Transferencia Bancaria" hint="Código de cuenta contable en Odoo (ej: 111001)">
              <Input
                value={accountTransfer}
                onChange={(e) => setAccountTransfer(e.target.value)}
                placeholder="Ej: 111001"
              />
            </FormField>
            <FormField label="USDT TRC20" hint="Código de cuenta contable en Odoo (ej: 111005)">
              <Input
                value={accountUsdt}
                onChange={(e) => setAccountUsdt(e.target.value)}
                placeholder="Ej: 111005"
              />
            </FormField>
            <FormField label="Pago de Comisiones a Vendedores" hint="Código de cuenta contable en Odoo (crédito) donde se registran los pagos de comisiones (ej: 236520)">
              <Input
                value={accountCommissions}
                onChange={(e) => setAccountCommissions(e.target.value)}
                placeholder="Ej: 236520"
              />
            </FormField>
            <FormField label="Diario de Asientos de Comisiones" hint="Prefijo de secuencia del diario en Odoo (campo Código, ej: MISC). Si se deja vacío se usa el primer diario de tipo Varios/General.">
              <Input
                value={commissionsJournalId}
                onChange={(e) => setCommissionsJournalId(e.target.value.toUpperCase())}
                placeholder="Ej: MISC"
              />
            </FormField>
          </div>
        </div>

        {saveMutation.isSuccess && (
          <div className="rounded-lg bg-status-success-muted p-3 text-sm text-status-success">
            Configuracion guardada correctamente.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            icon={<Plug className="h-4 w-4" />}
            onClick={() => { setTestResult(null); testMutation.mutate(); }}
            loading={testMutation.isPending}
          >
            Probar Conexion
          </Button>
          <Button
            icon={<Save className="h-4 w-4" />}
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            Guardar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PaymentSettings() {
  const queryClient = useQueryClient();
  // Active provider
  const [activeProvider, setActiveProvider] = useState('myxspend');
  // MyxSpend
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [postbackUrl, setPostbackUrl] = useState('');
  // Wompi
  const [wompiPublicKey, setWompiPublicKey] = useState('');
  const [wompiPrivateKey, setWompiPrivateKey] = useState('');
  const [wompiEventsSecret, setWompiEventsSecret] = useState('');
  const [wompiIntegritySecret, setWompiIntegritySecret] = useState('');
  const [wompiEnvironment, setWompiEnvironment] = useState('sandbox');
  // Shared
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [wompiTestResult, setWompiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [myxExpanded, setMyxExpanded] = useState(true);
  const [wompiExpanded, setWompiExpanded] = useState(true);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'payments'],
    queryFn: () => fetchSettings('payments'),
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['payment-logs', logPage],
    queryFn: () => fetchPaymentLogs({ page: logPage }),
  });

  useEffect(() => {
    if (settings) {
      const map = new Map(settings.map((s: any) => [s.key, s.value]));
      setActiveProvider((map.get('active_payment_provider') as string) || 'myxspend');
      // MyxSpend
      setEmail((map.get('myxspend_email') as string) || '');
      setPassword((map.get('myxspend_password') as string) || '');
      setBaseUrl((map.get('myxspend_base_url') as string) || '');
      setPostbackUrl((map.get('myxspend_postback_url') as string) || '');
      // Wompi
      setWompiPublicKey((map.get('wompi_public_key') as string) || '');
      setWompiPrivateKey((map.get('wompi_private_key') as string) || '');
      setWompiEventsSecret((map.get('wompi_events_secret') as string) || '');
      setWompiIntegritySecret((map.get('wompi_integrity_secret') as string) || '');
      setWompiEnvironment((map.get('wompi_environment') as string) || 'sandbox');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSettings([
        { key: 'active_payment_provider', value: activeProvider },
        // MyxSpend
        { key: 'myxspend_email', value: email },
        { key: 'myxspend_password', value: password },
        { key: 'myxspend_base_url', value: baseUrl },
        // Wompi
        { key: 'wompi_public_key', value: wompiPublicKey },
        { key: 'wompi_private_key', value: wompiPrivateKey },
        { key: 'wompi_events_secret', value: wompiEventsSecret },
        { key: 'wompi_integrity_secret', value: wompiIntegritySecret },
        { key: 'wompi_environment', value: wompiEnvironment },
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'payments'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: testPaymentConnection,
    onSuccess: (data) => setTestResult(data || { success: true, message: 'Conexion exitosa' }),
    onError: () => setTestResult({ success: false, message: 'Error al conectar con MyxSpend' }),
  });

  const testWompiMutation = useMutation({
    mutationFn: testWompiConnection,
    onSuccess: (data) => setWompiTestResult(data || { success: true, message: 'Conexion exitosa' }),
    onError: () => setWompiTestResult({ success: false, message: 'Error al conectar con Wompi' }),
  });

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  const wompiWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin.replace('admin', 'api').replace(':3001', ':4000')}/api/payments/wompi-webhook`
    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/payments/wompi-webhook`;

  const logColumns: Column<any>[] = [
    {
      key: 'type',
      header: 'Tipo',
      render: (log) => <span className="text-sm text-white/70">{log.type || log.eventType}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (log) => (
        <Badge variant={log.status === 'success' || log.status === 'COMPLETED' || log.status === 'APPROVED' ? 'success' : 'danger'}>
          {log.status}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Monto',
      render: (log) => <span className="text-sm">{log.amount ? `$${Number(log.amount).toLocaleString()}` : '-'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Fecha',
      render: (log) => <span className="text-sm text-white/50">{formatDateTime(log.createdAt)}</span>,
    },
  ];

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Active Provider Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Proveedor de Pagos Activo</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <p className="text-sm text-white/60">
            Selecciona el proveedor que se usará para generar nuevos links de pago.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setActiveProvider('myxspend')}
              className={cn(
                'flex-1 rounded-lg border-2 p-4 text-left transition-all',
                activeProvider === 'myxspend'
                  ? 'border-accent-gold bg-accent-gold/10'
                  : 'border-white/10 bg-glass-50 hover:border-white/20'
              )}
            >
              <div className="font-semibold text-white">MyxSpend</div>
              <div className="text-sm text-white/50">Pasarela de pagos MyxSpend</div>
            </button>
            <button
              type="button"
              onClick={() => setActiveProvider('wompi')}
              className={cn(
                'flex-1 rounded-lg border-2 p-4 text-left transition-all',
                activeProvider === 'wompi'
                  ? 'border-accent-gold bg-accent-gold/10'
                  : 'border-white/10 bg-glass-50 hover:border-white/20'
              )}
            >
              <div className="font-semibold text-white">Wompi</div>
              <div className="text-sm text-white/50">Plataforma de pagos Bancolombia</div>
            </button>
          </div>
        </div>
      </Card>

      {/* MyxSpend Configuration */}
      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setMyxExpanded(!myxExpanded)}
            className="flex w-full items-center justify-between"
          >
            <CardTitle className="flex items-center gap-2">
              MyxSpend
              {activeProvider === 'myxspend' && (
                <Badge variant="success">Activo</Badge>
              )}
            </CardTitle>
            <span className="text-white/50">{myxExpanded ? '▲' : '▼'}</span>
          </button>
        </CardHeader>
        {myxExpanded && (
          <div className="space-y-4">
            <FormField label="Email" required>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </FormField>
            <FormField label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contrasena"
              />
            </FormField>
            <FormField label="Base URL" required>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.myxspend.com/v1"
              />
            </FormField>
            <FormField label="Postback URL" hint="URL de webhook (solo lectura)">
              <div className="flex gap-2">
                <Input value={postbackUrl} readOnly className="bg-glass-50" />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleCopy(postbackUrl, 'postback')}
                  icon={copied === 'postback' ? <CheckCircle className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
                >
                  {copied === 'postback' ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </FormField>

            {testResult && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg p-3 text-sm',
                  testResult.success ? 'bg-status-success-muted text-status-success' : 'bg-status-danger-muted text-status-danger'
                )}
              >
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            <Button
              variant="outline"
              icon={<Plug className="h-4 w-4" />}
              onClick={() => { setTestResult(null); testMutation.mutate(); }}
              loading={testMutation.isPending}
            >
              Probar Conexion
            </Button>
          </div>
        )}
      </Card>

      {/* Wompi Configuration */}
      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setWompiExpanded(!wompiExpanded)}
            className="flex w-full items-center justify-between"
          >
            <CardTitle className="flex items-center gap-2">
              Wompi
              {activeProvider === 'wompi' && (
                <Badge variant="success">Activo</Badge>
              )}
            </CardTitle>
            <span className="text-white/50">{wompiExpanded ? '▲' : '▼'}</span>
          </button>
        </CardHeader>
        {wompiExpanded && (
          <div className="space-y-4">
            <FormField label="Ambiente">
              <Select
                value={wompiEnvironment}
                onChange={(e) => setWompiEnvironment(e.target.value)}
              >
                <option value="sandbox">Sandbox (Pruebas)</option>
                <option value="production">Produccion</option>
              </Select>
            </FormField>
            <FormField label="Llave Publica" required>
              <Input
                value={wompiPublicKey}
                onChange={(e) => setWompiPublicKey(e.target.value)}
                placeholder="pub_test_..."
              />
            </FormField>
            <FormField label="Llave Privada" required>
              <Input
                type="password"
                value={wompiPrivateKey}
                onChange={(e) => setWompiPrivateKey(e.target.value)}
                placeholder="prv_test_..."
              />
            </FormField>
            <FormField label="Secreto de Eventos" required hint="Para verificacion de webhooks">
              <Input
                type="password"
                value={wompiEventsSecret}
                onChange={(e) => setWompiEventsSecret(e.target.value)}
                placeholder="test_events_..."
              />
            </FormField>
            <FormField label="Secreto de Integridad" hint="Para firma de transacciones">
              <Input
                type="password"
                value={wompiIntegritySecret}
                onChange={(e) => setWompiIntegritySecret(e.target.value)}
                placeholder="test_integrity_..."
              />
            </FormField>
            <FormField label="Webhook URL" hint="Configura esta URL en el dashboard de Wompi">
              <div className="flex gap-2">
                <Input value={wompiWebhookUrl} readOnly className="bg-glass-50" />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleCopy(wompiWebhookUrl, 'wompi-webhook')}
                  icon={copied === 'wompi-webhook' ? <CheckCircle className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
                >
                  {copied === 'wompi-webhook' ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </FormField>

            {wompiTestResult && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg p-3 text-sm',
                  wompiTestResult.success ? 'bg-status-success-muted text-status-success' : 'bg-status-danger-muted text-status-danger'
                )}
              >
                {wompiTestResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {wompiTestResult.message}
              </div>
            )}

            <Button
              variant="outline"
              icon={<Plug className="h-4 w-4" />}
              onClick={() => { setWompiTestResult(null); testWompiMutation.mutate(); }}
              loading={testWompiMutation.isPending}
            >
              Probar Conexion Wompi
            </Button>
          </div>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex gap-3">
        {saveMutation.isSuccess && (
          <div className="flex items-center rounded-lg bg-status-success-muted px-4 py-2 text-sm text-status-success">
            Configuracion guardada correctamente.
          </div>
        )}
        <Button
          icon={<Save className="h-4 w-4" />}
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
        >
          Guardar Configuracion de Pagos
        </Button>
      </div>

      {/* Payment Logs */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Eventos de Pago Recientes</h2>
        <DataTable
          columns={logColumns}
          data={logs?.data || []}
          loading={logsLoading}
          page={logPage}
          pageSize={20}
          total={logs?.meta?.total || 0}
          onPageChange={setLogPage}
          keyExtractor={(l) => l.id}
          emptyMessage="No hay eventos de pago"
        />
      </div>
    </div>
  );
}

function ShippingSettings() {
  const queryClient = useQueryClient();
  const [originName, setOriginName] = useState('');
  const [originPhone, setOriginPhone] = useState('');
  const [originPhoneCode, setOriginPhoneCode] = useState('+57');
  const [originStreet, setOriginStreet] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originCountry, setOriginCountry] = useState('CO');
  const [originZip, setOriginZip] = useState('');
  const [defaultWeight, setDefaultWeight] = useState('1');
  const [defaultLength, setDefaultLength] = useState('25');
  const [defaultWidth, setDefaultWidth] = useState('20');
  const [defaultHeight, setDefaultHeight] = useState('10');
  const [senderIdType, setSenderIdType] = useState('CC');
  const [senderIdNumber, setSenderIdNumber] = useState('');
  const [enviaApiKey, setEnviaApiKey] = useState('');
  const [enviaBaseUrl, setEnviaBaseUrl] = useState('https://api.envia.com');
  const [enviaQueriesUrl, setEnviaQueriesUrl] = useState('https://queries.envia.com');
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'shipping'],
    queryFn: () => fetchSettings('shipping', true),
  });

  useEffect(() => {
    if (settings) {
      const map = new Map(settings.map((s: any) => [s.key, s.value]));
      setOriginName((map.get('shipping_origin_name') as string) || '');
      setOriginPhone((map.get('shipping_origin_phone') as string) || '');
      setOriginPhoneCode((map.get('shipping_origin_phone_code') as string) || '+57');
      setOriginStreet((map.get('shipping_origin_street') as string) || '');
      setOriginCity((map.get('shipping_origin_city') as string) || '');
      setOriginState((map.get('shipping_origin_state') as string) || '');
      setOriginCountry((map.get('shipping_origin_country') as string) || 'CO');
      setOriginZip((map.get('shipping_origin_zip') as string) || '');
      setSenderIdType((map.get('shipping_sender_id_type') as string) || 'CC');
      setSenderIdNumber((map.get('shipping_sender_id_number') as string) || '');
      setDefaultWeight((map.get('shipping_default_weight') as string) || '1');
      setEnviaApiKey((map.get('envia_api_key') as string) || '');
      setEnviaBaseUrl((map.get('envia_base_url') as string) || 'https://api.envia.com');
      setEnviaQueriesUrl((map.get('envia_queries_url') as string) || 'https://queries.envia.com');
      try {
        const dims = JSON.parse((map.get('shipping_default_dimensions') as string) || '{}');
        setDefaultLength(String(dims.length || 25));
        setDefaultWidth(String(dims.width || 20));
        setDefaultHeight(String(dims.height || 10));
      } catch {
        // ignore
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items: { key: string; value: string }[] = [
        { key: 'shipping_origin_name', value: originName },
        { key: 'shipping_origin_phone', value: originPhone },
        { key: 'shipping_origin_phone_code', value: originPhoneCode },
        { key: 'shipping_origin_street', value: originStreet },
        { key: 'shipping_origin_city', value: originCity },
        { key: 'shipping_origin_state', value: originState },
        { key: 'shipping_origin_country', value: originCountry },
        { key: 'shipping_origin_zip', value: originZip },
        { key: 'shipping_sender_id_type', value: senderIdType },
        { key: 'shipping_sender_id_number', value: senderIdNumber },
        { key: 'shipping_default_weight', value: defaultWeight },
        { key: 'shipping_default_dimensions', value: JSON.stringify({
          length: Number(defaultLength),
          width: Number(defaultWidth),
          height: Number(defaultHeight),
          unit: 'CM',
        }) },
        { key: 'envia_api_key', value: enviaApiKey },
        { key: 'envia_base_url', value: enviaBaseUrl },
        { key: 'envia_queries_url', value: enviaQueriesUrl },
      ];
      await updateSettings(items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'shipping'] });
    },
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dirección de Origen (Bodega)</CardTitle>
        </CardHeader>
        <div className="p-6 pt-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Nombre del remitente">
              <Input value={originName} onChange={(e) => setOriginName(e.target.value)} placeholder="Nombre o razón social" />
            </FormField>
            <FormField label="Teléfono">
              <PhoneInput
                value={originPhone}
                onChange={setOriginPhone}
                phoneCode={originPhoneCode}
                onCodeChange={setOriginPhoneCode}
                placeholder="3001234567"
              />
            </FormField>
          </div>
          <FormField label="Dirección">
            <Input value={originStreet} onChange={(e) => setOriginStreet(e.target.value)} placeholder="Cra 50 #30-20" />
          </FormField>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField label="Ciudad">
              <Input value={originCity} onChange={(e) => setOriginCity(e.target.value)} placeholder="Bogotá" />
            </FormField>
            <FormField label="Departamento">
              <Input value={originState} onChange={(e) => setOriginState(e.target.value)} placeholder="Cundinamarca" />
            </FormField>
            <FormField label="País">
              <Input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="CO" />
            </FormField>
            <FormField label="Código postal">
              <Input value={originZip} onChange={(e) => setOriginZip(e.target.value)} placeholder="110111" />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Tipo de identificación">
              <select
                value={senderIdType}
                onChange={(e) => setSenderIdType(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-glass-border bg-glass-100 px-3 py-1.5 text-sm text-white focus:border-accent-purple/50 focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:ring-offset-0 transition-colors"
              >
                <option value="CC" className="bg-[#1a1a1a] text-white">CC - Cédula de Ciudadanía</option>
                <option value="NIT" className="bg-[#1a1a1a] text-white">NIT - Número de Identificación Tributaria</option>
                <option value="CE" className="bg-[#1a1a1a] text-white">CE - Cédula de Extranjería</option>
                <option value="PP" className="bg-[#1a1a1a] text-white">PP - Pasaporte</option>
              </select>
            </FormField>
            <FormField label="Número de identificación" className="sm:col-span-2">
              <Input value={senderIdNumber} onChange={(e) => setSenderIdNumber(e.target.value)} placeholder="900123456-7" />
            </FormField>
          </div>
          <p className="text-xs text-gray-500">Requerido por algunas transportadoras como Interrapidísimo para generar guías.</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dimensiones Predeterminadas del Paquete</CardTitle>
        </CardHeader>
        <div className="p-6 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField label="Peso (KG)">
              <Input type="number" value={defaultWeight} onChange={(e) => setDefaultWeight(e.target.value)} />
            </FormField>
            <FormField label="Largo (CM)">
              <Input type="number" value={defaultLength} onChange={(e) => setDefaultLength(e.target.value)} />
            </FormField>
            <FormField label="Ancho (CM)">
              <Input type="number" value={defaultWidth} onChange={(e) => setDefaultWidth(e.target.value)} />
            </FormField>
            <FormField label="Alto (CM)">
              <Input type="number" value={defaultHeight} onChange={(e) => setDefaultHeight(e.target.value)} />
            </FormField>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API de Envíos (Envia.com)</CardTitle>
        </CardHeader>
        <div className="p-6 pt-0 space-y-4">
          <FormField label="API Key">
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={enviaApiKey}
                onChange={(e) => setEnviaApiKey(e.target.value)}
                placeholder="Tu API key de envia.com"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="URL Base API">
              <Input value={enviaBaseUrl} onChange={(e) => setEnviaBaseUrl(e.target.value)} placeholder="https://api.envia.com" />
            </FormField>
            <FormField label="URL Consultas API">
              <Input value={enviaQueriesUrl} onChange={(e) => setEnviaQueriesUrl(e.target.value)} placeholder="https://queries.envia.com" />
            </FormField>
          </div>
          <p className="text-xs text-gray-500">Sandbox: api-test.envia.com / queries-test.envia.com — Producción: api.envia.com / queries.envia.com</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración de Envíos'}
        </Button>
      </div>

      {saveMutation.isSuccess && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Configuración de envíos guardada correctamente
          </p>
        </div>
      )}
      {saveMutation.isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400 flex items-center gap-2">
            <XCircle className="h-4 w-4" /> Error al guardar configuración
          </p>
        </div>
      )}
    </div>
  );
}

function GeneralSettings() {
  const queryClient = useQueryClient();
  const [commissionL1, setCommissionL1] = useState('');
  const [commissionL2, setCommissionL2] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [defaultNewUserCategory, setDefaultNewUserCategory] = useState('');

  const formatCommissionForInput = (raw: unknown, fallback: string) => {
    const value = String(raw ?? '').trim();
    if (!value) return fallback;
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return fallback;
    // Backward-compatible: stored as decimal (0.1) or percentage (10)
    return n <= 1 ? String(n * 100) : String(n);
  };

  const { data: generalSettings, isLoading: loadingGeneral } = useQuery({
    queryKey: ['settings', 'general'],
    queryFn: () => fetchSettings('general'),
  });

  const { data: commissionSettings, isLoading: loadingCommissions } = useQuery({
    queryKey: ['settings', 'commissions'],
    queryFn: () => fetchSettings('commissions'),
  });

  const { data: productCategories = [] } = useQuery({
    queryKey: ['products', 'categories', 'settings'],
    queryFn: fetchProductCategories,
  });

  const isLoading = loadingGeneral || loadingCommissions;

  useEffect(() => {
    const all = [...(generalSettings || []), ...(commissionSettings || [])];
    if (all.length > 0) {
      const map = new Map(all.map((s: any) => [s.key, s.value]));
      setCommissionL1(formatCommissionForInput(map.get('commission_l1_rate'), '10'));
      setCommissionL2(formatCommissionForInput(map.get('commission_l2_rate'), '5'));
      const rawTax = String(map.get('tax_rate') ?? map.get('default_tax_rate') ?? '19').trim();
      const taxNum = Number.parseFloat(rawTax);
      setTaxRate(Number.isFinite(taxNum) && taxNum > 0 && taxNum <= 1 ? String(taxNum * 100) : (rawTax || '19'));
      setShippingCost((map.get('default_shipping_cost') as string) || (map.get('default_shipping') as string) || '15000');
      setDefaultNewUserCategory((map.get('default_new_user_category') as string) || '');
    }
  }, [generalSettings, commissionSettings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSettings([
        { key: 'commission_l1_rate', value: commissionL1 },
        { key: 'commission_l2_rate', value: commissionL2 },
        { key: 'tax_rate', value: taxRate },
        { key: 'default_shipping_cost', value: shippingCost },
        { key: 'default_new_user_category', value: defaultNewUserCategory },
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  if (isLoading) return <PageSpinner />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parametros Generales</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Comision L1 (%)" required hint="Tasa de comision para vendedores nivel 1">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={commissionL1}
              onChange={(e) => setCommissionL1(e.target.value)}
              placeholder="10"
            />
          </FormField>
          <FormField label="Comision L2 (%)" required hint="Tasa de comision para vendedores nivel 2">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={commissionL2}
              onChange={(e) => setCommissionL2(e.target.value)}
              placeholder="5"
            />
          </FormField>
          <FormField label="Tasa de Impuestos (%)" required>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="19"
            />
          </FormField>
          <FormField label="Costo de Envio por Defecto" required>
            <Input
              type="number"
              step="100"
              min="0"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              placeholder="15000"
            />
          </FormField>
          <FormField
            label="Categoria por Defecto para Usuarios Nuevos"
            hint="Se activa automaticamente al crear usuarios nuevos."
          >
            <Select
              value={defaultNewUserCategory}
              onChange={(e) => setDefaultNewUserCategory(e.target.value)}
            >
              <option value="">Sin categoria por defecto</option>
              {productCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {saveMutation.isSuccess && (
          <div className="rounded-lg bg-status-success-muted p-3 text-sm text-status-success">
            Parametros guardados correctamente.
          </div>
        )}

        {saveMutation.isError && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            Error al guardar los parametros.
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            icon={<Save className="h-4 w-4" />}
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            Guardar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AccountSettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const handleChangePassword = async () => {
    setError('');
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar Contraseña</CardTitle>
      </CardHeader>
      <div className="p-6 pt-0 space-y-4 max-w-md">
        <div className="relative">
          <FormField label="Contraseña actual" required>
            <Input
              type={showCurrentPw ? 'text' : 'password'}
              placeholder="Tu contraseña actual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </FormField>
          <button
            type="button"
            onClick={() => setShowCurrentPw(!showCurrentPw)}
            className="absolute right-3 top-[38px] text-white/30 hover:text-white/60"
          >
            {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <FormField label="Nueva contraseña" required>
            <Input
              type={showNewPw ? 'text' : 'password'}
              placeholder="Minimo 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </FormField>
          <button
            type="button"
            onClick={() => setShowNewPw(!showNewPw)}
            className="absolute right-3 top-[38px] text-white/30 hover:text-white/60"
          >
            {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FormField label="Confirmar nueva contraseña" required>
          <Input
            type="password"
            placeholder="Repite la nueva contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FormField>

        {error && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-status-success-muted p-3 text-sm text-status-success">
            Contraseña cambiada exitosamente
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            icon={<Save className="h-4 w-4" />}
            onClick={handleChangePassword}
            loading={loading}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Cambiar Contraseña
          </Button>
        </div>
      </div>
    </Card>
  );
}
