'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  fetchFragranceProfiles,
  fetchVariantsWithProfileStatus,
  createFragranceProfile,
  updateFragranceProfile,
  enrichFragranceProfile,
  bulkImportFragranceProfiles,
  fetchFragellaFields,
} from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { Plus, Sparkles, Upload, FlaskConical, Pencil, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const profileSchema = z.object({
  productVariantId: z.string().min(1, 'Seleccioná un producto'),
  familiaOlfativa: z.string().optional(),
  subfamilia: z.string().optional(),
  intensidad: z.string().optional(),
  contextoIdeal: z.string().optional(),
  climaIdeal: z.string().optional(),
  perfilPersonalidad: z.string().optional(),
  notasDestacadas: z.string().optional(),
  descripcionDetallada: z.string().optional(),
  duracionEstimada: z.string().optional(),
  tagsNegativos: z.string().optional(),
  frasePositionamiento: z.string().optional(),
  genero: z.string().optional(),
  equivalencia: z.string().optional(),
  notasAdicionales: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const GENEROS = ['Masculino', 'Femenino', 'Unisex'];
const INTENSIDADES = ['Suave', 'Moderada', 'Intensa', 'Muy Intensa'];
const FAMILIAS = [
  'Amaderado', 'Ambarado', 'Ambarado-Especiado', 'Ambarado-Floral', 'Ambarado-Oriental',
  'Aromático', 'Chipre', 'Cítrico', 'Floral', 'Floral-Amaderado',
  'Floriental-Frutal', 'Frutal', 'Frutal Floral', 'Frutal-Ambarado', 'Frutal-Gourmand',
  'Gourmand', 'Gourmand-Lácteo', 'Oriental', 'Oriental Frutal', 'Oriental-Gourmand',
  'Verde',
];

export default function FragrancesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [tab, setTab] = useState<'profiles' | 'variants'>('profiles');
  const [fragellaLoading, setFragellaLoading] = useState(false);
  const [fragellaError, setFragellaError] = useState('');

  const lookupFragella = async (form: any) => {
    const equivalencia = form.getValues('equivalencia');
    if (!equivalencia?.trim()) return;
    setFragellaLoading(true);
    setFragellaError('');
    try {
      const fields = await fetchFragellaFields(equivalencia.trim());
      if (!fields) {
        setFragellaError('No se encontró la fragancia en Fragella');
        return;
      }
      // Auto-fill all returned fields (only overwrite if the value is non-empty)
      const mapping: Record<string, string> = {
        familiaOlfativa: 'familiaOlfativa',
        subfamilia: 'subfamilia',
        intensidad: 'intensidad',
        genero: 'genero',
        contextoIdeal: 'contextoIdeal',
        climaIdeal: 'climaIdeal',
        perfilPersonalidad: 'perfilPersonalidad',
        notasDestacadas: 'notasDestacadas',
        descripcionDetallada: 'descripcionDetallada',
        duracionEstimada: 'duracionEstimada',
        frasePositionamiento: 'frasePositionamiento',
        tagsNegativos: 'tagsNegativos',
        notasAdicionales: 'notasAdicionales',
      };
      for (const [apiKey, formKey] of Object.entries(mapping)) {
        if (fields[apiKey] !== undefined && fields[apiKey] !== null && fields[apiKey] !== '') {
          const val = Array.isArray(fields[apiKey]) ? fields[apiKey].join(', ') : fields[apiKey];
          form.setValue(formKey as any, val, { shouldDirty: true });
        }
      }
    } catch {
      setFragellaError('Error al consultar Fragella');
    } finally {
      setFragellaLoading(false);
    }
  };

  // Profiles list
  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: ['fragrance-profiles', page, search],
    queryFn: () => fetchFragranceProfiles({ page, pageSize: 20, search: search || undefined }),
    enabled: tab === 'profiles',
  });

  // Variants without profiles
  const { data: variantsData, isLoading: variantsLoading } = useQuery({
    queryKey: ['variants-profile-status', search],
    queryFn: () => fetchVariantsWithProfileStatus({ search: search || undefined, pageSize: 100 }),
    enabled: tab === 'variants',
  });

  const createMutation = useMutation({
    mutationFn: createFragranceProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fragrance-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['variants-profile-status'] });
      setShowCreate(false);
      createForm.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...dto }: any) => updateFragranceProfile(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fragrance-profiles'] });
      setEditingProfile(null);
    },
  });

  const enrichMutation = useMutation({
    mutationFn: enrichFragranceProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fragrance-profiles'] });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: bulkImportFragranceProfiles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fragrance-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['variants-profile-status'] });
      setShowBulkImport(false);
      setBulkData('');
    },
  });

  const createForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  const editForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  // Profile columns
  const profileColumns: Column<any>[] = [
    {
      key: 'product',
      header: 'Producto',
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.productVariant?.name || 'N/A'}</p>
          <p className="text-xs text-white/40">{item.productVariant?.sku || item.productVariant?.categoryName || '—'}</p>
        </div>
      ),
    },
    {
      key: 'familiaOlfativa',
      header: 'Familia',
      render: (item) => <span className="text-sm text-white/70">{item.familiaOlfativa || '—'}</span>,
    },
    {
      key: 'genero',
      header: 'Género',
      render: (item) => item.genero ? <Badge variant="info">{item.genero}</Badge> : <span className="text-white/30">—</span>,
    },
    {
      key: 'equivalencia',
      header: 'Equivalencia',
      render: (item) => <span className="text-sm text-white/50">{item.equivalencia || '—'}</span>,
    },
    {
      key: 'completionScore',
      header: 'Completitud',
      render: (item) => {
        const score = item.completionScore || 0;
        const color = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
        return <span className={`text-sm font-medium ${color}`}>{score}%</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              enrichMutation.mutate(item.id);
            }}
            disabled={enrichMutation.isPending}
            icon={<Sparkles className="h-3.5 w-3.5" />}
          >
            AI
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setEditingProfile(item);
              editForm.reset({
                productVariantId: item.productVariantId,
                familiaOlfativa: item.familiaOlfativa || '',
                subfamilia: item.subfamilia || '',
                intensidad: item.intensidad || '',
                contextoIdeal: item.contextoIdeal || '',
                climaIdeal: item.climaIdeal || '',
                perfilPersonalidad: item.perfilPersonalidad || '',
                notasDestacadas: item.notasDestacadas || '',
                descripcionDetallada: item.descripcionDetallada || '',
                duracionEstimada: item.duracionEstimada || '',
                tagsNegativos: Array.isArray(item.tagsNegativos) ? item.tagsNegativos.join(', ') : item.tagsNegativos || '',
                frasePositionamiento: item.frasePositionamiento || '',
                genero: item.genero || '',
                equivalencia: item.equivalencia || '',
                notasAdicionales: item.notasAdicionales || '',
              });
            }}
            icon={<Pencil className="h-3.5 w-3.5" />}
          />
        </div>
      ),
    },
  ];

  // Variant columns (without profile)
  const variantColumns: Column<any>[] = [
    {
      key: 'product',
      header: 'Producto',
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.product?.name || item.name || 'N/A'}</p>
          <p className="text-xs text-white/40">{item.name} — {item.size}</p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      render: (item) => <span className="text-sm">{formatCurrency(item.price)}</span>,
    },
    {
      key: 'hasProfile',
      header: 'Perfil',
      render: (item) =>
        item.fragranceProfile ? (
          <Badge variant="success">Configurado</Badge>
        ) : (
          <Badge variant="warning">Sin perfil</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (item) =>
        !item.fragranceProfile ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              createForm.reset({ productVariantId: item.id });
              setShowCreate(true);
            }}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Crear perfil
          </Button>
        ) : null,
    },
  ];

  const handleCreate = (data: ProfileForm) => {
    createMutation.mutate({
      ...data,
      tagsNegativos: data.tagsNegativos ? data.tagsNegativos.split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
  };

  const handleEdit = (data: ProfileForm) => {
    if (!editingProfile) return;
    // Omit productVariantId — not allowed in UpdateFragranceProfileDto (forbidNonWhitelisted)
    const { productVariantId: _omit, ...updateData } = data;
    updateMutation.mutate({
      id: editingProfile.id,
      ...updateData,
      tagsNegativos: data.tagsNegativos ? data.tagsNegativos.split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
  };

  const handleBulkImport = () => {
    try {
      const parsed = JSON.parse(bulkData);
      const profiles = Array.isArray(parsed) ? parsed : [parsed];
      bulkImportMutation.mutate(profiles);
    } catch {
      alert('JSON inválido');
    }
  };

  const renderProfileForm = (form: any, onSubmit: any, mutation: any) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Familia Olfativa" error={form.formState.errors.familiaOlfativa?.message}>
          <Select {...form.register('familiaOlfativa')}>
            <option value="">Seleccionar...</option>
            {FAMILIAS.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </FormField>
        <FormField label="Subfamilia" error={form.formState.errors.subfamilia?.message}>
          <Input {...form.register('subfamilia')} placeholder="Ej: Amaderado-Especiado" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Género" error={form.formState.errors.genero?.message}>
          <Select {...form.register('genero')}>
            <option value="">Seleccionar...</option>
            {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </FormField>
        <FormField label="Intensidad" error={form.formState.errors.intensidad?.message}>
          <Select {...form.register('intensidad')}>
            <option value="">Seleccionar...</option>
            {INTENSIDADES.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        </FormField>
      </div>

      <FormField label="Equivalencia" error={form.formState.errors.equivalencia?.message}>
        <div className="flex gap-2">
          <Input
            {...form.register('equivalencia')}
            placeholder="Ej: Oud Maracujá Maison Crivelli"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupFragella(form); } }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={fragellaLoading}
            onClick={() => lookupFragella(form)}
            icon={<Search className="h-3.5 w-3.5" />}
            title="Buscar en Fragella y rellenar con AI"
          >
            Fragella
          </Button>
        </div>
        {fragellaError && <p className="text-xs text-status-danger mt-1">{fragellaError}</p>}
        {fragellaLoading && <p className="text-xs text-white/40 mt-1">Buscando en Fragella + enriqueciendo con AI...</p>}
      </FormField>

      <FormField label="Notas Destacadas" error={form.formState.errors.notasDestacadas?.message}>
        <Input {...form.register('notasDestacadas')} placeholder="Ej: maracuyá, oud, vainilla" />
      </FormField>

      <FormField label="Descripción Detallada" error={form.formState.errors.descripcionDetallada?.message}>
        <Textarea {...form.register('descripcionDetallada')} placeholder="Descripción sensorial del perfume..." rows={3} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Contexto Ideal" error={form.formState.errors.contextoIdeal?.message}>
          <Input {...form.register('contextoIdeal')} placeholder="Ej: Cenas, eventos nocturnos" />
        </FormField>
        <FormField label="Clima Ideal" error={form.formState.errors.climaIdeal?.message}>
          <Input {...form.register('climaIdeal')} placeholder="Ej: Templado, frío" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Perfil de Personalidad" error={form.formState.errors.perfilPersonalidad?.message}>
          <Input {...form.register('perfilPersonalidad')} placeholder="Ej: Sofisticado, aventurero" />
        </FormField>
        <FormField label="Duración Estimada" error={form.formState.errors.duracionEstimada?.message}>
          <Input {...form.register('duracionEstimada')} placeholder="Ej: 8-12 horas" />
        </FormField>
      </div>

      <FormField label="Frase de Posicionamiento" error={form.formState.errors.frasePositionamiento?.message}>
        <Input {...form.register('frasePositionamiento')} placeholder="Frase corta que define el perfume" />
      </FormField>

      <FormField label="Tags Negativos (separados por coma)" error={form.formState.errors.tagsNegativos?.message}>
        <Input {...form.register('tagsNegativos')} placeholder="Ej: dulce empalagoso, floral intenso" />
      </FormField>

      <FormField label="Notas Adicionales" error={form.formState.errors.notasAdicionales?.message}>
        <Textarea {...form.register('notasAdicionales')} placeholder="Notas adicionales para el briefing..." rows={2} />
      </FormField>

      {mutation.error && (
        <p className="text-sm text-status-danger">{(mutation.error as Error).message}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setEditingProfile(null); }}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Guardar
        </Button>
      </div>
    </form>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Perfiles de Fragancias</h1>
          <p className="page-description">Gestiona la información olfativa de cada perfume para el cuestionario AI</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowBulkImport(true)} icon={<Upload className="h-4 w-4" />}>
            Importar
          </Button>
          <Button onClick={() => { createForm.reset(); setShowCreate(true); }} icon={<Plus className="h-4 w-4" />}>
            Crear Perfil
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('profiles')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'profiles' ? 'bg-accent-purple text-white' : 'bg-glass-50 text-white/50 hover:text-white/70'
          }`}
        >
          Perfiles ({profilesData?.meta?.total || 0})
        </button>
        <button
          onClick={() => setTab('variants')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'variants' ? 'bg-accent-purple text-white' : 'bg-glass-50 text-white/50 hover:text-white/70'
          }`}
        >
          Productos
        </button>
      </div>

      {/* Search */}
      <div className="filter-bar mb-4">
        <SearchInput
          containerClassName="flex-1 max-w-sm"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar perfume..."
        />
      </div>

      {/* Table */}
      {tab === 'profiles' ? (
        <DataTable
          columns={profileColumns}
          data={profilesData?.data || []}
          loading={profilesLoading}
          page={page}
          pageSize={20}
          total={profilesData?.meta?.total || 0}
          onPageChange={setPage}
        />
      ) : (
        <DataTable
          columns={variantColumns}
          data={variantsData?.data || variantsData || []}
          loading={variantsLoading}
        />
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear Perfil de Fragancia" size="lg">
        {renderProfileForm(createForm, handleCreate, createMutation)}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingProfile} onClose={() => setEditingProfile(null)} title="Editar Perfil de Fragancia" size="lg">
        {renderProfileForm(editForm, handleEdit, updateMutation)}
      </Modal>

      {/* Bulk Import Modal */}
      <Modal open={showBulkImport} onClose={() => setShowBulkImport(false)} title="Importar Perfiles en Lote" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-white/50">
            Pegá un array JSON con los perfiles. Cada objeto debe tener al menos <code className="text-amber-400">productVariantId</code>.
          </p>
          <Textarea
            value={bulkData}
            onChange={(e) => setBulkData(e.target.value)}
            placeholder={'[\n  {\n    "productVariantId": "uuid",\n    "familiaOlfativa": "Ambarado",\n    "genero": "Unisex",\n    "equivalencia": "Oud Maracujá Maison Crivelli"\n  }\n]'}
            rows={12}
            className="font-mono text-xs"
          />
          {bulkImportMutation.error && (
            <p className="text-sm text-status-danger">{(bulkImportMutation.error as Error).message}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowBulkImport(false)}>Cancelar</Button>
            <Button onClick={handleBulkImport} loading={bulkImportMutation.isPending}>
              Importar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
