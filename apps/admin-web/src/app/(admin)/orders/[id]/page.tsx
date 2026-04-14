'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { fetchOrders, fetchSettings } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { PageSpinner } from '@/components/ui/spinner';
import { DataTable, Column } from '@/components/ui/data-table';
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '@/lib/utils';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Package, CreditCard, Clock, FileText, CheckCircle, Truck, MapPin, Printer, ExternalLink, RefreshCw } from 'lucide-react';

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

  // Shipping state
  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [selectedRate, setSelectedRate] = useState<{ carrier: string; service: string } | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);

  const quoteRatesMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/shipping/rates/${orderId}`);
      return data;
    },
    onSuccess: (data) => {
      setShippingRates(data.rates || []);
    },
  });

  const generateLabelMutation = useMutation({
    mutationFn: async ({ carrier, service }: { carrier: string; service: string }) => {
      const { data } = await api.post(`/shipping/labels/${orderId}`, { carrier, service });
      return data;
    },
    onSuccess: () => {
      setShippingRates([]);
      setSelectedRate(null);
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const trackMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get(`/shipping/track/${orderId}`);
      return data;
    },
    onSuccess: (data) => setTrackingData(data.tracking ?? null),
  });

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

  // Fetch order list for prev/next navigation
  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'nav'],
    queryFn: () => fetchOrders({ pageSize: 500 }),
    staleTime: 60_000,
  });
  const orderIds: string[] = (ordersData?.data || []).map((o: any) => o.id);
  const currentIndex = orderIds.indexOf(orderId);
  const prevId = currentIndex > 0 ? orderIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < orderIds.length - 1 ? orderIds[currentIndex + 1] : null;

  // Keyboard left/right arrow navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && prevId) router.push(`/orders/${prevId}`);
      if (e.key === 'ArrowRight' && nextId) router.push(`/orders/${nextId}`);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prevId, nextId, router]);

  // Fetch Odoo URL from settings
  const { data: odooSettings } = useQuery({
    queryKey: ['settings', 'odoo'],
    queryFn: () => fetchSettings('odoo'),
    staleTime: 300_000,
  });
  const odooUrl = (odooSettings as any[] | undefined)?.find((s: any) => s.key === 'odoo_url')?.value as string | undefined;

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
      <div className="flex items-center justify-between">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.back()}>
          Volver a Pedidos
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<ChevronLeft className="h-4 w-4" />}
            onClick={() => prevId && router.push(`/orders/${prevId}`)}
            disabled={!prevId}
            title="Pedido anterior (←)"
          >
            Anterior
          </Button>
          {currentIndex >= 0 && (
            <span className="text-xs text-white/40 px-1">{currentIndex + 1} / {orderIds.length}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => nextId && router.push(`/orders/${nextId}`)}
            disabled={!nextId}
            title="Pedido siguiente (→)"
          >
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

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
              {odooUrl && order.odooSaleOrderId ? (
                <a
                  href={`${odooUrl}/odoo/sales/${order.odooSaleOrderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-accent-purple hover:underline flex items-center gap-1"
                >
                  {order.orderNumber || order.odooSaleOrderId}
                  <ExternalLink className="h-3 w-3" />
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
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple-muted text-accent-purple">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-white/50">Dirección de Envío</p>
                <p className="text-sm font-semibold text-white">{order.address.street}</p>
                {order.address.detail && (
                  <p className="text-sm text-white/70">{order.address.detail}</p>
                )}
                <p className="text-sm text-white/70">
                  {order.address.city}{order.address.state ? `, ${order.address.state}` : ''}
                </p>
                {order.address.phone && (
                  <p className="text-xs text-white/50 mt-1">
                    Tel: {order.address.phoneCode || '+57'} {order.address.phone}
                  </p>
                )}
                {order.address.notes && (
                  <p className="text-xs text-white/40 mt-1 italic">{order.address.notes}</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => window.open(`/print/orders/${orderId}`, '_blank')}
            >
              Imprimir
            </Button>
          </div>
        </Card>
      )}

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
              {Number(order.discount) > 0 && (
                <div className="flex w-60 items-center justify-between text-sm">
                  <span className="text-green-400">Descuento</span>
                  <span className="text-green-400">- {formatCurrency(order.discount)}</span>
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

      {/* Shipping / Envia.com section */}
      {(order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
        <Card padding={false}>
          <div className="border-b border-glass-border px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Truck className="h-5 w-5 text-white/40" />
              Envío
            </h3>
            {order.status === 'PAID' && !order.shipment && (
              <Button
                variant="secondary"
                size="sm"
                icon={quoteRatesMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                onClick={() => quoteRatesMutation.mutate()}
                disabled={quoteRatesMutation.isPending}
              >
                {quoteRatesMutation.isPending ? 'Cotizando...' : 'Cotizar Envío'}
              </Button>
            )}
            {(order.status === 'SHIPPED' || order.shipment?.trackingNumber) && (
              <Button
                variant="secondary"
                size="sm"
                icon={trackMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                onClick={() => trackMutation.mutate()}
                disabled={trackMutation.isPending}
              >
                {trackMutation.isPending ? 'Rastreando...' : 'Rastrear Envío'}
              </Button>
            )}
          </div>
          <div className="p-6 space-y-4">
            {/* Existing shipment info */}
            {order.shipment && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-white/40">Transportadora</p>
                  <p className="text-sm font-semibold text-white">{order.shipment.carrier || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Servicio</p>
                  <p className="text-sm font-semibold text-white">{order.shipment.service || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Guía</p>
                  <p className="text-sm font-semibold text-white">{order.shipment.trackingNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Estado envío</p>
                  <p className="text-sm font-semibold text-white">{order.shipment.status || '-'}</p>
                </div>
                {order.shipment.totalPrice && (
                  <div>
                    <p className="text-xs text-white/40">Costo guía</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(order.shipment.totalPrice)}</p>
                  </div>
                )}
                {order.shipment.trackUrl && (
                  <div>
                    <p className="text-xs text-white/40">Rastreo</p>
                    <a href={order.shipment.trackUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-accent-purple hover:underline flex items-center gap-1">
                      Ver rastreo <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {order.shipment.labelUrl && (
                  <div>
                    <p className="text-xs text-white/40">Etiqueta</p>
                    <a href={order.shipment.labelUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-accent-purple hover:underline flex items-center gap-1">
                      Descargar guía <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Quote error */}
            {quoteRatesMutation.isError && (
              <div className="rounded-lg bg-status-danger-muted border border-status-danger/30 px-4 py-3 text-sm text-status-danger">
                {(quoteRatesMutation.error as any)?.response?.data?.message || 'Error al cotizar. Verifica la configuración de envíos.'}
              </div>
            )}

            {/* Rates list */}
            {shippingRates.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white/70">Seleccioná una opción de envío:</p>
                {shippingRates.map((rate: any, idx: number) => {
                  const key = `${rate.carrier}-${rate.service}`;
                  const isSelected = selectedRate?.carrier === rate.carrier && selectedRate?.service === rate.service;
                  return (
                    <button
                      key={key || idx}
                      onClick={() => setSelectedRate({ carrier: rate.carrier, service: rate.service })}
                      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-accent-purple bg-accent-purple-muted'
                          : 'border-glass-border bg-glass-50 hover:bg-glass-100'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{rate.carrier} — {rate.serviceDescription || rate.service}</p>
                        {rate.deliveryEstimate && (
                          <p className="text-xs text-white/50 mt-0.5">Entrega: {rate.deliveryEstimate}</p>
                        )}
                      </div>
                      <p className="text-base font-bold text-accent-purple whitespace-nowrap ml-4">
                        {formatCurrency(Number(rate.totalPrice))}
                      </p>
                    </button>
                  );
                })}
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => { setShippingRates([]); setSelectedRate(null); }}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={generateLabelMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                    onClick={() => selectedRate && generateLabelMutation.mutate(selectedRate)}
                    disabled={!selectedRate || generateLabelMutation.isPending}
                  >
                    {generateLabelMutation.isPending ? 'Generando guía...' : 'Generar Guía'}
                  </Button>
                </div>
                {generateLabelMutation.isError && (
                  <p className="text-xs text-status-danger">
                    {(generateLabelMutation.error as any)?.response?.data?.message || 'Error al generar la guía'}
                  </p>
                )}
              </div>
            )}

            {/* No shipment yet and no rates loaded */}
            {!order.shipment && shippingRates.length === 0 && !quoteRatesMutation.isPending && order.status === 'PAID' && (
              <p className="text-sm text-white/40 text-center py-2">Cotizá el envío para generar la guía con envia.com</p>
            )}

            {/* Tracking result */}
            {trackingData && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="info">{trackingData.status}</Badge>
                  {trackingData.estimatedDelivery && (
                    <span className="text-xs text-white/50">Entrega estimada: {trackingData.estimatedDelivery}</span>
                  )}
                  {trackingData.deliveredAt && (
                    <span className="text-xs text-status-success">Entregado: {formatDateTime(trackingData.deliveredAt)}</span>
                  )}
                </div>
                {(trackingData.events || trackingData.eventHistory || []).length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(trackingData.events || trackingData.eventHistory || []).map((ev: any, i: number) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <span className="text-white/30 whitespace-nowrap">{formatDateTime(ev.timestamp || ev.date)}</span>
                        <span className="text-white/60">{ev.location || ''}</span>
                        <span className="text-white/80">{ev.description || ev.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                {trackingData.trackUrl && (
                  <a href={trackingData.trackUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-accent-purple hover:underline flex items-center gap-1">
                    Ver rastreo oficial <ExternalLink className="h-3 w-3" />
                  </a>
                )}
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
              className="w-full rounded-lg border border-glass-border bg-glass-100 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-accent-purple/50 focus:outline-none focus:ring-1 focus:ring-accent-purple/30 resize-none"
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
