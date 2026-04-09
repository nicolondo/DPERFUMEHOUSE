'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { PageSpinner } from '@/components/ui/spinner';
import { DataTable, Column } from '@/components/ui/data-table';
import { formatCurrency, formatDate, formatDateTime, formatPercent, formatPhone } from '@/lib/utils';
import { ArrowLeft, Package, CreditCard, Clock, FileText, CheckCircle, Truck, MapPin, X, Calendar, Download, RefreshCw, Pencil } from 'lucide-react';

const orderStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange' | 'brown'> = {
  DRAFT: 'default',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  SHIPPED: 'orange',
  DELIVERED: 'brown',
  CANCELLED: 'danger',
};

const paymentStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  REFUNDED: 'danger',
};

const commissionStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  APPROVED: 'info',
  PAID: 'success',
  CANCELLED: 'danger',
};

async function fetchOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return data;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = params.id as string;

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });

  const { data: odooSettings = [] } = useQuery({
    queryKey: ['settings', 'odoo', 'order-detail'],
    queryFn: async () => {
      const { data } = await api.get('/settings', { params: { group: 'odoo', includeSecrets: true } });
      return Array.isArray(data) ? data : data?.data || [];
    },
  });

  const settingsMap = new Map((odooSettings as any[]).map((s) => [s.key, s.value]));
  const odooBaseUrl = (settingsMap.get('odoo_url') as string | undefined)?.replace(/\/$/, '');
  const odooOrderUrl =
    odooBaseUrl && order?.odooSaleOrderId
      ? `${odooBaseUrl}/web#id=${order.odooSaleOrderId}&model=sale.order&view_type=form`
      : null;

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/orders/${orderId}/mark-paid`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Shipping state
  const [showRates, setShowRates] = useState(false);
  const [showPickup, setShowPickup] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pickupYear, setPickupYear] = useState(() => new Date().getFullYear());
  const [pickupMonth, setPickupMonth] = useState(() => new Date().getMonth() + 1);
  const [pickupDay, setPickupDay] = useState(() => new Date().getDate());
  const [pickupFrom, setPickupFrom] = useState(8);
  const [pickupTo, setPickupTo] = useState(19);

  const PICKUP_WINDOWS = [
    { label: '08:00 - 12:00', from: 8, to: 12 },
    { label: '08:00 - 19:00', from: 8, to: 19 },
    { label: '09:00 - 13:00', from: 9, to: 13 },
    { label: '10:00 - 14:00', from: 10, to: 14 },
    { label: '12:00 - 17:00', from: 12, to: 17 },
    { label: '14:00 - 19:00', from: 14, to: 19 },
  ];

  const { data: customer } = useQuery({
    queryKey: ['customer', order?.customerId],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${order?.customerId}`);
      return data?.data || data;
    },
    enabled: Boolean(order?.customerId),
  });

  useEffect(() => {
    if (order?.addressId) {
      setSelectedAddressId(order.addressId);
    }
  }, [order?.addressId]);

  useEffect(() => {
    const maxDay = new Date(pickupYear, pickupMonth, 0).getDate();
    if (pickupDay > maxDay) {
      setPickupDay(maxDay);
    }
  }, [pickupYear, pickupMonth, pickupDay]);

  useEffect(() => {
    const y = String(pickupYear);
    const m = String(pickupMonth).padStart(2, '0');
    const d = String(pickupDay).padStart(2, '0');
    setPickupDate(`${y}-${m}-${d}`);
  }, [pickupYear, pickupMonth, pickupDay]);

  const updateAddressMutation = useMutation({
    mutationFn: async ({ id, addressId }: { id: string; addressId: string }) => {
      const { data } = await api.patch(`/orders/${id}/address`, { addressId });
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowAddressModal(false);
    },
  });

  const ratesMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/shipping/rates/${orderId}`);
      return data?.rates || data || [];
    },
    onSuccess: () => setShowRates(true),
  });

  const labelMutation = useMutation({
    mutationFn: async ({ carrier, service }: { carrier: string; service: string }) => {
      const { data } = await api.post(`/shipping/labels/${orderId}`, { carrier, service });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setShowRates(false);
    },
  });

  const trackMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/shipping/track/${orderId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  const pickupMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/shipping/pickup/${orderId}`, {
        date: pickupDate,
        timeFrom: pickupFrom,
        timeTo: pickupTo,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setShowPickup(false);
    },
  });

  const cancelShipmentMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/shipping/cancel/${orderId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  const markShippedMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/orders/${orderId}/ship`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (isLoading) return <PageSpinner />;

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
          Volver
        </Button>
        <div className="rounded-xl border border-status-danger/30 bg-status-danger-muted p-6 text-center">
          <p className="text-sm text-status-danger">Error al cargar el pedido.</p>
        </div>
      </div>
    );
  }

  const canEditAddress = !['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(String(order.status || '').toUpperCase());
  const customerAddresses = customer?.addresses || [];

  const itemColumns: Column<any>[] = [
    {
      key: 'productName',
      header: 'Producto',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.imageUrl && (
            <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-lg border border-glass-border object-cover" />
          )}
          <div>
            <p className="font-medium text-white">{item.productName || item.variant?.name || '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (item) => <span>{item.quantity}</span>,
    },
    {
      key: 'unitPrice',
      header: 'Precio Unit.',
      render: (item) => <span>{formatCurrency(item.unitPrice || item.price || 0)}</span>,
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      render: (item) => (
        <span className="font-medium">
          {formatCurrency((item.unitPrice || item.price || 0) * (item.quantity || 0))}
        </span>
      ),
    },
  ];

  const commissionColumns: Column<any>[] = [
    {
      key: 'sellerName',
      header: 'Vendedor',
      render: (item) => (
        (item.user?.id || item.userId) ? (
          <button
            onClick={() => router.push(`/users/${item.user?.id || item.userId}`)}
            className="text-accent-purple hover:underline"
          >
            {item.sellerName || item.user?.name || item.seller?.name || '-'}
          </button>
        ) : (
          <span>{item.sellerName || item.seller?.name || '-'}</span>
        )
      ),
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
      key: 'baseAmount',
      header: 'Base',
      render: (item) => <span>{formatCurrency(item.baseAmount || 0)}</span>,
    },
    {
      key: 'amount',
      header: 'Comision',
      render: (item) => <span className="font-medium">{formatCurrency(item.amount || 0)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (item) => (
        <Badge variant={commissionStatusVariant[item.status] || 'default'}>{item.status}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
        Volver a Pedidos
      </Button>

      {/* Order Header */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">
                Pedido #{order.orderNumber || order.id?.slice(0, 8)}
              </h1>
              <Badge variant={orderStatusVariant[order.status] || 'default'}>
                {order.status}
              </Badge>
              <Badge variant={paymentStatusVariant[order.paymentStatus] || 'default'}>
                {order.paymentStatus || 'N/A'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-white/50">
              Creado el {formatDateTime(order.createdAt)}
            </p>
            {order.paymentMethod && (
              <p className="mt-0.5 text-xs text-white/40">
                Método de pago: {order.paymentMethod === 'CASH' ? 'Efectivo' : 'En línea'}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-sm text-white/50">Total</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(order.total || 0)}</p>
            </div>
            {(order.status === 'DRAFT' || order.status === 'PENDING_PAYMENT') && (
              <Button
                variant="primary"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={() => markPaidMutation.mutate()}
                disabled={markPaidMutation.isPending}
              >
                {markPaidMutation.isPending ? 'Procesando...' : 'Marcar como Pagado'}
              </Button>
            )}
            {markPaidMutation.isError && (
              <p className="text-xs text-status-danger">
                Error: {(markPaidMutation.error as any)?.response?.data?.message || 'No se pudo marcar como pagado'}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Cliente</p>
              <button
                onClick={() => router.push(`/customers/${order.customer?.id || order.customerId}`)}
                className="text-sm font-semibold text-accent-purple hover:underline text-left"
              >
                {order.customerName || order.customer?.name || '-'}
              </button>
              <p className="text-xs text-white/50">
                {order.customerEmail || order.customer?.email || ''}
              </p>
              {(order.customerPhone || order.customer?.phone) && (
                <p className="text-xs text-white/50">
                  {formatPhone(order.customerPhone || order.customer?.phone)}
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-success-muted text-status-success">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Vendedor</p>
              <button
                onClick={() => router.push(`/users/${order.seller?.id || order.sellerId}`)}
                className="text-sm font-semibold text-accent-purple hover:underline text-left"
              >
                {order.sellerName || order.seller?.name || '-'}
              </button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning-muted text-status-warning">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Pedido Odoo</p>
              {odooOrderUrl ? (
                <a
                  href={odooOrderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-accent-purple hover:underline"
                >
                  {order.orderNumber || order.odooSaleOrderId}
                </a>
              ) : (
                <p className="text-sm font-semibold text-white">
                  {order.orderNumber || order.odooSaleOrderId || '-'}
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-white/50">Factura Odoo</p>
              <p className="text-sm font-semibold text-white">
                {order.odooInvoiceName || (order.odooInvoiceId ? `#${order.odooInvoiceId}` : '-')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Shipping Address */}
      {order.address && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
                  <MapPin className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-white/50">Dirección de Envío</p>
              </div>
              {canEditAddress && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddressModal(true)}
                  icon={<Pencil className="h-4 w-4" />}
                >
                  Cambiar dirección
                </Button>
              )}
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{order.address.label ? `${order.address.label} — ` : ''}{order.address.street}</p>
                {order.address.detail && (
                  <p className="text-sm text-white/70">{order.address.detail}</p>
                )}
                <p className="text-sm text-white/70">
                  {order.address.city}{order.address.state ? `, ${order.address.state}` : ''}{order.address.zip ? ` - ${order.address.zip}` : ''}
                </p>
                <p className="text-sm text-white/70">{order.address.country}</p>
                {order.address.phone && (
                  <p className="mt-1 text-xs text-white/50">Tel: {formatPhone(order.address.phone)}</p>
                )}
                {order.address.notes && (
                  <p className="mt-1 text-xs text-white/40 italic">{order.address.notes}</p>
                )}
                {!canEditAddress && (
                  <p className="mt-2 text-xs text-white/40">No se puede cambiar la dirección en este estado del pedido.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Modal
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="Cambiar dirección de envío"
        size="md"
      >
        <div className="space-y-3">
          {customerAddresses.length === 0 ? (
            <p className="text-sm text-white/50">Este cliente no tiene direcciones guardadas.</p>
          ) : (
            customerAddresses.map((address: any) => (
              <label
                key={address.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-glass-border bg-glass-50 p-3"
              >
                <input
                  type="radio"
                  name="shippingAddress"
                  value={address.id}
                  checked={selectedAddressId === address.id}
                  onChange={() => setSelectedAddressId(address.id)}
                  className="mt-1 h-4 w-4"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{address.label || 'Dirección'}</p>
                  <p className="text-sm text-white/70">{address.street}</p>
                  <p className="text-xs text-white/40">{address.city}{address.state ? `, ${address.state}` : ''}</p>
                </div>
              </label>
            ))
          )}

          {updateAddressMutation.isError && (
            <p className="text-xs text-status-danger">
              {(updateAddressMutation.error as any)?.response?.data?.message || 'No se pudo actualizar la dirección'}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="w-full" onClick={() => setShowAddressModal(false)}>
              Cancelar
            </Button>
            <Button
              className="w-full"
              onClick={() => updateAddressMutation.mutate({ id: order.id, addressId: selectedAddressId })}
              loading={updateAddressMutation.isPending}
              disabled={!selectedAddressId || selectedAddressId === order?.addressId || customerAddresses.length === 0}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Order Items */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Productos del Pedido</h3>
        </div>
        <div className="p-4">
          <DataTable
            columns={itemColumns}
            data={order.items || order.orderItems || []}
            emptyMessage="No hay productos en este pedido"
            keyExtractor={(item) => item.id || item.productId}
          />
          {/* Totals */}
          <div className="mt-4 border-t border-glass-border pt-4">
            <div className="flex flex-col items-end gap-1">
              <div className="flex w-60 items-center justify-between text-sm">
                <span className="text-white/50">Subtotal</span>
                <span>{formatCurrency(order.subtotal || order.total || 0)}</span>
              </div>
              {order.tax != null && (
                <div className="flex w-60 items-center justify-between text-sm">
                  <span className="text-white/50">Impuestos</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
              )}
              {order.shippingCost != null && (
                <div className="flex w-60 items-center justify-between text-sm">
                  <span className="text-white/50">Envio</span>
                  <span>{formatCurrency(order.shippingCost)}</span>
                </div>
              )}
              <div className="flex w-60 items-center justify-between border-t border-glass-border pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatCurrency(order.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Shipping / Envío */}
      {['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) && (
        <Card padding={false}>
          <div className="border-b border-glass-border px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Truck className="h-5 w-5" /> Envío
            </h3>
            <div className="flex items-center gap-2">
              {order.shipment && !['CANCELLED'].includes(order.shipment.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => trackMutation.mutate()}
                  disabled={trackMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${trackMutation.isPending ? 'animate-spin' : ''}`} />
                  Rastrear
                </Button>
              )}
              {(!order.shipment || order.shipment.status === 'CANCELLED') && (
                <Button
                  size="sm"
                  onClick={() => ratesMutation.mutate()}
                  disabled={ratesMutation.isPending}
                >
                  {ratesMutation.isPending ? 'Cotizando...' : 'Cotizar Envío'}
                </Button>
              )}
            </div>
          </div>
          <div className="p-6 space-y-4">
            {/* No shipment yet */}
            {!order.shipment && !showRates && (
              <p className="text-center text-sm text-white/50">
                No se ha generado guía de envío. Cotiza tarifas para comenzar.
              </p>
            )}

            {/* Rates results */}
            {showRates && ratesMutation.data && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Tarifas disponibles</h4>
                  <Button size="sm" variant="ghost" onClick={() => setShowRates(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {ratesMutation.data.length === 0 && (
                  <p className="text-sm text-white/50">No se encontraron tarifas.</p>
                )}
                <div className="grid gap-2">
                  {(ratesMutation.data || []).map((rate: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-glass-border bg-glass-bg p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {rate.carrierDescription || rate.carrier} — {rate.serviceDescription || rate.service}
                        </p>
                        <p className="text-xs text-white/50">
                          {rate.deliveryDate?.date
                            ? `Entrega est. ${new Date(rate.deliveryDate.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}${rate.deliveryDate.time ? ` antes de ${rate.deliveryDate.time}` : ''}`
                            : rate.deliveryEstimate || 'Sin estimado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-white">
                          {formatCurrency(rate.totalPrice || rate.price || 0)}
                        </span>
                        <Button
                          size="sm"
                          onClick={() =>
                            labelMutation.mutate({
                              carrier: rate.carrier,
                              service: rate.service,
                            })
                          }
                          disabled={labelMutation.isPending}
                        >
                          {labelMutation.isPending ? 'Generando...' : 'Generar Guía'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Existing shipment info */}
            {order.shipment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-white/50">Transportadora</p>
                    <p className="text-sm font-medium text-white capitalize">{order.shipment.carrier}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Servicio</p>
                    <p className="text-sm font-medium text-white">{order.shipment.service}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Guía</p>
                    <p className="text-sm font-medium text-white">{order.shipment.trackingNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Estado</p>
                    <Badge variant={
                      order.shipment.status === 'DELIVERED' ? 'success' :
                      order.shipment.status === 'CANCELLED' ? 'danger' :
                      order.shipment.status === 'IN_TRANSIT' ? 'info' :
                      order.shipment.status === 'PICKUP_SCHEDULED' ? 'info' : 'warning'
                    }>
                      {{
                        QUOTED: 'Cotizado',
                        LABEL_CREATED: 'Guía creada',
                        PICKUP_SCHEDULED: 'Recolección programada',
                        PICKED_UP: 'Recogido',
                        IN_TRANSIT: 'En tránsito',
                        DELIVERED: 'Entregado',
                        CANCELLED: 'Cancelado',
                      }[order.shipment.status as string] || order.shipment.status}
                    </Badge>
                  </div>
                </div>

                {/* Cost */}
                {order.shipment.totalPrice && (
                  <div>
                    <p className="text-xs text-white/50">Costo envío</p>
                    <p className="text-sm font-bold text-white">
                      {formatCurrency(order.shipment.totalPrice)} {order.shipment.currency || 'COP'}
                    </p>
                  </div>
                )}

                {/* Links */}
                <div className="flex items-center gap-3">
                  {order.shipment.labelUrl && (
                    <a
                      href={order.shipment.labelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent-purple hover:underline"
                    >
                      <Download className="h-4 w-4" /> Descargar etiqueta
                    </a>
                  )}
                  {order.shipment.trackUrl && (
                    <a
                      href={order.shipment.trackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent-purple hover:underline"
                    >
                      <MapPin className="h-4 w-4" /> Rastrear en sitio
                    </a>
                  )}
                </div>

                {/* Pickup scheduling */}
                {['LABEL_CREATED', 'PICKUP_SCHEDULED'].includes(order.shipment.status) && (
                  <div className="border-t border-glass-border pt-4">
                    {!showPickup ? (
                      <Button size="sm" onClick={() => setShowPickup(true)}>
                        <Calendar className="h-4 w-4 mr-1" /> Programar recolección
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-white">Programar recolección</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-white/50">Día</label>
                            <select
                              value={pickupDay}
                              onChange={(e) => setPickupDay(Number(e.target.value))}
                              className="mt-1 block w-full rounded-lg border border-glass-border bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                            >
                              {Array.from({ length: new Date(pickupYear, pickupMonth, 0).getDate() }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-white/50">Mes</label>
                            <select
                              value={pickupMonth}
                              onChange={(e) => setPickupMonth(Number(e.target.value))}
                              className="mt-1 block w-full rounded-lg border border-glass-border bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                            >
                              {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-white/50">Año</label>
                            <select
                              value={pickupYear}
                              onChange={(e) => setPickupYear(Number(e.target.value))}
                              className="mt-1 block w-full rounded-lg border border-glass-border bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                            >
                              {[new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-1">
                            <label className="text-xs text-white/50">Ventana horaria</label>
                            <select
                              value={`${pickupFrom}-${pickupTo}`}
                              onChange={(e) => {
                                const [f, t] = e.target.value.split('-').map(Number);
                                setPickupFrom(f);
                                setPickupTo(t);
                              }}
                              className="mt-1 block w-full rounded-lg border border-glass-border bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                            >
                              {PICKUP_WINDOWS.map((w) => (
                                <option key={w.label} value={`${w.from}-${w.to}`}>{w.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => pickupMutation.mutate()}
                            disabled={pickupMutation.isPending || !pickupDate}
                          >
                            {pickupMutation.isPending ? 'Programando...' : 'Confirmar'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowPickup(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {order.shipment.pickupConfirmation && (
                  <p className="text-xs text-white/50">
                    Recolección: {order.shipment.pickupConfirmation}
                  </p>
                )}

                {/* Cancel shipment */}
                {['LABEL_CREATED', 'QUOTED', 'PICKUP_SCHEDULED'].includes(order.shipment.status) && (
                  <div className="border-t border-glass-border pt-4">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm('¿Cancelar este envío? Se revertirá el estado del pedido.')) {
                          cancelShipmentMutation.mutate();
                        }
                      }}
                      disabled={cancelShipmentMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {cancelShipmentMutation.isPending ? 'Cancelando...' : 'Cancelar envío'}
                    </Button>
                  </div>
                )}

                {/* Tracking events timeline */}
                {(order.shipment.events || []).length > 0 && (
                  <div className="border-t border-glass-border pt-4">
                    <h4 className="text-sm font-semibold text-white mb-3">Historial de rastreo</h4>
                    <div className="space-y-3">
                      {(order.shipment.events || []).map((evt: any, idx: number) => (
                        <div key={evt.id || idx} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple-muted">
                              <MapPin className="h-3 w-3 text-accent-purple" />
                            </div>
                            {idx < (order.shipment.events || []).length - 1 && (
                              <div className="mt-1 h-full w-px bg-glass-border" />
                            )}
                          </div>
                          <div className="pb-2">
                            <p className="text-sm text-white">{evt.description}</p>
                            <p className="text-xs text-white/50">
                              {evt.location && `${evt.location} · `}
                              {formatDateTime(evt.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Track mutation results (live) */}
                {trackMutation.data?.tracking && (
                  <div className="border-t border-glass-border pt-4">
                    <h4 className="text-sm font-semibold text-white mb-3">Último rastreo</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-white/50">Estado</p>
                        <p className="text-white font-medium">{trackMutation.data.tracking.status || '-'}</p>
                      </div>
                      <div>
                        <p className="text-white/50">Entrega estimada</p>
                        <p className="text-white font-medium">
                          {trackMutation.data.tracking.estimatedDelivery
                            ? new Date(trackMutation.data.tracking.estimatedDelivery).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </p>
                      </div>
                      {trackMutation.data.tracking.signedBy && (
                        <div>
                          <p className="text-white/50">Firmado por</p>
                          <p className="text-white font-medium">{trackMutation.data.tracking.signedBy}</p>
                        </div>
                      )}
                      {trackMutation.data.tracking.deliveredAt && (
                        <div>
                          <p className="text-white/50">Entregado</p>
                          <p className="text-white font-medium">
                            {new Date(trackMutation.data.tracking.deliveredAt).toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error messages */}
            {(ratesMutation.error || labelMutation.error || pickupMutation.error || cancelShipmentMutation.error || trackMutation.error) && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">
                  {(ratesMutation.error as any)?.response?.data?.message ||
                   (labelMutation.error as any)?.response?.data?.message ||
                   (pickupMutation.error as any)?.response?.data?.message ||
                   (cancelShipmentMutation.error as any)?.response?.data?.message ||
                   (trackMutation.error as any)?.response?.data?.message ||
                   'Error en operación de envío'}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Payment Events Timeline */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Eventos de Pago</h3>
        </div>
        <div className="p-6">
          {(order.paymentEvents || order.payments || []).length > 0 ? (
            <div className="space-y-4">
              {(order.paymentEvents || order.payments || []).map((event: any, idx: number) => (
                <div key={event.id || idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple-muted">
                      <Clock className="h-4 w-4 text-accent-purple" />
                    </div>
                    {idx < (order.paymentEvents || order.payments || []).length - 1 && (
                      <div className="mt-1 h-full w-px bg-glass-border" />
                    )}
                  </div>
                  <div className="pb-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {event.type || event.event || event.status}
                      </p>
                      <Badge variant={event.status === 'success' ? 'success' : event.status === 'failed' ? 'danger' : 'default'}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-white/50">{formatDateTime(event.createdAt || event.date)}</p>
                    {event.amount && (
                      <p className="mt-0.5 text-sm text-white/70">{formatCurrency(event.amount)}</p>
                    )}
                    {event.reference && (
                      <p className="mt-0.5 text-xs text-white/30">Ref: {event.reference}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-white/50">No hay eventos de pago registrados.</p>
          )}
        </div>
      </Card>

      {/* Commission Entries */}
      <Card padding={false}>
        <div className="border-b border-glass-border px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Comisiones del Pedido</h3>
        </div>
        <div className="p-4">
          <DataTable
            columns={commissionColumns}
            data={order.commissions || []}
            emptyMessage="No hay comisiones generadas para este pedido"
            keyExtractor={(item) => item.id}
          />
        </div>
      </Card>
    </div>
  );
}
