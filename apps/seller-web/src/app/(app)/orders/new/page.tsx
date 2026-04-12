'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Check,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShoppingCart,
  User,
  MapPin,
  Package,
  ClipboardList,
  Pencil,
  X,
  Banknote,
  Truck,
} from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { AddressAutocomplete, type ParsedAddress } from '@/components/ui/address-autocomplete';
import { PhoneInput } from '@/components/ui/phone-input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useCustomers, useCustomer, useCreateCustomer, useAddAddress, useUpdateAddress } from '@/hooks/use-customers';
import { useProducts, useCategories, useRequestProduct } from '@/hooks/use-products';
import { useCreateOrder } from '@/hooks/use-orders';
import { useCartStore } from '@/store/cart.store';
import { formatCurrency, getInitials, formatPhone } from '@/lib/utils';
import type { Customer, Address } from '@/lib/types';

const STEPS = [
  { number: 1, label: 'Cliente', icon: User },
  { number: 2, label: 'Direccion', icon: MapPin },
  { number: 3, label: 'Productos', icon: Package },
  { number: 4, label: 'Resumen', icon: ClipboardList },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  const {
    selectedCustomer,
    selectedAddress,
    items,
    notes,
    setCustomer,
    setAddress,
    addItem,
    removeItem,
    updateQuantity,
    getItemQuantity,
    setNotes,
    itemCount,
    subtotal,
    tax,
    shipping,
    total,
    itemsArray,
    resetFlow,
  } = useCartStore();

  const setOrderConfig = useCartStore((s) => s.setOrderConfig);
  const createOrder = useCreateOrder();

  // Fetch order config (tax, shipping) from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/settings/public/order-config`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setOrderConfig(data);
        }
      } catch {
        // Use defaults from store
      }
    };
    fetchConfig();
  }, [setOrderConfig]);

  const handleBack = () => {
    if (step === 1) {
      resetFlow();
      router.back();
    } else {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (paymentMethod?: 'ONLINE' | 'CASH') => {
    if (!selectedCustomer || !selectedAddress) return;

    const orderItems = itemsArray().map((item) => ({
      variantId: item.variant.id, // product.id is stored as variant.id in the cart
      quantity: item.quantity,
    }));

    if (orderItems.length === 0) return;

    try {
      const order = await createOrder.mutateAsync({
        customerId: selectedCustomer.id,
        addressId: selectedAddress.id,
        items: orderItems,
        notes: notes || undefined,
        paymentMethod,
      });
      resetFlow();
      router.replace(`/orders/${order.id}`);
    } catch {
      // Error handled by react-query
    }
  };

  return (
    <div className="pb-28">
      <PageHeader
        title="Nuevo Pedido"
        onBack={handleBack}
        subtitle={`Paso ${step} de 4 - ${STEPS[step - 1].label}`}
      />

      {/* Step indicator */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step >= s.number
                    ? 'bg-accent-purple text-white'
                    : 'bg-glass-50 text-white/30'
                }`}
              >
                {step > s.number ? (
                  <Check className="h-4 w-4" />
                ) : (
                  s.number
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 w-6 sm:w-10 transition-colors ${
                    step > s.number ? 'bg-accent-purple' : 'bg-glass-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4">
        {step === 1 && (
          <Step1SelectCustomer
            selectedCustomer={selectedCustomer}
            onSelect={(customer) => {
              setCustomer(customer);
              setAddress(null);
              // Auto-advance to step 2
              setTimeout(() => setStep(2), 300);
            }}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2SelectAddress
            customer={selectedCustomer!}
            selectedAddress={selectedAddress}
            onSelect={(addr) => {
              setAddress(addr);
              setTimeout(() => setStep(3), 300);
            }}
            onContinue={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3SelectProducts
            addItem={addItem}
            removeItem={removeItem}
            updateQuantity={updateQuantity}
            getItemQuantity={getItemQuantity}
            itemCount={itemCount}
            subtotal={subtotal}
            onContinue={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4Summary
            customer={selectedCustomer!}
            address={selectedAddress!}
            items={itemsArray()}
            notes={notes}
            setNotes={setNotes}
            subtotalAmount={subtotal()}
            taxAmount={tax()}
            shippingAmount={shipping()}
            totalAmount={total()}
            onSubmit={() => handleSubmit()}
            onCashSubmit={() => handleSubmit('CASH')}
            isSubmitting={createOrder.isPending}
            addItem={addItem}
            removeItem={removeItem}
            updateQuantity={updateQuantity}
          />
        )}
      </div>
    </div>
  );
}

/* =====================================================
   STEP 1 - Select Customer
   ===================================================== */

function Step1SelectCustomer({
  selectedCustomer,
  onSelect,
  onContinue,
}: {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer) => void;
  onContinue: () => void;
}) {
  const [search, setSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const { data, isLoading } = useCustomers(search || undefined);
  const customers = data?.data ?? [];
  const createCustomer = useCreateCustomer();

  const [newForm, setNewForm] = useState({
    name: '',
    email: '',
    phone: '',
    documentType: 'CC',
    documentNumber: '',
  });
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneCode, setNewPhoneCode] = useState('+57');
  const [createError, setCreateError] = useState('');

  const handleCreateCustomer = async () => {
    if (!newForm.name || !newPhone) return;
    setCreateError('');
    try {
      const created = await createCustomer.mutateAsync({
        name: newForm.name,
        email: newForm.email || undefined,
        phone: newPhone,
        phoneCode: newPhoneCode,
        documentType: newForm.documentType || undefined,
        documentNumber: newForm.documentNumber || undefined,
      });
      setShowNewCustomer(false);
      setNewForm({ name: '', email: '', phone: '', documentType: 'CC', documentNumber: '' });
      setNewPhone('');
      setNewPhoneCode('+57');
      onSelect(created);
      onContinue();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Error al crear el cliente');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar cliente por nombre, email o telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-5 w-5" />}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowNewCustomer(true)}
          className="flex-shrink-0"
        >
          Nuevo
        </Button>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<User className="h-8 w-8" />}
          title="Sin resultados"
          description="No se encontraron clientes"
        />
      ) : (
        <div className="space-y-2">
          {customers.map((customer: any) => {
            const isSelected = selectedCustomer?.id === customer.id;
            return (
              <Card
                key={customer.id}
                onClick={() => { onSelect(customer); onContinue(); }}
                className={`flex items-center gap-3 ${
                  isSelected
                    ? 'ring-2 ring-accent-purple bg-accent-purple-muted'
                    : ''
                }`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-purple-muted text-sm font-bold text-accent-purple">
                  {getInitials(customer.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate">
                    {customer.name}
                  </p>
                  <p className="text-xs text-white/50 truncate">
                    {customer.email || ''}
                    {customer.phone ? `${customer.email ? ' · ' : ''}${formatPhone(customer.phone)}` : ''}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Crear nuevo cliente */}
      <Modal isOpen={showNewCustomer} onClose={() => setShowNewCustomer(false)} title="Nuevo Cliente">
        <div className="space-y-4">
          <Input
            label="Nombre completo *"
            placeholder="Juan Perez"
            value={newForm.name}
            onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            placeholder="juan@email.com"
            value={newForm.email}
            onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Telefono *</label>
            <PhoneInput value={newPhone} onChange={setNewPhone} phoneCode={newPhoneCode} onCodeChange={setNewPhoneCode} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Tipo Documento</label>
              <select
                value={newForm.documentType}
                onChange={(e) => setNewForm((f) => ({ ...f, documentType: e.target.value }))}
                className="w-full rounded-xl border border-glass-border bg-glass-100 px-4 py-3 text-base text-white appearance-none focus:outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20"
              >
                <option value="CC">C.C</option>
                <option value="NIT">NIT</option>
                <option value="CE">C.E</option>
                <option value="PP">Pasaporte</option>
              </select>
            </div>
            <Input
              label="No. Documento"
              placeholder="1234567890"
              value={newForm.documentNumber}
              onChange={(e) => setNewForm((f) => ({ ...f, documentNumber: e.target.value }))}
            />
          </div>

          {createError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {createError}
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={handleCreateCustomer}
            loading={createCustomer.isPending}
            disabled={!newForm.name || !newPhone}
          >
            Crear Cliente
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* =====================================================
   STEP 2 - Select Address
   ===================================================== */

function Step2SelectAddress({
  customer,
  selectedAddress,
  onSelect,
  onContinue,
}: {
  customer: Customer;
  selectedAddress: Address | null;
  onSelect: (address: Address) => void;
  onContinue: () => void;
}) {
  // Fetch fresh customer data so addresses update after edit
  const { data: freshCustomer } = useCustomer(customer.id);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const addAddress = useAddAddress();
  const updateAddress = useUpdateAddress();
  const [addressForm, setAddressForm] = useState({
    label: '',
    street: '',
    detail: '',
    phone: customer.phone || '',
    phoneCode: '+57',
    city: '',
    state: '',
    country: 'Colombia',
    isDefault: false,
    notes: '',
  });
  const [editForm, setEditForm] = useState({
    label: '',
    street: '',
    detail: '',
    phone: '',
    phoneCode: '+57',
    city: '',
    state: '',
    notes: '',
  });

  const addresses = freshCustomer?.addresses ?? customer.addresses ?? [];

  const handleAddAddress = async () => {
    if (!addressForm.label || !addressForm.street || !addressForm.city) return;
    try {
      const newAddress = await addAddress.mutateAsync({
        customerId: customer.id,
        ...addressForm,
      });
      onSelect(newAddress);
      setShowNewAddress(false);
    } catch {
      // Error handled by react-query
    }
  };

  const handleOpenEdit = (address: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm({
      label: address.label,
      street: address.street,
      detail: address.detail || '',
      phone: address.phone || '',
      phoneCode: (address as any).phoneCode || '+57',
      city: address.city,
      state: address.state,
      notes: address.notes || '',
    });
    setEditingAddress(address);
  };

  const handleSaveEdit = async () => {
    if (!editingAddress || !editForm.label || !editForm.street || !editForm.city) return;
    try {
      const updated = await updateAddress.mutateAsync({
        customerId: customer.id,
        addressId: editingAddress.id,
        ...editForm,
      });
      // If this was the selected address, update the selection
      if (selectedAddress?.id === editingAddress.id) {
        onSelect(updated);
      }
      setEditingAddress(null);
    } catch {
      // Error handled by react-query
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Selecciona la direccion de entrega para{' '}
        <span className="font-semibold text-white">{customer.name}</span>
      </p>

      {addresses.length === 0 && !showNewAddress ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="Sin direcciones"
          description="Este cliente no tiene direcciones registradas"
          action={{
            label: 'Agregar Direccion',
            onClick: () => setShowNewAddress(true),
          }}
        />
      ) : (
        <div className="space-y-2">
          {addresses.map((address: any) => {
            const isSelected = selectedAddress?.id === address.id;
            return (
              <Card
                key={address.id}
                onClick={() => { onSelect(address); onContinue(); }}
                className={`${
                  isSelected
                    ? 'ring-2 ring-accent-purple bg-accent-purple-muted'
                    : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected
                        ? 'border-accent-purple bg-accent-purple'
                        : 'border-glass-border'
                    }`}
                  >
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white">
                        {address.label}
                      </p>
                      {address.isDefault && (
                        <Badge variant="purple">Principal</Badge>
                      )}
                    </div>
                    <p className="text-sm text-white/70">
                      {address.street}{address.detail ? `, ${address.detail}` : ''}
                    </p>
                    <p className="text-xs text-white/30">
                      {address.city}, {address.state}
                    </p>
                    {address.phone && (
                      <p className="text-xs text-white/30">{formatPhone(address.phone)}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleOpenEdit(address, e)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/30 hover:text-accent-purple hover:bg-glass-100 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New address toggle */}
      {!showNewAddress && addresses.length > 0 && (
        <button
          onClick={() => setShowNewAddress(true)}
          className="flex items-center gap-2 text-sm font-medium text-accent-purple"
        >
          <Plus className="h-4 w-4" />
          Agregar nueva direccion
        </button>
      )}

      {/* New address form */}
      {showNewAddress && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">
              Nueva Direccion
            </h4>
            <button
              onClick={() => setShowNewAddress(false)}
              className="text-xs text-white/30"
            >
              Cancelar
            </button>
          </div>
          <div className="space-y-3">
            <Input
              label="Etiqueta"
              placeholder="Ej: Casa, Oficina"
              value={addressForm.label}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, label: e.target.value }))
              }
            />
            <AddressAutocomplete
              label="Direccion"
              placeholder="Buscar direccion..."
              value={addressForm.street}
              onChange={(val) =>
                setAddressForm((prev) => ({ ...prev, street: val }))
              }
              onSelect={(parsed: ParsedAddress) => {
                setAddressForm((prev) => ({
                  ...prev,
                  street: parsed.street,
                  city: parsed.city,
                  state: parsed.state,
                }));
              }}
            />
            <Input
              placeholder="Apto, piso, oficina..."
              label="Detalle"
              value={addressForm.detail}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, detail: e.target.value }))
              }
            />
            <PhoneInput
              label="Telefono de contacto"
              value={addressForm.phone}
              phoneCode={addressForm.phoneCode}
              onChange={(val) =>
                setAddressForm((prev) => ({ ...prev, phone: val }))
              }
              onCodeChange={(code) =>
                setAddressForm((prev) => ({ ...prev, phoneCode: code }))
              }
            />
            {(addressForm.city || addressForm.state) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">Ciudad</label>
                  <p className="rounded-xl border border-glass-border bg-glass-50 py-3 px-4 text-base text-white/70">{addressForm.city || '-'}</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">Departamento</label>
                  <p className="rounded-xl border border-glass-border bg-glass-50 py-3 px-4 text-base text-white/70">{addressForm.state || '-'}</p>
                </div>
              </div>
            )}
            <Input
              placeholder="Timbre, porteria, horario..."
              label="Instrucciones adicionales"
              value={addressForm.notes}
              onChange={(e) =>
                setAddressForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
            <Button
              fullWidth
              size="sm"
              onClick={handleAddAddress}
              loading={addAddress.isPending}
              disabled={
                !addressForm.label || !addressForm.street || !addressForm.city
              }
            >
              Guardar Direccion
            </Button>
          </div>
        </Card>
      )}

      {/* Edit address modal */}
      {editingAddress && (
        <Modal
          isOpen={true}
          onClose={() => setEditingAddress(null)}
          title="Editar Direccion"
        >
          <div className="space-y-3">
            <Input
              label="Etiqueta"
              placeholder="Ej: Casa, Oficina"
              value={editForm.label}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, label: e.target.value }))
              }
            />
            <AddressAutocomplete
              label="Direccion"
              placeholder="Buscar direccion..."
              value={editForm.street}
              onChange={(val) =>
                setEditForm((prev) => ({ ...prev, street: val }))
              }
              onSelect={(parsed: ParsedAddress) => {
                setEditForm((prev) => ({
                  ...prev,
                  street: parsed.street,
                  city: parsed.city,
                  state: parsed.state,
                }));
              }}
            />
            <Input
              placeholder="Apto, piso, oficina..."
              label="Detalle"
              value={editForm.detail}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, detail: e.target.value }))
              }
            />
            <PhoneInput
              label="Telefono de contacto"
              value={editForm.phone}
              phoneCode={editForm.phoneCode}
              onChange={(val) =>
                setEditForm((prev) => ({ ...prev, phone: val }))
              }
              onCodeChange={(code) =>
                setEditForm((prev) => ({ ...prev, phoneCode: code }))
              }
            />
            {(editForm.city || editForm.state) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">Ciudad</label>
                  <p className="rounded-xl border border-glass-border bg-glass-50 py-3 px-4 text-base text-white/70">{editForm.city || '-'}</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">Departamento</label>
                  <p className="rounded-xl border border-glass-border bg-glass-50 py-3 px-4 text-base text-white/70">{editForm.state || '-'}</p>
                </div>
              </div>
            )}
            <Input
              placeholder="Timbre, porteria, horario..."
              label="Instrucciones adicionales"
              value={editForm.notes}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
            <Button
              fullWidth
              onClick={handleSaveEdit}
              loading={updateAddress.isPending}
              disabled={
                !editForm.label || !editForm.street || !editForm.city
              }
            >
              Guardar Cambios
            </Button>
          </div>
        </Modal>
      )}

    </div>
  );
}

/* =====================================================
   STEP 3 - Select Products
   ===================================================== */

function Step3SelectProducts({
  addItem,
  removeItem,
  updateQuantity,
  getItemQuantity,
  itemCount,
  subtotal,
  onContinue,
}: {
  addItem: (variant: any) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  getItemQuantity: (variantId: string) => number;
  itemCount: () => number;
  subtotal: () => number;
  onContinue: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined
  );
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const requestProduct = useRequestProduct();
  const { data: categoriesData } = useCategories();
  const { data: productsData, isLoading } = useProducts({
    search: search || undefined,
    categoryId: selectedCategory,
    limit: 50,
  });

  // Filter categories: only show "Ventas" subcategories with simplified names
  const categories: { id: string; name: string }[] = (Array.isArray(categoriesData) ? categoriesData : [])
    .filter((c: string) => c.includes('Ventas') && c.split(' / ').length >= 3)
    .map((c: string) => {
      const parts = c.split(' / ');
      // Show brand name: "AHLI", "ILMIN", "MATAI", etc.
      const name = parts[2] || c;
      return { id: c, name };
    })
    // Deduplicate by brand name
    .filter((c: { id: string; name: string }, i: number, arr: { id: string; name: string }[]) => arr.findIndex((x) => x.name === c.name) === i);
  const products = Array.isArray(productsData) ? productsData : productsData?.data ?? [];

  const count = itemCount();
  const totalAmount = subtotal();

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leftIcon={<Search className="h-5 w-5" />}
      />

      {/* Category chips */}
      <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !selectedCategory
                ? 'bg-accent-purple text-white'
                : 'bg-glass-50 text-white/70'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? undefined : cat.id
                )
              }
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-accent-purple text-white'
                  : 'bg-glass-50 text-white/70'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <PageSpinner />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="Sin productos"
          description="No se encontraron productos"
        />
      ) : (
        <div className={`grid grid-cols-2 gap-3 ${count > 0 ? 'pb-40' : ''}`}>
          {products.map((product: any) => {
            const inStock = product.stock > 0;
            const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
            const qty = getItemQuantity(product.id);
            const initials = product.name
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            // Generate a color based on product name
            const hue =
              product.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) %
              360;

            return (
              <div
                key={product.id}
                className="relative overflow-hidden rounded-2xl bg-glass-100 border border-glass-border shadow-glass"
              >
                {/* Image placeholder */}
                {product.images?.[0] ? (
                  <div className="relative h-32 w-full overflow-hidden bg-glass-50">
                    <img
                      src={product.images[0].thumbnailUrl || product.images[0].url || product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                    {!inStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded">
                          Sin stock
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="relative flex h-32 items-center justify-center"
                    style={{
                      backgroundColor: `hsl(${hue}, 30%, 90%)`,
                    }}
                  >
                    <span
                      className="text-2xl font-bold"
                      style={{ color: `hsl(${hue}, 40%, 40%)` }}
                    >
                      {initials}
                    </span>
                    {!inStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded">
                          Sin stock
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-medium text-white truncate mb-0.5">
                    {product.name}
                  </p>
                  {product.attributes && Object.keys(product.attributes).length > 0 && (
                    <p className="text-xs text-accent-purple truncate mb-0.5">
                      {Object.values(product.attributes).join(' · ')}
                    </p>
                  )}
                  <p className="text-sm font-bold text-white mb-2">
                    {formatCurrency(price)}
                  </p>

                  <div className="flex items-center justify-between">
                    {inStock ? (
                      <Badge variant="success">En stock</Badge>
                    ) : (
                      <Badge variant="danger">Sin stock</Badge>
                    )}
                  </div>

                  {/* Quantity controls */}
                  <div className="mt-2">
                    {inStock ? (
                      qty > 0 ? (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() =>
                              qty === 1
                                ? removeItem(product.id)
                                : updateQuantity(product.id, qty - 1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-glass-50 text-white/70 active:bg-glass-200"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-sm font-bold text-white w-6 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(product.id, qty + 1)
                            }
                            disabled={qty >= product.stock}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple text-white active:bg-accent-purple/90 disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          fullWidth
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            addItem({
                              id: product.id,
                              productId: product.id,
                              name: product.name,
                              size: '',
                              sku: product.sku ?? '',
                              price,
                              costPrice: 0,
                              stock: product.stock,
                              isActive: product.isActive,
                              product: { id: product.id, name: product.name, slug: '', brand: '', categoryId: '', images: product.images ?? [], variants: [], isActive: product.isActive, createdAt: '' },
                            })
                          }
                        >
                          Agregar
                        </Button>
                      )
                    ) : requestedIds.has(product.id) ? (
                      <div className="text-center py-1 px-2">
                        <p className="text-xs text-green-500 font-medium">✓ Solicitud enviada</p>
                        <p className="text-[10px] text-white/40 mt-0.5">Pronto nos pondremos en contacto contigo para avisarte cuando esté disponible</p>
                      </div>
                    ) : (
                      <Button
                        fullWidth
                        size="sm"
                        variant="ghost"
                        className="text-xs text-accent-purple"
                        loading={requestProduct.isPending}
                        onClick={() => {
                            requestProduct.mutate(
                              { variantId: product.id, quantity: 1 },
                              {
                                onSuccess: () => {
                                  setRequestedIds((prev) => new Set([...prev, product.id]));
                                },
                              }
                            );
                        }}
                      >
                        Solicitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating bottom bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-[5.5rem] z-30 flex justify-center px-3">
        <div className="w-full max-w-[600px] rounded-2xl border border-glass-border bg-surface-raised p-4 shadow-glass">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-brand-gold" />
              <span className="text-sm font-semibold text-white">
                {count} {count === 1 ? 'producto' : 'productos'} &middot;{' '}
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <Button
              size="sm"
              onClick={onContinue}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continuar
            </Button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================
   STEP 4 - Order Summary
   ===================================================== */

function Step4Summary({
  customer,
  address,
  items,
  notes,
  setNotes,
  subtotalAmount,
  taxAmount,
  shippingAmount,
  totalAmount,
  onSubmit,
  onCashSubmit,
  isSubmitting,
  addItem,
  removeItem,
  updateQuantity,
}: {
  customer: Customer | null;
  address: Address;
  items: Array<{ variant: any; quantity: number }>;
  notes: string;
  setNotes: (notes: string) => void;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  onSubmit: () => void;
  onCashSubmit: () => void;
  isSubmitting: boolean;
  addItem: (variant: any) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
}) {
  const [showCashConfirm, setShowCashConfirm] = useState(false);

  if (!customer) {
    return (
      <EmptyState
        icon={<User className="h-8 w-8" />}
        title="Error"
        description="No se seleccionó un cliente"
      />
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Customer & Address */}
      <Card>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-purple-muted text-sm font-bold text-accent-purple">
            {getInitials(customer.name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {customer.name}
            </p>
            {customer.email && (
              <p className="text-xs text-white/50">{customer.email}</p>
            )}
            <p className="text-xs text-white/50">{formatPhone(customer.phone)}</p>
          </div>
        </div>
        <div className="border-t border-glass-border pt-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-white/30 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">
                {address.label}
              </p>
              <p className="text-xs text-white/50">
                {address.street}{address.detail ? `, ${address.detail}` : ''}, {address.city}
              </p>
              {address.phone && (
                <p className="text-xs text-white/30 mt-0.5">
                  Tel: {formatPhone(address.phone)}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Items */}
      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">
          Productos ({items.length})
        </h3>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.variant.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {item.variant.product?.name ?? item.variant.name}
                </p>
                <p className="text-xs text-white/30">
                  {formatCurrency(item.variant.price)} c/u
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (item.quantity <= 1) {
                      removeItem(item.variant.id);
                    } else {
                      updateQuantity(item.variant.id, item.quantity - 1);
                    }
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-glass-border text-white/50 hover:bg-glass-200"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => addItem(item.variant)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-accent-purple text-white hover:bg-accent-purple/90"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="pl-2 text-sm font-semibold text-white w-24 text-right">
                {formatCurrency(item.variant.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Totals */}
      <Card>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Subtotal</span>
            <span className="text-white">{formatCurrency(subtotalAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">IVA ({Math.round(useCartStore.getState().orderConfig.taxRate * 100)}%)</span>
            <span className="text-white">{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Envio</span>
            <span className="text-white">
              {shippingAmount === 0 ? 'Gratis' : formatCurrency(shippingAmount)}
            </span>
          </div>
          <div className="border-t border-glass-border pt-2 flex items-center justify-between">
            <span className="text-base font-bold text-white">Total</span>
            <span className="text-lg font-bold text-accent-purple">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <Textarea
          label="Notas del pedido"
          placeholder="Indicaciones especiales, instrucciones de entrega..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>

      {/* Submit */}
      <div className="mt-6 pb-4 space-y-3">
        <Button
          fullWidth
          size="lg"
          onClick={onSubmit}
          loading={isSubmitting && !showCashConfirm}
          disabled={items.length === 0 || isSubmitting}
          className="!py-4 text-base font-semibold bg-accent-purple hover:bg-accent-purple/90 shadow-xl shadow-accent-purple/30 rounded-2xl"
        >
          Confirmar y Generar Link de Pago
        </Button>

        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={() => setShowCashConfirm(true)}
          disabled={items.length === 0 || isSubmitting}
          leftIcon={<Banknote className="h-5 w-5" />}
          className="!py-4 text-base font-semibold border-accent-gold/40 text-accent-gold hover:bg-accent-gold/10 rounded-2xl"
        >
          Pago en Efectivo
        </Button>
      </div>

      {/* Cash payment confirmation modal */}
      <Modal
        isOpen={showCashConfirm}
        onClose={() => setShowCashConfirm(false)}
        title="⚠️ Confirmar Pago en Efectivo"
      >
        <div className="space-y-4">
          <p className="text-white/70 text-sm leading-relaxed">
            Esta acción no se puede revertir. Solo confirma el pago una vez tengas el dinero en tu poder.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setShowCashConfirm(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              fullWidth
              onClick={() => {
                onCashSubmit();
                setShowCashConfirm(false);
              }}
              loading={isSubmitting}
            >
              Confirmar Pago
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
