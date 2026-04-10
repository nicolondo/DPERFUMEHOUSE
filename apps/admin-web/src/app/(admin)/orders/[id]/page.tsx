'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { PageSpinner } from '@/components/ui/spinner';
import { DataTable, Column } from '@/components/ui/data-table';
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '@/lib/utils';
import { ArrowLeft, Package, CreditCard, Clock, FileText, CheckCircle, Truck, ExternalLink, X, Trash2, MapPin, ChevronDown } from 'lucide-react';

const orderStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  CONFIRMED_ODOO: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
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

  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');

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

  const deliverMutation = useMutation({
    mutationFn: async (notes: string) => {
      const { data } = await api.patch(`/orders/${orderId}/deliver`, { notes: notes || undefined });
      return data;
    },
    onSuccess: () => {
      setDeliverModalOpen(false);
      setDeliveryNotes('');
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<{ carrier: string; service: string; serviceDescription: string; deliveryEstimate: string; totalPrice: string } | null>(null);

  const [changeAddressOpen, setChangeAddressOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const customerId = order?.customer?.id || order?.customerId;
  const { data: customerData } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => { const { data } = await api.get(`/customers/${customerId}`); return data; },
    enabled: !!(changeAddressOpen && customerId),
  });

  const updateAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { data } = await api.patch(`/orders/${orderId}/address`, { addressId });
      return data;
    },
    onSuccess: () => {
      setChangeAddressOpen(false);
      setSelectedAddressId(null);
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });

  const quoteRatesMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/shipping/rates/${orderId}`);
      return data as { orderId: string; rates: Array<{ carrier: string; service: string; serviceDescription: string; deliveryEstimate: string; totalPrice: string; currency: string }> };
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: async ({ carrier, service }: { carrier: string; service: string }) => {
      const { data } = await api.post(`/shipping/labels/${orderId}`, { carrier, service });
      return data;
    },
    onSuccess: () => {
      setShippingModalOpen(false);
      setSelectedRate(null);
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const cancelShipmentMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/shipping/cancel/${orderId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/orders/${orderId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.push('/orders');
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
            {(order.status === 'CONFIRMED_ODOO' || order.status === 'PENDING_PAYMENT') && (
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
            {(order.status === 'PAID' || order.status === 'SHIPPED') && (
              <Button
                variant="secondary"
                icon={<Truck className="h-4 w-4" />}
                onClick={() => setDeliverModalOpen(true)}
              >
                Registrar Entrega
              </Button>
            )}
            {order.status === 'PAID' && !order.shipment && (
              <Button
                variant="outline"
                icon={<Package className="h-4 w-4" />}
                onClick={() => { setShippingModalOpen(true); quoteRatesMutation.mutate(); }}
              >
                Cotizar Envío
              </Button>
            )}
            {order.status === 'SHIPPED' && order.shipment && (
              <Button
                variant="danger"
                icon={<X className="h-4 w-4" />}
                onClick={() => { if (confirm('¿Cancelar guía de envío?')) cancelShipmentMutation.mutate(); }}
                disabled={cancelShipmentMutation.isPending}
              >
                {cancelShipmentMutation.isPending ? 'Cancelando...' : 'Cancelar Guía'}
              </Button>
            )}
            {order.status === 'PENDING' && (
              <Button
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  if (confirm(`¿Eliminar pedido #${order.orderNumber}? Esta acción no se puede deshacer.`)) {
                    deleteOrderMutation.mutate();
                  }
                }}
                disabled={deleteOrderMutation.isPending}
              >
                {deleteOrderMutation.isPending ? 'Eliminando...' : 'Eliminar Pedido'}
              </Button>
            )}
            {deleteOrderMutation.isError && (
              <p className="text-xs text-status-danger">
                Error: {(deleteOrderMutation.error as any)?.response?.data?.message || 'No se pudo eliminar el pedido'}
              </p>
            )}
            {deliverMutation.isError && (
              <p className="text-xs text-status-danger">
                Error: {(deliverMutation.error as any)?.response?.data?.message || 'No se pudo registrar la entrega'}
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
              <p className="text-sm font-semibold text-white">
                {order.orderNumber || order.odooSaleOrderId || '-'}
              </p>
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

      {/* Shipping Info */}
      <Card padding={false}>
        <div className="flex items-center justify-between border-b border-glass-border px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Truck className="h-5 w-5 text-white/40" /> Envío
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<MapPin className="h-4 w-4" />}
              onClick={() => setChangeAddressOpen(true)}
            >
              Cambiar dirección
            </Button>
            {order.status === 'PAID' && !order.shipment && (
              <Button
                variant="primary"
                size="sm"
                icon={<Package className="h-4 w-4" />}
                onClick={() => { setShippingModalOpen(true); quoteRatesMutation.mutate(); }}
              >
                Cotizar Envío
              </Button>
            )}
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Shipping address */}
          <div>
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Dirección de entrega
            </p>
            {order.address ? (
              <div className="rounded-xl bg-glass-50 border border-glass-border p-4 space-y-1">
                {order.address.label && (
                  <p className="text-xs font-semibold text-accent-gold uppercase tracking-wider">{order.address.label}</p>
                )}
                <p className="text-sm text-white font-medium">{order.address.street}{order.address.detail ? `, ${order.address.detail}` : ''}</p>
                <p className="text-sm text-white/60">{order.address.city}{order.address.state ? `, ${order.address.state}` : ''}</p>
                {order.address.phone && (
                  <p className="text-xs text-white/40">Tel: {order.address.phoneCode || '+57'} {order.address.phone}</p>
                )}
                {order.address.notes && (
                  <p className="text-xs text-white/40 italic">{order.address.notes}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/40">Sin dirección de entrega asignada.</p>
            )}
          </div>

          {/* Shipment info */}
          {order.shipment ? (
            <div className="space-y-3 border-t border-glass-border pt-4">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Guía generada</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-white/40">Transportadora</p>
                  <p className="text-sm font-medium text-white capitalize">{order.shipment.carrier || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Servicio</p>
                  <p className="text-sm font-medium text-white">{order.shipment.service || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Guía</p>
                  <p className="text-sm font-medium text-white font-mono">{order.shipment.trackingNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Costo</p>
                  <p className="text-sm font-medium text-white">{order.shipment.totalPrice ? formatCurrency(order.shipment.totalPrice) : '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                {order.shipment.trackUrl && (
                  <a href={order.shipment.trackUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent-purple hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Rastrear envío
                  </a>
                )}
                {order.shipment.labelUrl && (
                  <a href={order.shipment.labelUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent-purple hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Ver guía PDF
                  </a>
                )}
              </div>
              {cancelShipmentMutation.isError && (
                <p className="text-xs text-status-danger">
                  Error: {(cancelShipmentMutation.error as any)?.response?.data?.message || 'No se pudo cancelar la guía'}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40 border-t border-glass-border pt-4">
              {order.status === 'PAID'
                ? 'Sin guía generada. Usa "Cotizar Envío" para generar una.'
                : 'Sin guía de envío.'}
            </p>
          )}
        </div>
      </Card>

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

      {/* Shipping Quote Modal */}
      <Modal
        open={shippingModalOpen}
        onClose={() => { setShippingModalOpen(false); setSelectedRate(null); quoteRatesMutation.reset(); }}
        title="Cotizar Envío — Envia.com"
        size="md"
      >
        <div className="space-y-4">
          {quoteRatesMutation.isPending && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
              <p className="text-sm text-white/50">Consultando tarifas...</p>
            </div>
          )}
          {quoteRatesMutation.isError && (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-4">
              <p className="text-sm text-status-danger">
                {(quoteRatesMutation.error as any)?.response?.data?.message || 'Error al consultar tarifas'}
              </p>
            </div>
          )}
          {quoteRatesMutation.data && (
            <>
              {quoteRatesMutation.data.rates.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/50">No hay tarifas disponibles para esta dirección.</p>
              ) : (
                <div className="space-y-2">
                  {quoteRatesMutation.data.rates.map((rate, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedRate(rate)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        selectedRate?.carrier === rate.carrier && selectedRate?.service === rate.service
                          ? 'border-accent-purple bg-accent-purple/10'
                          : 'border-glass-border bg-glass-50 hover:border-accent-purple/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold capitalize text-white">{rate.carrier}</p>
                          <p className="text-xs text-white/50">{rate.serviceDescription || rate.service}</p>
                          <p className="mt-0.5 text-xs text-white/30">Entrega: {rate.deliveryEstimate}</p>
                        </div>
                        <p className="text-lg font-bold text-accent-purple">{formatCurrency(Number(rate.totalPrice))}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedRate && (
                <div className="flex justify-end gap-3 border-t border-glass-border pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedRate(null)}
                    disabled={createLabelMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    icon={<Truck className="h-4 w-4" />}
                    onClick={() => createLabelMutation.mutate({ carrier: selectedRate.carrier, service: selectedRate.service })}
                    disabled={createLabelMutation.isPending}
                  >
                    {createLabelMutation.isPending ? 'Generando guía...' : `Generar Guía — ${formatCurrency(Number(selectedRate.totalPrice))}`}
                  </Button>
                </div>
              )}
              {createLabelMutation.isError && (
                <p className="text-right text-xs text-status-danger">
                  {(createLabelMutation.error as any)?.response?.data?.message || 'No se pudo generar la guía'}
                </p>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Change Address Modal */}
      <Modal
        open={changeAddressOpen}
        onClose={() => { setChangeAddressOpen(false); setSelectedAddressId(null); }}
        title="Cambiar Dirección de Entrega"
        size="md"
      >
        <div className="space-y-4">
          {!customerData ? (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
              <p className="text-sm text-white/50">Cargando direcciones...</p>
            </div>
          ) : !customerData.addresses?.length ? (
            <p className="py-6 text-center text-sm text-white/50">Este cliente no tiene direcciones guardadas.</p>
          ) : (
            <>
              <div className="space-y-2">
                {customerData.addresses.map((addr: any) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selectedAddressId === addr.id
                        ? 'border-accent-purple bg-accent-purple/10'
                        : order.address?.id === addr.id
                        ? 'border-accent-gold/40 bg-accent-gold/5'
                        : 'border-glass-border bg-glass-50 hover:border-accent-purple/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        {addr.label && <p className="text-xs font-semibold text-accent-gold uppercase tracking-wider">{addr.label}</p>}
                        <p className="text-sm font-medium text-white">{addr.street}{addr.detail ? `, ${addr.detail}` : ''}</p>
                        <p className="text-xs text-white/50">{addr.city}{addr.state ? `, ${addr.state}` : ''}</p>
                        {addr.phone && <p className="text-xs text-white/40">{addr.phoneCode || '+57'} {addr.phone}</p>}
                      </div>
                      {order.address?.id === addr.id && (
                        <span className="text-xs text-accent-gold whitespace-nowrap mt-0.5">Actual</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {updateAddressMutation.isError && (
                <p className="text-xs text-status-danger">
                  {(updateAddressMutation.error as any)?.response?.data?.message || 'No se pudo actualizar la dirección'}
                </p>
              )}
              <div className="flex justify-end gap-3 border-t border-glass-border pt-4">
                <Button variant="ghost" onClick={() => { setChangeAddressOpen(false); setSelectedAddressId(null); }} disabled={updateAddressMutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  icon={<MapPin className="h-4 w-4" />}
                  onClick={() => selectedAddressId && updateAddressMutation.mutate(selectedAddressId)}
                  disabled={!selectedAddressId || updateAddressMutation.isPending}
                >
                  {updateAddressMutation.isPending ? 'Guardando...' : 'Confirmar dirección'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Deliver Modal */}
      <Modal
        open={deliverModalOpen}
        onClose={() => { setDeliverModalOpen(false); setDeliveryNotes(''); }}
        title="Registrar Entrega en Persona"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Pedido <span className="font-semibold text-white">#{order.orderNumber || order.id?.slice(0, 8)}</span> se marcará como <span className="font-semibold text-status-success">ENTREGADO</span>.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              Anotación de entrega <span className="text-white/30">(opcional)</span>
            </label>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Ej: Entregado a Carlos Gómez en punto de encuentro acordado..."
              rows={3}
              className="w-full rounded-lg border border-glass-border bg-surface-base px-3 py-2 text-sm text-white placeholder-white/30 focus:border-accent-purple/50 focus:outline-none focus:ring-1 focus:ring-accent-purple/30 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setDeliverModalOpen(false); setDeliveryNotes(''); }}
              disabled={deliverMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon={<Truck className="h-4 w-4" />}
              onClick={() => deliverMutation.mutate(deliveryNotes)}
              disabled={deliverMutation.isPending}
            >
              {deliverMutation.isPending ? 'Guardando...' : 'Confirmar Entrega'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
