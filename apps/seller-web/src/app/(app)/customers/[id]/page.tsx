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
  MessageCircle,
  Send,
  CheckCircle2,
  Loader2,
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
import { useCreateLeadForCustomer, useSendQuestionnaireEmail } from '@/hooks/use-leads';
import { formatCurrency, formatDate, getInitials, getWhatsAppPhone } from '@/lib/utils';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: ordersData, isLoading: ordersLoading } = useOrders();
  const addAddress = useAddAddress();

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const updateAddress = useUpdateAddress();
  const createLead = useCreateLeadForCustomer();
  const sendEmail = useSendQuestionnaireEmail();
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendWithChannel = async (withWhatsApp: boolean) => {
    if (!id) return;
    // Open empty window synchronously before any await to avoid popup blocking
    let winRef: Window | null = null;
    if (withWhatsApp && customer?.phone) {
      winRef = window.open('', '_blank');
    }
    try {
      const result = await createLead.mutateAsync({ customerId: id }) as any;
      if (withWhatsApp && customer?.phone) {
        const phone = getWhatsAppPhone(customer.phone);
        const text = encodeURIComponent(result.whatsappMessage);
        const waUrl = `https://wa.me/${phone}?text=${text}`;
        if (winRef) {
          winRef.location.href = waUrl;
        } else {
          window.open(waUrl, '_blank');
        }
      }
      await sendEmail.mutateAsync(result.lead.id);
      setEmailSent(true);
    } catch {
      if (winRef) winRef.close();
      // handled by react-query
    }
  };

  const [addressForm, setAddressForm] = useState({
    label: '',
    street: '',
    detail: '',
    phone: '',
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
                  <p className="text-sm text-white">{customer.phone}</p>
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

        {/* Questionnaire Button */}
        {customer.phone && (
          !showChannelSelector && !emailSent ? (
            <button
              onClick={() => setShowChannelSelector(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-glass-border bg-glass-50 backdrop-blur-sm px-4 py-3.5 text-sm font-medium text-white/80 hover:bg-glass-100 hover:text-white transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-accent-purple" />
              Enviar Cuestionario
            </button>
          ) : emailSent ? (
            <div className="flex items-center gap-2 rounded-2xl bg-green-500/10 border border-green-500/20 px-4 py-3.5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-400">¡Cuestionario enviado con éxito!</p>
              <button onClick={() => { setShowChannelSelector(false); setEmailSent(false); }} className="ml-auto text-xs text-white/30 hover:text-white/60">Nuevo</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-white/40 px-1 mb-1">¿Cómo querés enviar el cuestionario?</p>
              <button
                onClick={() => handleSendWithChannel(true)}
                disabled={createLead.isPending || sendEmail.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {(createLead.isPending || sendEmail.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                WhatsApp + Correo electrónico
              </button>
              <button
                onClick={() => handleSendWithChannel(false)}
                disabled={createLead.isPending || sendEmail.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-glass-border bg-glass-50 backdrop-blur-sm px-4 py-3.5 text-sm font-medium text-white/70 disabled:opacity-50"
              >
                {(createLead.isPending || sendEmail.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Solo Correo electrónico
              </button>
              <button onClick={() => setShowChannelSelector(false)} className="w-full text-xs text-white/30 hover:text-white/60 py-1">Cancelar</button>
            </div>
          )
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
                        <p className="text-xs text-white/30">{address.phone}</p>
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
            onChange={(val) =>
              setAddressForm((prev) => ({ ...prev, phone: val }))
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
            onChange={(val) => setForm((p) => ({ ...p, phone: val }))}
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
