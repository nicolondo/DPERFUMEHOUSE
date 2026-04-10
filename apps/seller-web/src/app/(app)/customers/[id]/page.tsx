'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  FileText,
  MapPin,
  Plus,
  Pencil,
  ShoppingBag,
  Sparkles,
  MessageCircle,
  Check,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge, OrderStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { AddressAutocomplete, type ParsedAddress } from '@/components/ui/address-autocomplete';
import { PageHeader } from '@/components/layout/page-header';
import { useCustomer, useAddAddress, useUpdateAddress } from '@/hooks/use-customers';
import { useOrders } from '@/hooks/use-orders';
import { useCreateLeadForCustomer } from '@/hooks/use-leads';
import { useCategories } from '@/hooks/use-products';
import { formatCurrency, formatDate, getInitials, formatPhone } from '@/lib/utils';
import api from '@/lib/api';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: ordersData, isLoading: ordersLoading } = useOrders();
  const addAddress = useAddAddress();
  const createLead = useCreateLeadForCustomer();
  const { data: categoriesData } = useCategories();

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const updateAddress = useUpdateAddress();
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  // Build brand → full category name map
  const fullCategories: string[] = Array.isArray(categoriesData) ? categoriesData : [];
  const categoryMap: Record<string, string> = {};
  fullCategories.forEach((c: string) => {
    const parts = c.split('/').map((p: string) => p.trim());
    const brand = parts.length >= 3 ? parts[2] : parts[parts.length - 1];
    if (!categoryMap[brand]) categoryMap[brand] = c;
  });
  const sellerBrands = Object.keys(categoryMap);

  const handleSendQuestionnaire = async (brands?: string[], method: 'whatsapp-email' | 'email' = 'whatsapp-email') => {
    if (!id) return;
    try {
      const fullNames = (brands || sellerBrands).map(b => categoryMap[b]).filter(Boolean);
      const result = await createLead.mutateAsync({
        customerId: id,
        selectedCategories: fullNames.length > 0 ? fullNames : undefined,
      });
      const leadId = result.lead?.id || result.id;
      const url = result.questionnaireUrl || result.lead?.questionnaireUrl || result.url;

      // Always send email if customer has email
      if (leadId && customer?.email) {
        try {
          await api.post(`/leads/${leadId}/send-email`);
        } catch {
          // Non-blocking
        }
      }

      // Open WhatsApp if method includes it
      if (method === 'whatsapp-email') {
        const phone = customer?.phone?.replace(/\D/g, '');
        if (phone && url) {
          const msg = `Hola ${customer?.name?.split(' ')[0]}! 🌿✨ Te comparto este cuestionario rápido para encontrar tu perfume ideal:\n${url}`;
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
      }
    } catch {
      // handled by react-query
    }
  };
  const [addressForm, setAddressForm] = useState({
    label: '',
    street: '',
    detail: '',
    phone: '',
    phoneCode: '+57',
    city: '',
    state: '',
    country: 'Colombia',
    isDefault: false,
    notes: '',
  });

  const customerOrders = (ordersData?.data ?? []).filter(
    (order: any) => order.customerId === id
  );

  const handleAddAddress = async () => {
    if (!id || !addressForm.label || !addressForm.street || !addressForm.city) return;
    try {
      await addAddress.mutateAsync({ customerId: id, ...addressForm });
      setShowAddressModal(false);
      setAddressForm({
        label: '',
        street: '',
        detail: '',
        phone: '',
        phoneCode: '+57',
        city: '',
        state: '',
        country: 'Colombia',
        isDefault: false,
        notes: '',
      });
    } catch {
      // Error handled by react-query
    }
  };

  if (isLoading) return <PageSpinner />;

  if (!customer) {
    return (
      <div>
        <PageHeader title="Cliente" backHref="/customers" />
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Cliente no encontrado"
          description="Este cliente no existe o fue eliminado"
        />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title={customer.name}
        backHref="/customers"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/customers/${id}/edit`)}
            leftIcon={<Pencil className="h-4 w-4" />}
          >
            Editar
          </Button>
        }
      />

      <div className="px-4 space-y-4">
        {/* Customer Info Card */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-accent-purple-muted text-lg font-bold text-accent-purple">
              {getInitials(customer.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">{customer.name}</h2>
              <p className="text-xs text-white/30">
                Cliente desde {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {customer.email && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-glass-50">
                  <Mail className="h-4 w-4 text-white/50" />
                </div>
                <div>
                  <p className="text-xs text-white/30">Email</p>
                  <p className="text-sm text-white">{customer.email}</p>
                </div>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-glass-50">
                  <Phone className="h-4 w-4 text-white/50" />
                </div>
                <div>
                  <p className="text-xs text-white/30">Telefono</p>
                  <p className="text-sm text-white">{formatPhone(customer.phone)}</p>
                </div>
              </div>
            )}
            {customer.documentNumber && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-glass-50">
                  <FileText className="h-4 w-4 text-white/50" />
                </div>
                <div>
                  <p className="text-xs text-white/30">
                    {customer.documentType || 'Documento'}
                  </p>
                  <p className="text-sm text-white">
                    {customer.documentType === 'NIT' && customer.documentNumber?.replace(/[^0-9]/g, '').length === 10
                      ? customer.documentNumber.replace(/[^0-9]/g, '').slice(0, 9) + '-' + customer.documentNumber.replace(/[^0-9]/g, '')[9]
                      : customer.documentNumber}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Send Questionnaire */}
        <button
          onClick={() => {
            if (!id) return;
            setSelectedBrands([...sellerBrands]);
            setShowBrandPicker(true);
          }}
          disabled={createLead.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/20 p-4 text-sm font-medium text-amber-300 hover:from-amber-500/15 hover:to-purple-500/15 transition-colors disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {createLead.isPending ? 'Enviando...' : 'Enviar Cuestionario de Fragancias'}
        </button>

        {/* Brand Picker + Send Method Modal */}
        {showBrandPicker && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowBrandPicker(false)}>
            <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md mx-0 sm:mx-4 animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
              {/* Handle bar (mobile) */}
              <div className="flex justify-center mb-4 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Cuestionario de Fragancias</h3>
                    <p className="text-xs text-white/40">Selecciona marcas y metodo de envio</p>
                  </div>
                </div>
                <button onClick={() => setShowBrandPicker(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Brand Selection */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Marcas</p>
                  <button
                    onClick={() => setSelectedBrands(selectedBrands.length === sellerBrands.length ? [] : [...sellerBrands])}
                    className="text-xs text-amber-400/80 hover:text-amber-400 transition-colors"
                  >
                    {selectedBrands.length === sellerBrands.length ? 'Deseleccionar' : 'Seleccionar todas'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sellerBrands.map((brand) => {
                    const isSelected = selectedBrands.includes(brand);
                    return (
                      <button
                        key={brand}
                        onClick={() => setSelectedBrands(prev => isSelected ? prev.filter(b => b !== brand) : [...prev, brand])}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isSelected
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/10'
                            : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        {brand}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10 mb-5" />

              {/* Send Method — triggers send directly */}
              <div>
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2.5">Enviar por</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (selectedBrands.length === 0 || createLead.isPending) return;
                      setShowBrandPicker(false);
                      handleSendQuestionnaire(selectedBrands, 'whatsapp-email');
                    }}
                    disabled={selectedBrands.length === 0 || createLead.isPending}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all duration-200 bg-emerald-500/15 border-emerald-500/40 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-400" />
                      <span className="text-lg text-emerald-400">+</span>
                      <Mail className="h-4 w-4 text-emerald-400" />
                    </div>
                    <span className="text-xs font-medium text-emerald-300">WhatsApp + Email</span>
                  </button>
                  <button
                    onClick={() => {
                      if (selectedBrands.length === 0 || createLead.isPending || !customer?.email) return;
                      setShowBrandPicker(false);
                      handleSendQuestionnaire(selectedBrands, 'email');
                    }}
                    disabled={selectedBrands.length === 0 || createLead.isPending || !customer?.email}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all duration-200 bg-blue-500/15 border-blue-500/40 shadow-sm shadow-blue-500/10 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Mail className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-medium text-blue-300">Solo Email</span>
                  </button>
                </div>
                {!customer?.email && (
                  <p className="mt-2 text-xs text-white/30 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Sin email — solo WhatsApp disponible
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Addresses Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <MapPin className="h-4 w-4 text-white/30" />
              Direcciones
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAddressForm(prev => ({ ...prev, phone: customer?.phone || '' }));
                setShowAddressModal(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Agregar
            </Button>
          </div>

          {customer.addresses.length === 0 ? (
            <Card>
              <p className="py-4 text-center text-sm text-white/30">
                No hay direcciones registradas
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {customer.addresses.map((address: any) => (
                <Card key={address.id} padding="sm">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
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
                      {address.notes && (
                        <p className="mt-1 text-xs text-white/30 italic">
                          {address.notes}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingAddress(address)}
                      className="p-1.5 text-white/30 hover:text-accent-purple"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders Section */}
        <div>
          <h3 className="flex items-center gap-2 mb-3 text-base font-semibold text-white">
            <ShoppingBag className="h-4 w-4 text-white/30" />
            Pedidos Recientes
          </h3>

          {ordersLoading ? (
            <Card>
              <p className="py-4 text-center text-sm text-white/30">Cargando...</p>
            </Card>
          ) : customerOrders.length === 0 ? (
            <Card>
              <p className="py-4 text-center text-sm text-white/30">
                No hay pedidos registrados
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {customerOrders.slice(0, 5).map((order: any) => (
                <Card
                  key={order.id}
                  padding="sm"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        #{order.orderNumber}
                      </p>
                      <p className="text-xs text-white/30">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(order.total)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Address Modal */}
      <Modal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="Agregar Direccion"
      >
        <div className="space-y-4">
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
            label="Detalle"
            placeholder="Apto, piso, oficina..."
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
            label="Instrucciones adicionales"
            placeholder="Timbre, porteria, horario..."
            value={addressForm.notes}
            onChange={(e) =>
              setAddressForm((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={addressForm.isDefault}
              onChange={(e) =>
                setAddressForm((prev) => ({
                  ...prev,
                  isDefault: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-glass-border bg-glass-50 text-accent-purple focus:ring-accent-purple/50"
            />
            Direccion principal
          </label>

          <Button
            fullWidth
            onClick={handleAddAddress}
            loading={addAddress.isPending}
            disabled={!addressForm.label || !addressForm.street || !addressForm.city}
          >
            Guardar Direccion
          </Button>
        </div>
      </Modal>

      {/* Edit Address Modal */}
      {editingAddress && (
        <EditAddressModal
          customerId={id!}
          address={editingAddress}
          onClose={() => setEditingAddress(null)}
          onSave={async (data) => {
            await updateAddress.mutateAsync({
              customerId: id!,
              addressId: editingAddress.id,
              ...data,
            });
            setEditingAddress(null);
          }}
          saving={updateAddress.isPending}
        />
      )}
    </div>
  );
}

function EditAddressModal({
  customerId,
  address,
  onClose,
  onSave,
  saving,
}: {
  customerId: string;
  address: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    label: address.label || '',
    street: address.street || '',
    detail: address.detail || '',
    phone: address.phone || '',
    phoneCode: address.phoneCode || '+57',
    city: address.city || '',
    state: address.state || '',
    notes: address.notes || '',
  });

  return (
    <Modal isOpen onClose={onClose} title="Editar Direccion">
      <div className="space-y-4">
        <Input
          label="Etiqueta"
          value={form.label}
          onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          placeholder="Casa, Oficina..."
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/70">
            Direccion
          </label>
          <AddressAutocomplete
            value={form.street}
            onChange={(val) => setForm((p) => ({ ...p, street: val }))}
            onSelect={(parsed) => {
              setForm((p) => ({
                ...p,
                street: parsed.street,
                city: parsed.city,
                state: parsed.state,
              }));
            }}
            placeholder="Buscar direccion..."
          />
        </div>
        <Input
          label="Detalle (Apto, Piso, Torre)"
          value={form.detail}
          onChange={(e) => setForm((p) => ({ ...p, detail: e.target.value }))}
          placeholder="Apto 301, Torre B"
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/70">
            Telefono
          </label>
          <PhoneInput
            value={form.phone}
            phoneCode={form.phoneCode}
            onChange={(val) => setForm((p) => ({ ...p, phone: val }))}
            onCodeChange={(code) => setForm((p) => ({ ...p, phoneCode: code }))}
            placeholder="3001234567"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Ciudad" value={form.city} readOnly className="bg-glass-50 text-white/50" />
          <Input label="Departamento" value={form.state} readOnly className="bg-glass-50 text-white/50" />
        </div>
        <Input
          label="Instrucciones adicionales"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Indicaciones de entrega..."
        />
        <Button
          fullWidth
          onClick={() => onSave(form)}
          loading={saving}
          disabled={!form.label || !form.street || !form.city}
        >
          Guardar Cambios
        </Button>
      </div>
    </Modal>
  );
}
