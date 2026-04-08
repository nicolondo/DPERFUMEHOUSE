'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Minus, Check, X, ArrowRight, Package, User, MessageSquare,
} from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useProducts, useCategories } from '@/hooks/use-products';
import { useCustomers } from '@/hooks/use-customers';
import { useCreateProposal } from '@/hooks/use-proposals';
import { formatCurrency, getInitials } from '@/lib/utils';

interface SelectedItem {
  variantId: string;
  name: string;
  price: number;
  image?: string;
  sellerNote: string;
}

export default function NewProposalPage() {
  const router = useRouter();
  const createProposal = useCreateProposal();

  // Form state
  const [message, setMessage] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState<SelectedItem[]>([]);

  // Search states
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);

  const { data: productsData, isLoading: productsLoading } = useProducts({
    search: productSearch || undefined,
    categoryId: selectedCategory,
    limit: 50,
  });
  const { data: categoriesData } = useCategories();
  const { data: customersData } = useCustomers(customerSearch || undefined);

  const products = Array.isArray(productsData) ? productsData : productsData?.data ?? [];
  const customers = customersData?.data ?? [];

  const categories: { id: string; name: string }[] = (Array.isArray(categoriesData) ? categoriesData : [])
    .filter((c: string) => c.includes('Ventas') && c.split(' / ').length >= 3)
    .map((c: string) => {
      const parts = c.split(' / ');
      return { id: c, name: parts[2] || c };
    })
    .filter((c: any, i: number, arr: any[]) => arr.findIndex((x) => x.name === c.name) === i);

  const selectedIds = useMemo(() => new Set(items.map((i) => i.variantId)), [items]);

  const toggleProduct = (product: any) => {
    if (selectedIds.has(product.id)) {
      setItems((prev) => prev.filter((i) => i.variantId !== product.id));
    } else {
      const img = product.images?.[0]?.thumbnailUrl || product.images?.[0]?.url || '';
      setItems((prev) => [
        ...prev,
        { variantId: product.id, name: product.name, price: parseFloat(product.price), image: img, sellerNote: '' },
      ]);
    }
  };

  const updateNote = (variantId: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, sellerNote: note } : i)));
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    try {
      await createProposal.mutateAsync({
        message: message || undefined,
        customerId,
        items: items.map((item, idx) => ({
          variantId: item.variantId,
          sellerNote: item.sellerNote || undefined,
          sortOrder: idx,
        })),
      });
      router.push('/proposals');
    } catch {
      // handled by react-query
    }
  };

  return (
    <div className="pb-24">
      <PageHeader title="Nueva Propuesta" onBack={() => router.back()} />

      <div className="px-4 space-y-6">
        {/* Message */}
        <div className="space-y-3">
          <Textarea
            placeholder="Mensaje personalizado para el cliente..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
        </div>

        {/* Customer (optional) */}
        <div>
          <label className="text-xs font-medium text-white/50 mb-1 block">Cliente (opcional)</label>
          {customerId ? (
            <Card className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple-muted text-xs font-bold text-accent-purple">
                {getInitials(customerName)}
              </div>
              <span className="text-sm text-white flex-1">{customerName}</span>
              <button onClick={() => { setCustomerId(undefined); setCustomerName(''); }} className="text-white/30 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            </Card>
          ) : (
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="w-full flex items-center gap-2 rounded-xl bg-glass-50 border border-glass-border px-3 py-2.5 text-sm text-white/40"
            >
              <User className="h-4 w-4" />
              Seleccionar cliente...
            </button>
          )}
        </div>

        {/* Customer picker overlay */}
        {showCustomerPicker && (
          <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
            <div className="bg-surface-raised p-4 flex items-center gap-3">
              <button onClick={() => setShowCustomerPicker(false)} className="text-white/60">
                <X className="h-5 w-5" />
              </button>
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="flex-1 bg-transparent text-white text-base outline-none placeholder:text-white/30"
                style={{ fontSize: '16px' }}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {customers.map((c: any) => (
                <Card
                  key={c.id}
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => {
                    setCustomerId(c.id);
                    setCustomerName(c.name);
                    setShowCustomerPicker(false);
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple-muted text-xs font-bold text-accent-purple">
                    {getInitials(c.name)}
                  </div>
                  <span className="text-sm text-white">{c.name}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Selected Products */}
        {items.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-white/50 mb-2">Productos seleccionados ({items.length})</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <Card key={item.variantId} className="p-3">
                  <div className="flex items-start gap-3">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-12 w-12 rounded-lg object-cover bg-white/5 flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-glass-50 flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-white/20" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs font-bold text-accent-gold">{formatCurrency(item.price)}</p>
                      {editingNote === item.variantId ? (
                        <div className="mt-1">
                          <input
                            type="text"
                            value={item.sellerNote}
                            onChange={(e) => updateNote(item.variantId, e.target.value)}
                            onBlur={() => setEditingNote(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingNote(null)}
                            placeholder="Nota para el cliente..."
                            className="w-full bg-glass-50 border border-glass-border rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/30 outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingNote(item.variantId)}
                          className="text-xs text-white/30 hover:text-white/60 mt-0.5 flex items-center gap-1"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {item.sellerNote || 'Agregar nota'}
                        </button>
                      )}
                    </div>
                    <button onClick={() => removeItem(item.variantId)} className="text-white/30 hover:text-red-400 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Product Search */}
        <div>
          <h3 className="text-xs font-medium text-white/50 mb-2">Agregar productos</h3>
          <Input
            placeholder="Buscar producto..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
          />

          {/* Category chips */}
          <div className="-mx-4 px-4 mt-3 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => setSelectedCategory(undefined)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  !selectedCategory ? 'bg-accent-purple text-white' : 'bg-glass-50 text-white/70'
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === cat.id ? 'bg-accent-purple text-white' : 'bg-glass-50 text-white/70'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="mt-3">
            {productsLoading ? (
              <PageSpinner />
            ) : products.length === 0 ? (
              <EmptyState
                icon={<Package className="h-8 w-8" />}
                title="Sin productos"
                description="No se encontraron productos"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((product: any) => {
                  const isSelected = selectedIds.has(product.id);
                  const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
                  const img = product.images?.[0]?.thumbnailUrl || product.images?.[0]?.url;
                  const hue = product.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % 360;
                  const initials = product.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

                  return (
                    <div
                      key={product.id}
                      onClick={() => toggleProduct(product)}
                      className={`relative overflow-hidden rounded-2xl bg-glass-100 border shadow-glass cursor-pointer transition-all active:scale-[0.97] ${
                        isSelected ? 'border-accent-purple ring-1 ring-accent-purple' : 'border-glass-border'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      {img ? (
                        <div className="h-28 w-full overflow-hidden bg-glass-50">
                          <img src={img} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-28 items-center justify-center" style={{ backgroundColor: `hsl(${hue}, 30%, 90%)` }}>
                          <span className="text-xl font-bold" style={{ color: `hsl(${hue}, 40%, 40%)` }}>{initials}</span>
                        </div>
                      )}
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-white truncate">{product.name}</p>
                        <p className="text-xs font-bold text-accent-gold mt-0.5">{formatCurrency(price)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating submit button */}
      {items.length > 0 && (
        <div className="fixed left-0 right-0 px-4 max-w-[600px] mx-auto" style={{ bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={handleSubmit}
            disabled={createProposal.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-accent-purple py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-50"
          >
            {createProposal.isPending ? 'Creando...' : (
              <>
                Crear Propuesta ({items.length} producto{items.length !== 1 ? 's' : ''})
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
