'use client';

import { useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProduct,
  fetchProductImages,
  uploadProductImage,
  deleteProductImage,
  setProductImagePrimary,
} from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Upload,
  Trash2,
  Star,
  ImageIcon,
  Package,
  Tag,
  Layers,
  Ban,
  Check,
  EyeOff,
} from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const productId = params.id as string;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Fetch product
  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });

  // Fetch images
  const {
    data: images,
    isLoading: imagesLoading,
  } = useQuery({
    queryKey: ['product-images', productId],
    queryFn: () => fetchProductImages(productId),
    enabled: !!product,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProductImage(productId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProductImage,
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });

  // Set primary mutation
  const primaryMutation = useMutation({
    mutationFn: setProductImagePrimary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          uploadMutation.mutate(file);
        }
      });
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  if (productLoading) return <PageSpinner />;

  if (productError || !product) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => router.push('/products')}
        >
          Volver a Productos
        </Button>
        <div className="rounded-xl border border-status-danger/30 bg-status-danger-muted p-6 text-center">
          <p className="text-sm text-status-danger">Error al cargar el producto.</p>
        </div>
      </div>
    );
  }

  const imageList: any[] = Array.isArray(images) ? images : images?.data || images?.images || [];
  const isInactive = !product.isActive;
  const isBlocked = product.isBlocked;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        icon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => router.push('/products')}
      >
        Volver a Productos
      </Button>

      {/* Product Header Card */}
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple-muted">
              {product.imageUrl || product.thumbnail ? (
                <img
                  src={product.imageUrl || product.thumbnail}
                  alt={product.name}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <Package className="h-8 w-8 text-accent-purple" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">{product.name}</h1>
              <div className="flex items-center gap-2 pt-1">
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
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Precio</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(product.price || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-success-muted text-status-success">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Stock</p>
              <p className="text-lg font-bold text-white">{product.stock ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning-muted text-status-warning">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Categoria</p>
              <p className="text-sm font-semibold text-white">
                {product.category || '-'}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Imagenes</p>
              <p className="text-lg font-bold text-white">{imageList.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Attributes */}
      {product.attributes && Object.keys(product.attributes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Atributos</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(product.attributes).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-medium text-white/50 capitalize">{key}</p>
                <p className="text-sm text-white">{String(value)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Image Gallery Section */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Galeria de Imagenes</h3>
            <Button
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => fileInputRef.current?.click()}
              loading={uploadMutation.isPending}
            >
              Subir Imagen
            </Button>
          </div>
        </div>

        <div className="p-6">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {/* Upload status messages */}
          {uploadMutation.isError && (
            <div className="mb-4 rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
              Error al subir la imagen. Intente nuevamente.
            </div>
          )}
          {uploadMutation.isSuccess && (
            <div className="mb-4 rounded-lg bg-status-success-muted p-3 text-sm text-status-success">
              Imagen subida correctamente.
            </div>
          )}

          {/* Image Grid */}
          {imagesLoading ? (
            <div className="flex h-40 items-center justify-center">
              <PageSpinner />
            </div>
          ) : imageList.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {imageList.map((img: any) => (
                <div
                  key={img.id}
                  className="group relative overflow-hidden rounded-xl border border-glass-border bg-glass-50"
                >
                  {/* Primary badge */}
                  {img.isPrimary && (
                    <div className="absolute left-2 top-2 z-10">
                      <Badge variant="info" className="shadow-sm">
                        <Star className="mr-1 h-3 w-3 fill-current" />
                        Principal
                      </Badge>
                    </div>
                  )}

                  {/* Image */}
                  <div className="aspect-square">
                    <img
                      src={img.url || img.imageUrl}
                      alt={img.altText || product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Overlay actions */}
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex w-full gap-2 p-3">
                      {!img.isPrimary && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-white/80 bg-white/90 text-black hover:bg-white"
                          icon={<Star className="h-3.5 w-3.5" />}
                          onClick={() => primaryMutation.mutate(img.id)}
                          loading={primaryMutation.isPending}
                        >
                          Hacer principal
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        className="shrink-0"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => setDeleteTarget(img.id)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Drop zone - always visible below images or as main area when empty */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
              dragOver
                ? 'border-accent-purple bg-accent-purple-muted'
                : 'border-glass-border bg-glass-50 hover:border-accent-purple/50 hover:bg-accent-purple-muted/30'
            } ${imageList.length === 0 ? 'min-h-[200px]' : ''}`}
          >
            <Upload
              className={`h-8 w-8 ${dragOver ? 'text-accent-purple' : 'text-white/30'}`}
            />
            <p className="mt-2 text-sm font-medium text-white/70">
              Arrastra imagenes aqui o haz click para seleccionar
            </p>
            <p className="mt-1 text-xs text-white/30">
              PNG, JPG, WEBP hasta 5MB
            </p>
          </div>
        </div>
      </Card>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title="Eliminar imagen"
        message="Esta seguro que desea eliminar esta imagen? Esta accion no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
