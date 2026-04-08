'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  extractPyramidFromImage,
  getFragellaFields,
  uploadProductImage,
} from '@/lib/api';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { Plus, Search, Sparkles, Upload, FlaskConical, Pencil, X } from 'lucide-react';
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
  'Floriental-Frutal', 'Frutal', 'Frutal-Ambarado', 'Frutal-Gourmand',
  'Gourmand', 'Gourmand-Lácteo', 'Oriental', 'Verde',
];

export default function FragrancesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createVariantName, setCreateVariantName] = useState('');
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [tab, setTab] = useState<'profiles' | 'variants'>('profiles');
  const [profileFilter, setProfileFilter] = useState<'all' | 'configured' | 'unconfigured'>('all');

  // Fragella autocomplete state
  const [equivQuery, setEquivQuery] = useState('');
  const [equivResults, setEquivResults] = useState<Array<{ id: string; name: string; brand: string }>>([]);
  const [equivOpen, setEquivOpen] = useState(false);
  const [equivLoading, setEquivLoading] = useState(false);
  const equivRef = useRef<HTMLDivElement>(null);
  const equivTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pyramid image extraction state
  const [pyramidFile, setPyramidFile] = useState<File | null>(null);
  const [pyramidLoading, setPyramidLoading] = useState(false);
  const [pyramidError, setPyramidError] = useState<string | null>(null);
  const pyramidInputRef = useRef<HTMLInputElement>(null);

  // Product photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fragella fill state
  const [fragellaLoading, setFragellaLoading] = useState(false);

  const searchFragella = useCallback(async (q: string) => {
    if (q.length < 3) { setEquivResults([]); setEquivOpen(false); return; }
    setEquivLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API_URL}/perfume-search?q=${encodeURIComponent(q.trim())}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setEquivResults(data);
        setEquivOpen(data.length > 0);
      }
    } catch { /* ignore */ }
    setEquivLoading(false);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (equivRef.current && !equivRef.current.contains(e.target as Node)) setEquivOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      setPyramidFile(null);
      setPhotoFile(null);
      setPhotoSuccess(false);
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
      render: (item) => {
        const img = item.productVariant?.images?.[0];
        return (
          <div className="flex items-center gap-3">
            {img?.url ? (
              <img src={img.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                <FlaskConical className="h-4 w-4 text-white/20" />
              </div>
            )}
            <div>
              <p className="font-medium text-white">{item.productVariant?.name || 'N/A'}</p>
              <p className="text-xs text-white/40">{item.productVariant?.categoryName?.split(' / ')[2] || item.productVariant?.sku}</p>
            </div>
          </div>
        );
      },
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
      render: (item) => {
        const img = item.images?.[0];
        return (
          <div className="flex items-center gap-3">
            {img?.url ? (
              <img src={img.thumbnailUrl || img.url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <FlaskConical className="h-4 w-4 text-white/20" />
              </div>
            )}
            <div>
              <p className="font-medium text-white">{item.name || 'N/A'}</p>
              <p className="text-xs text-white/40">{item.categoryName?.split(' / ')[2] || item.sku}</p>
            </div>
          </div>
        );
      },
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
              setCreateVariantName(item.name || '');
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
    const { productVariantId, ...rest } = data;
    updateMutation.mutate({
      id: editingProfile.id,
      ...rest,
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

  const handleExtractFromPyramid = async (form: any) => {
    if (!pyramidFile) return;
    setPyramidLoading(true);
    setPyramidError(null);
    try {
      const extracted = await extractPyramidFromImage(pyramidFile);
      if (extracted) {
        const fieldMap: Record<string, string> = {
          familiaOlfativa: 'familiaOlfativa',
          subfamilia: 'subfamilia',
          genero: 'genero',
          intensidad: 'intensidad',
          notasDestacadas: 'notasDestacadas',
          descripcionDetallada: 'descripcionDetallada',
          contextoIdeal: 'contextoIdeal',
          climaIdeal: 'climaIdeal',
          perfilPersonalidad: 'perfilPersonalidad',
          duracionEstimada: 'duracionEstimada',
          frasePositionamiento: 'frasePositionamiento',
        };
        for (const [apiField, formField] of Object.entries(fieldMap)) {
          if (extracted[apiField]) form.setValue(formField, extracted[apiField]);
        }
        if (Array.isArray(extracted.tagsNegativos) && extracted.tagsNegativos.length > 0) {
          form.setValue('tagsNegativos', extracted.tagsNegativos.join(', '));
        }
      }
    } catch (e: any) {
      setPyramidError(e.message || 'Error al extraer información');
    }
    setPyramidLoading(false);
  };

  const handleFragellaFill = async (form: any) => {
    const equivalencia = form.getValues('equivalencia');
    if (!equivalencia) return;
    setFragellaLoading(true);
    try {
      const fields = await getFragellaFields(equivalencia);
      if (fields) {
        const textFields = [
          'familiaOlfativa', 'subfamilia', 'genero', 'intensidad',
          'notasDestacadas', 'descripcionDetallada', 'contextoIdeal',
          'climaIdeal', 'perfilPersonalidad', 'duracionEstimada',
          'frasePositionamiento',
        ] as const;
        for (const f of textFields) {
          if (fields[f]) form.setValue(f as any, fields[f]);
        }
        if (Array.isArray(fields.tagsNegativos) && fields.tagsNegativos.length > 0) {
          form.setValue('tagsNegativos', fields.tagsNegativos.join(', '));
        }
      }
    } catch { /* ignore */ }
    setFragellaLoading(false);
  };

  const handlePhotoUpload = async (form: any) => {
    if (!photoFile) return;
    const variantId = form.getValues('productVariantId');
    if (!variantId) return;
    setPhotoLoading(true);
    setPhotoSuccess(false);
    try {
      await uploadProductImage(variantId, photoFile);
      setPhotoSuccess(true);
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    } catch { /* ignore */ }
    setPhotoLoading(false);
  };

  const renderProfileForm = (form: any, onSubmit: any, mutation: any) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

      {/* ── AI Tools section ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Herramientas AI</p>

        {/* Pyramid image/PDF extraction */}
        <div className="space-y-2">
          <p className="text-sm text-white/70">Pirámide olfativa (imagen o PDF)</p>
          <div className="flex items-center gap-2">
            <input
              ref={pyramidInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setPyramidFile(f);
                setPyramidError(null);
              }}
            />
            <button
              type="button"
              onClick={() => pyramidInputRef.current?.click()}
              className="flex-1 rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-2 text-left text-sm text-white/50 hover:border-white/30 hover:bg-white/[0.07] transition-colors"
            >
              {pyramidFile ? pyramidFile.name : 'Seleccionar archivo...'}
            </button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!pyramidFile || pyramidLoading}
              loading={pyramidLoading}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={() => handleExtractFromPyramid(form)}
            >
              Extraer con AI
            </Button>
          </div>
          {pyramidError && <p className="text-xs text-status-danger">{pyramidError}</p>}
        </div>

        {/* Photo upload */}
        <div className="space-y-2">
          <p className="text-sm text-white/70">Foto del producto</p>
          <div className="flex items-center gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                setPhotoFile(e.target.files?.[0] || null);
                setPhotoSuccess(false);
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex-1 rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-2 text-left text-sm text-white/50 hover:border-white/30 hover:bg-white/[0.07] transition-colors"
            >
              {photoFile ? photoFile.name : 'Seleccionar foto...'}
            </button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!photoFile || photoLoading}
              loading={photoLoading}
              icon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => handlePhotoUpload(form)}
            >
              {photoSuccess ? '¡Subida!' : 'Subir foto'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Familia Olfativa" error={form.formState.errors.familiaOlfativa?.message}>
          <Input {...form.register('familiaOlfativa')} list="familias-list" placeholder="Ej: Frutal-Ambarado" />
          <datalist id="familias-list">
            {FAMILIAS.map((f) => <option key={f} value={f} />)}
          </datalist>
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
        <div ref={equivRef} className="relative">
          <Input
            {...form.register('equivalencia')}
            placeholder="Ej: Oud Maracujá Maison Crivelli"
            onChange={(e) => {
              form.setValue('equivalencia', e.target.value);
              setEquivQuery(e.target.value);
              if (equivTimeout.current) clearTimeout(equivTimeout.current);
              equivTimeout.current = setTimeout(() => searchFragella(e.target.value), 400);
            }}
            autoComplete="off"
          />
          {equivOpen && equivResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-white/10 bg-[#1a1510] shadow-xl max-h-60 overflow-y-auto">
              {equivResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  onClick={() => {
                    // Normalize for accent-insensitive comparison
                    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    // Strip trailing gender labels Fragella sometimes appends to Name
                    const stripGender = (s: string) =>
                      s.replace(/\s+(unisex|for women|for men|masculine|feminine|masculino|femenino|para hombre|para mujer)\s*$/i, '').trim();
                    // Remove duplicate brand repetition inside the name (Fragella quirk)
                    const dedupBrand = (s: string, brand: string) => {
                      const normBrand = norm(brand);
                      // Strip exact brand occurrence that appears after the first fragment
                      return s.replace(new RegExp(`\\s+${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), (match, offset) =>
                        offset === 0 ? match : ''
                      ).trim();
                    };
                    const nameCleaned = stripGender(dedupBrand(r.name, r.brand));
                    const value = norm(nameCleaned).includes(norm(r.brand))
                      ? nameCleaned
                      : `${r.brand} ${nameCleaned}`;
                    form.setValue('equivalencia', value);
                    setEquivOpen(false);
                    setEquivResults([]);
                  }}
                >
                  <span className="text-sm text-white">{r.name}</span>
                  <span className="text-xs text-white/40 ml-2">{r.brand}</span>
                </button>
              ))}
            </div>
          )}
          {equivLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 text-amber-400 hover:text-amber-300"
          disabled={fragellaLoading || !form.watch('equivalencia')}
          loading={fragellaLoading}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          onClick={() => handleFragellaFill(form)}
        >
          Completar campos vacíos desde Fragella
        </Button>
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
        <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setEditingProfile(null); setPyramidFile(null); setPhotoFile(null); setPhotoSuccess(false); }}>
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
          <Button onClick={() => { createForm.reset(); setCreateVariantName(''); setShowCreate(true); }} icon={<Plus className="h-4 w-4" />}>
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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar perfume..."
            className="pl-10 pr-9"
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
        {tab === 'variants' && (
          <Select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value as 'all' | 'configured' | 'unconfigured')}
            className="w-auto min-w-[140px]"
          >
            <option value="all">Todos</option>
            <option value="configured">Configurado</option>
            <option value="unconfigured">Sin perfil</option>
          </Select>
        )}
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
          data={(variantsData?.data || variantsData || []).filter((item: any) => {
            if (profileFilter === 'configured') return !!item.fragranceProfile;
            if (profileFilter === 'unconfigured') return !item.fragranceProfile;
            return true;
          })}
          loading={variantsLoading}
        />
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={createVariantName ? `Crear Perfil — ${createVariantName}` : 'Crear Perfil de Fragancia'} size="lg">
        {renderProfileForm(createForm, handleCreate, createMutation)}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingProfile} onClose={() => setEditingProfile(null)} title={`Editar Perfil — ${editingProfile?.productVariant?.name || editingProfile?.name || 'Fragancia'}`} size="lg">
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
