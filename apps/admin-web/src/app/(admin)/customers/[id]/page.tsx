'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { fetchCustomer, updateCustomer } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { AddressAutocomplete, CityAutocomplete, type ParsedAddress } from '@/components/ui/address-autocomplete';
import { Modal } from '@/components/ui/modal';
import { FormField } from '@/components/ui/form-field';
import { PageSpinner } from '@/components/ui/spinner';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  MapPin,
  Pencil,
  Save,
  User,
  StickyNote,
  ShoppingBag,
  TrendingUp,
  Package,
} from 'lucide-react';

const editSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres'),
  email: z.string().email('Email invalido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  documentType: z.string().optional().or(z.literal('')),
  documentNumber: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type EditForm = z.infer<typeof editSchema>;

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerId = params.id as string;
  const [showEdit, setShowEdit] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => fetchCustomer(customerId),
  });

  if (isLoading) return <PageSpinner />;

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
          Volver
        </Button>
        <div className="rounded-xl border border-status-danger/30 bg-status-danger-muted p-6 text-center">
          <p className="text-sm text-status-danger">Error al cargar el cliente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
        Volver a Clientes
      </Button>

      {/* Profile */}
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple-muted text-2xl font-bold text-accent-purple">
              {customer.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-white">{customer.name}</h1>
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Mail className="h-4 w-4" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Phone className="h-4 w-4" />
                  {customer.phone}
                </div>
              )}
              {customer.documentType && customer.documentNumber && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <FileText className="h-4 w-4" />
                  {customer.documentType} {customer.documentNumber}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1 text-xs text-white/30">
                Creado: {formatDate(customer.createdAt)}
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
              variant="danger"
              onClick={async () => {
                if (window.confirm('¿Estas seguro de eliminar este cliente? Esta accion no se puede deshacer.')) {
                  try {
                    await api.delete(`/customers/${customerId}`);
                    router.push('/customers');
                  } catch (e: any) {
                    alert(e.response?.data?.message || 'Error al eliminar');
                  }
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Card>

      {/* Seller Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Vendedor Asignado
          </CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-white/50">Nombre</p>
            <p className="text-sm text-white">{customer.seller?.name || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/50">Email</p>
            <p className="text-sm text-white">{customer.seller?.email || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/50">Telefono Vendedor</p>
            <p className="text-sm text-white">{customer.seller?.phone || '-'}</p>
          </div>
        </div>
      </Card>

      {/* Notes */}
      {customer.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" /> Notas
            </CardTitle>
          </CardHeader>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{customer.notes}</p>
        </Card>
      )}

      {/* Purchase Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-purple-muted">
              <ShoppingBag className="h-5 w-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-xs text-white/50">Total Compras</p>
              <p className="text-lg font-bold text-white">{formatCurrency(customer.totalPurchases || 0)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success/10">
              <TrendingUp className="h-5 w-5 text-status-success" />
            </div>
            <div>
              <p className="text-xs text-white/50">Total Pedidos</p>
              <p className="text-lg font-bold text-white">{customer.totalOrders || 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gold/10">
              <Package className="h-5 w-5 text-accent-gold" />
            </div>
            <div>
              <p className="text-xs text-white/50">Ticket Promedio</p>
              <p className="text-lg font-bold text-white">
                {customer.totalOrders > 0
                  ? formatCurrency((customer.totalPurchases || 0) / customer.totalOrders)
                  : formatCurrency(0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Addresses */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Direcciones ({customer.addresses?.length || 0})
          </CardTitle>
          <Button size="sm" onClick={() => setShowNewAddress(true)}>+ Nueva Dirección</Button>
        </CardHeader>
        {customer.addresses?.length > 0 ? (
          <div className="space-y-3">
            {customer.addresses.map((addr: any) => (
              <div
                key={addr.id}
                className="rounded-lg border border-glass-border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {addr.label && (
                        <p className="text-sm font-semibold text-white">{addr.label}</p>
                      )}
                      {addr.isDefault && (
                        <Badge variant="info">Principal</Badge>
                      )}
                    </div>
                    <p className="text-sm text-white/70">{addr.street}</p>
                    {addr.detail && (
                      <p className="text-sm text-white/50">{addr.detail}</p>
                    )}
                    <p className="text-xs text-white/30 mt-1">
                      {[addr.city, addr.state].filter(Boolean).join(', ')}
                    </p>
                    {addr.phone && (
                      <p className="text-xs text-white/30 mt-0.5">{addr.phone}</p>
                    )}
                    {addr.notes && (
                      <p className="text-xs text-white/30 mt-0.5 italic">{addr.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingAddress(addr)}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/30">Sin direcciones registradas</p>
        )}
      </Card>

      {/* Order History */}
      {customer.orders?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" /> Historial de Pedidos ({customer.orders.length})
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {customer.orders.map((order: any) => (
              <div key={order.id} className="rounded-lg border border-glass-border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <button
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="text-sm font-semibold text-accent-purple hover:underline cursor-pointer"
                    >
                      #{order.orderNumber}
                    </button>
                    <p className="text-xs text-white/40 mt-0.5">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatCurrency(order.total)}</p>
                    <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      order.status === 'PAID' || order.status === 'DELIVERED'
                        ? 'bg-status-success/15 text-status-success'
                        : order.status === 'SHIPPED'
                        ? 'bg-accent-purple/15 text-accent-purple'
                        : order.status === 'PENDING_PAYMENT'
                        ? 'bg-status-warning/15 text-status-warning'
                        : 'bg-white/10 text-white/50'
                    }`}>
                      {order.status === 'PAID' ? 'Pagado'
                        : order.status === 'SHIPPED' ? 'Enviado'
                        : order.status === 'DELIVERED' ? 'Entregado'
                        : order.status === 'PENDING_PAYMENT' ? 'Pago Pendiente'
                        : order.status}
                    </span>
                  </div>
                </div>
                {order.items?.length > 0 && (
                  <div className="space-y-1.5 border-t border-glass-border pt-3">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0">
                            <p className="text-xs text-white/70 truncate">
                              {item.variant?.name || item.productName || '-'}
                            </p>
                            {item.variant?.attributes?.size && (
                              <p className="text-xs text-white/30">{item.variant.attributes.size}ml</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs text-white/70">x{item.quantity}</p>
                          <p className="text-xs text-white/50">{formatCurrency(item.unitPrice)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
          }}
        />
      )}

      {/* New Address Modal */}
      {showNewAddress && (
        <AddressModal
          customerId={customerId}
          onClose={() => setShowNewAddress(false)}
          onSuccess={() => {
            setShowNewAddress(false);
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
          }}
        />
      )}

      {/* Edit Address Modal */}
      {editingAddress && (
        <AddressModal
          customerId={customerId}
          address={editingAddress}
          onClose={() => setEditingAddress(null)}
          onSuccess={() => {
            setEditingAddress(null);
            queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
          }}
        />
      )}
    </div>
  );
}

function AddressModal({
  customerId,
  address,
  onClose,
  onSuccess,
}: {
  customerId: string;
  address?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!address;
  const [form, setForm] = useState({
    label: address?.label || '',
    street: address?.street || '',
    detail: address?.detail || '',
    phone: address?.phone || '',
    phoneCode: address?.phoneCode || '+57',
    city: address?.city || '',
    state: address?.state || '',
    zip: address?.zip || '',
    country: address?.country || 'CO',
    notes: address?.notes || '',
    isDefault: address?.isDefault || false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/customers/${customerId}/addresses/${address.id}`, form);
      } else {
        await api.post(`/customers/${customerId}/addresses`, form);
      }
      onSuccess();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta dirección?')) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${customerId}/addresses/${address.id}`);
      onSuccess();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Editar Dirección' : 'Nueva Dirección'} size="md">
      <div className="space-y-4">
        <FormField label="Etiqueta">
          <Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Casa, Oficina..." />
        </FormField>
        <FormField label="Dirección" required>
          <AddressAutocomplete
            value={form.street}
            onChange={(val) => setForm((p) => ({ ...p, street: val }))}
            onSelect={(parsed: ParsedAddress) =>
              setForm((p) => ({
                ...p,
                street: parsed.street,
                city: parsed.city || p.city,
                state: parsed.state || p.state,
                country: parsed.country || p.country,
              }))
            }
          />
        </FormField>
        <FormField label="Detalle (Apto, Piso, Torre)">
          <Input value={form.detail} onChange={(e) => setForm((p) => ({ ...p, detail: e.target.value }))} placeholder="Apto 301" />
        </FormField>
        <FormField label="Teléfono">
          <PhoneInput
            value={form.phone}
            onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
            phoneCode={form.phoneCode}
            onCodeChange={(c) => setForm((p) => ({ ...p, phoneCode: c }))}
            placeholder="3001234567"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Ciudad" required>
            <CityAutocomplete
              defaultValue={form.city}
              onSelect={(city, state) =>
                setForm((p) => ({ ...p, city, state: state || p.state }))
              }
            />
          </FormField>
          <FormField label="Departamento">
            <Input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Código postal">
            <Input value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} placeholder="050021" />
          </FormField>
          <FormField label="País">
            <Input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Instrucciones adicionales">
          <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Indicaciones de entrega..." />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
            className="rounded border-glass-border"
          />
          Dirección principal
        </label>
        <div className="flex gap-3 pt-2">
          {isEdit && (
            <Button variant="danger" onClick={handleDelete} loading={deleting} size="sm">
              Eliminar
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} disabled={!form.street || !form.city}>
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      documentType: customer.documentType || '',
      documentNumber: customer.documentNumber || '',
      notes: customer.notes || '',
    },
  });

  const [phoneCode, setPhoneCode] = useState(customer.phoneCode || '+57');

  const mutation = useMutation({
    mutationFn: (data: EditForm) => updateCustomer(customer.id, { ...data, phoneCode }),
    onSuccess,
  });

  return (
    <Modal open onClose={onClose} title="Editar Cliente" size="lg">
      <form onSubmit={form.handleSubmit((vals) => mutation.mutate(vals))} className="space-y-4">
        {mutation.isError && (
          <div className="rounded-lg bg-status-danger-muted p-3 text-sm text-status-danger">
            {(mutation.error as any)?.response?.data?.message || 'Error al actualizar'}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Nombre Completo" error={form.formState.errors.name?.message} required>
            <Input {...form.register('name')} />
          </FormField>
          <FormField label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register('email')} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Telefono" error={form.formState.errors.phone?.message}>
            <PhoneInput
              value={form.watch('phone') || ''}
              onChange={(v) => form.setValue('phone', v)}
              phoneCode={phoneCode}
              onCodeChange={setPhoneCode}
              placeholder="3001234567"
            />
          </FormField>
          <FormField label="Tipo Documento">
            <Select {...form.register('documentType')}>
              <option value="">Seleccionar...</option>
              <option value="CC">CC</option>
              <option value="NIT">NIT</option>
              <option value="CE">CE</option>
              <option value="PP">Pasaporte</option>
            </Select>
          </FormField>
          <FormField label="Numero Documento">
            <Input {...form.register('documentNumber')} />
          </FormField>
        </div>

        <FormField label="Notas">
          <textarea
            {...form.register('notes')}
            rows={3}
            className="w-full rounded-lg border border-glass-border bg-glass-50 px-3 py-2 text-sm text-white focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/50"
            placeholder="Notas sobre el cliente..."
          />
        </FormField>

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
