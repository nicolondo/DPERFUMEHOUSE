'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  User,
  CreditCard,
  FileText,
  Share2,
  Link2,
  Package,
  CheckCircle,
  XCircle,
  Truck,
  Pencil,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Badge, OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { PaymentLinkModal } from '@/components/ui/payment-link-modal';
import { DirectPaymentModal } from '@/components/payments';
import { PageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { useOrder, useProcessOrder, useUpdateOrderAddress } from '@/hooks/use-orders';
import { useCustomer } from '@/hooks/use-customers';
import { formatCurrency, formatDate, formatDateTime, getInitials, formatPhone } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

const STATUS_TIMELINE_CASH: {
  status: OrderStatus;
  label: string;
  icon: React.ElementType;
}[] = [
  { status: 'PAID', label: 'Pagado', icon: CheckCircle },
  { status: 'SHIPPED', label: 'Enviado', icon: Truck },
  { status: 'DELIVERED', label: 'Entregado', icon: CheckCircle },
];

const STATUS_TIMELINE_ONLINE: {
  status: OrderStatus;
  label: string;
  icon: React.ElementType;
}[] = [
  { status: 'PENDING_PAYMENT', label: 'Pago Pendiente', icon: CreditCard },
  { status: 'PAID', label: 'Pagado', icon: CheckCircle },
  { status: 'SHIPPED', label: 'Enviado', icon: Truck },
  { status: 'DELIVERED', label: 'Entregado', icon: CheckCircle },
];

const STATUS_ORDER_CASH: Record<string, number> = {
  PAID: 0,
  SHIPPED: 1,
  DELIVERED: 2,
  CANCELLED: -1,
};

const STATUS_ORDER_ONLINE: Record<string, number> = {
  DRAFT: -1,
  PENDING_PAYMENT: 0,
  PAID: 1,
  SHIPPED: 2,
  DELIVERED: 3,
  CANCELLED: -1,
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isPaymentLinkModalOpen, setIsPaymentLinkModalOpen] = useState(false);
  const [isDirectPayModalOpen, setIsDirectPayModalOpen] = useState(false);
  const { data: order, isLoading } = useOrder(id);
  const processOrder = useProcessOrder();
  const updateOrderAddress = useUpdateOrderAddress();
  const { data: customer } = useCustomer(order?.customerId);

  // useEffect MUST be before any conditional returns (React rules of hooks)
  useEffect(() => {
    if (order?.addressId) {
      setSelectedAddressId(order.addressId);
    }
  }, [order?.addressId]);

  const handleShare = async () => {
    if (!order?.paymentLink?.url) return;
    try {
      await navigator.share({
        title: `Pago Pedido #${order.orderNumber}`,
        text: `Link de pago para el pedido #${order.orderNumber}`,
        url: order.paymentLink.url,
      });
    } catch {
      // User cancelled or not supported, copy to clipboard instead
      await navigator.clipboard.writeText(order.paymentLink.url);
    }
  };

  const handleGeneratePaymentLink = async () => {
    if (!id) return;
    try {
      await processOrder.mutateAsync({
        id,
        action: 'process',
      });
      setIsPaymentLinkModalOpen(true);
    } catch {
      // Error handled by react-query
    }
  };

  const handleUpdateOrderAddress = async () => {
    if (!order?.id || !selectedAddressId) return;
    await updateOrderAddress.mutateAsync({ id: order.id, addressId: selectedAddressId });
    setIsAddressModalOpen(false);
  };

  if (isLoading) return <PageSpinner />;

  if (!order) {
    return (
      <div>
        <PageHeader title="Pedido" backHref="/orders" />
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Pedido no encontrado"
          description="Este pedido no existe o fue eliminado"
        />
      </div>
    );
  }

  const isCash = order.paymentMethod === 'CASH';
  const isPaid = order.paymentStatus === 'COMPLETED' || ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status.toUpperCase());
  const statusUpper = String(order.status || '').toUpperCase();
  const canEditAddress = !['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(statusUpper);
  const customerAddresses = customer?.addresses || [];
  const statusTimeline = isCash ? STATUS_TIMELINE_CASH : STATUS_TIMELINE_ONLINE;
  const statusOrder = isCash ? STATUS_ORDER_CASH : STATUS_ORDER_ONLINE;
  const currentStatusIndex = statusOrder[order.status.toUpperCase()] ?? -1;
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="pb-24">
      <PageHeader
        title={`#${order.orderNumber}`}
        backHref="/orders"
        action={<OrderStatusBadge status={order.status} />}
      />

      <div className="px-4 space-y-4">
        {/* Status Badge (large) */}
        <Card className="text-center">
          <div className="mb-2">
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-xs text-white/30">
            Creado {formatDateTime(order.createdAt)}
          </p>
          {order.updatedAt !== order.createdAt && (
            <p className="text-xs text-white/30">
              Actualizado {formatDateTime(order.updatedAt)}
            </p>
          )}
        </Card>

        {/* Status Timeline */}
        {!isCancelled && (
          <Card>
            <h3 className="text-sm font-semibold text-white mb-4">
              Estado del Pedido
            </h3>
            <div className="space-y-0">
              {statusTimeline.map((step, i) => {
                const stepIndex = statusOrder[step.status] ?? -1;
                const isCompleted = stepIndex <= currentStatusIndex;
                const isCurrent = step.status === order.status.toUpperCase();
                const Icon = step.icon;

                return (
                  <div key={step.status} className="flex gap-3">
                    {/* Vertical line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          isCurrent
                            ? 'bg-accent-purple text-white'
                            : isCompleted
                            ? 'bg-accent-purple-muted text-accent-purple'
                            : 'bg-glass-50 text-white/20'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {i < statusTimeline.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 min-h-[1.5rem] ${
                            isCompleted && stepIndex < currentStatusIndex
                              ? 'bg-accent-purple'
                              : 'bg-glass-border'
                          }`}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pb-4">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent
                            ? 'text-accent-purple'
                            : isCompleted
                            ? 'text-white'
                            : 'text-white/30'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Cancelled notice */}
        {isCancelled && (
          <Card className="border border-status-danger/30 bg-status-danger-muted">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-status-danger flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-status-danger">
                  Pedido Cancelado
                </p>
                <p className="text-xs text-status-danger/70">
                  Este pedido ha sido cancelado
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white">Cliente</span>
            </div>
          </CardHeader>
          <CardBody>
            {order.customer ? (
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => router.push(`/customers/${order.customerId}`)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-purple-muted text-sm font-bold text-accent-purple">
                  {getInitials(order.customer.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {order.customer.name}
                  </p>
                  <p className="text-xs text-white/50">
                    {formatPhone(order.customer.phone)}
                    {order.customer.email ? ` · ${order.customer.email}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/30">Informacion no disponible</p>
            )}
          </CardBody>
        </Card>

        {/* Delivery Address */}
        {order.address && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-white/30" />
                <span className="text-sm font-semibold text-white">
                  Direccion de Entrega
                </span>
              </div>
              {canEditAddress && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddressModalOpen(true)}
                  leftIcon={<Pencil className="h-4 w-4" />}
                >
                  Editar
                </Button>
              )}
            </CardHeader>
            <CardBody>
              <p className="text-sm font-medium text-white">
                {order.address.label}
              </p>
              <p className="text-sm text-white/70">{order.address.street}</p>
              <p className="text-xs text-white/30">
                {order.address.city}, {order.address.state}
              </p>
              {order.address.notes && (
                <p className="mt-1 text-xs text-white/30 italic">
                  {order.address.notes}
                </p>
              )}
              {!canEditAddress && (
                <p className="mt-2 text-xs text-white/40">
                  No se puede editar la direccion en este estado del pedido.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white">
                Productos ({order.items.length})
              </span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {order.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {item.variant?.name || item.productName || 'Producto'}
                    </p>
                    <p className="text-xs text-white/30">
                      {item.quantity} x{' '}
                      {formatCurrency(Number(item.unitPrice))}
                    </p>
                  </div>
                  <p className="pl-3 text-sm font-semibold text-white">
                    {formatCurrency(Number(item.total || item.totalPrice))}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Totals */}
        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Subtotal</span>
              <span className="text-white">
                {formatCurrency(Number(order.subtotal))}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">IVA (19%)</span>
              <span className="text-white">{formatCurrency(Number(order.tax))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Envio</span>
              <span className="text-white">
                {Number(order.shipping) === 0
                  ? 'Gratis'
                  : formatCurrency(Number(order.shipping))}
              </span>
            </div>
            <div className="border-t border-glass-border pt-2 flex items-center justify-between">
              <span className="text-base font-bold text-white">Total</span>
              <span className="text-lg font-bold text-accent-gold text-glow-gold">
                {formatCurrency(Number(order.total))}
              </span>
            </div>
          </div>
        </Card>

        {/* Payment Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white">Pago</span>
            </div>
            <PaymentStatusBadge status={order.paymentStatus} />
          </CardHeader>
          <CardBody>
            {isCash ? (
              <p className="text-sm text-white/50">Pago recibido en efectivo</p>
            ) : isPaid ? null : order.paymentLink?.url ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl bg-glass-50 p-3">
                  <Link2 className="h-4 w-4 text-white/30 flex-shrink-0" />
                  <p className="text-xs text-white/70 truncate flex-1">
                    {order.paymentLink.url}
                  </p>
                </div>
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => setIsPaymentLinkModalOpen(true)}
                  leftIcon={<Share2 className="h-4 w-4" />}
                >
                  Ver / Compartir Link de Pago
                </Button>
                <Button
                  fullWidth
                  onClick={() => setIsDirectPayModalOpen(true)}
                  leftIcon={<CreditCard className="h-4 w-4" />}
                >
                  Cobrar ahora
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  fullWidth
                  onClick={handleGeneratePaymentLink}
                  loading={processOrder.isPending}
                  leftIcon={<Link2 className="h-4 w-4" />}
                >
                  Generar Link de Pago
                </Button>
              </div>
            )}

            {order.paymentMethod && (
              <p className="mt-2 text-xs text-white/30">
                Metodo: {order.paymentMethod === 'CASH' ? 'Efectivo' : 'Tarjeta'}
              </p>
            )}
          </CardBody>
        </Card>

        {/* Shipping Info */}
        {order.shipment && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-white/30" />
                <span className="text-sm font-semibold text-white">Envío</span>
              </div>
              <Badge variant={
                order.shipment.status === 'DELIVERED' ? 'success' :
                order.shipment.status === 'CANCELLED' ? 'danger' :
                order.shipment.status === 'IN_TRANSIT' ? 'info' : 'warning'
              }>
                {order.shipment.status}
              </Badge>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Transportadora</span>
                  <span className="text-white capitalize">{order.shipment.carrier}</span>
                </div>
                {order.shipment.trackingNumber && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Guía</span>
                    <span className="text-white font-mono text-xs">{order.shipment.trackingNumber}</span>
                  </div>
                )}
                {order.shipment.trackUrl && (
                  <a
                    href={order.shipment.trackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-center text-sm text-accent-purple hover:underline"
                  >
                    Rastrear envío →
                  </a>
                )}
                {(order.shipment.events || []).length > 0 && (
                  <div className="mt-3 border-t border-glass-border pt-3 space-y-2">
                    {(order.shipment.events || []).slice(0, 5).map((evt: any, idx: number) => (
                      <div key={evt.id || idx} className="flex gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-purple-muted flex-shrink-0 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 text-accent-purple" />
                        </div>
                        <div>
                          <p className="text-xs text-white">{evt.description}</p>
                          <p className="text-xs text-white/30">
                            {evt.location && `${evt.location} · `}
                            {formatDateTime(evt.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Notes */}
        {order.notes && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-white/30" />
                <span className="text-sm font-semibold text-white">
                  Notas
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-white/70 whitespace-pre-wrap">
                {order.notes}
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title="Editar direccion de envio"
      >
        <div className="space-y-3">
          {customerAddresses.length === 0 ? (
            <p className="text-sm text-white/50">Este cliente no tiene direcciones registradas.</p>
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
                  <p className="text-sm font-medium text-white">{address.label || 'Direccion'}</p>
                  <p className="text-sm text-white/70">{address.street}</p>
                  <p className="text-xs text-white/40">{address.city}{address.state ? `, ${address.state}` : ''}</p>
                </div>
              </label>
            ))
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setIsAddressModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              fullWidth
              onClick={handleUpdateOrderAddress}
              loading={updateOrderAddress.isPending}
              disabled={!selectedAddressId || selectedAddressId === order?.addressId || customerAddresses.length === 0}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payment Link Modal */}
      {order.paymentLink?.url && (
        <PaymentLinkModal
          isOpen={isPaymentLinkModalOpen}
          onClose={() => setIsPaymentLinkModalOpen(false)}
          paymentUrl={order.paymentLink.url}
          orderNumber={order.orderNumber}
          total={Number(order.total)}
          customerName={order.customer?.name}
        />
      )}

      {/* Direct Payment Modal */}
      {!isCash && !isPaid && !isCancelled && (
        <DirectPaymentModal
          isOpen={isDirectPayModalOpen}
          onClose={() => setIsDirectPayModalOpen(false)}
          orderId={order.id}
          orderNumber={order.orderNumber}
          total={Number(order.total)}
          customerDocumentType={order.customer?.documentType}
          customerDocumentNumber={order.customer?.documentNumber}
          customerPhone={order.customer?.phone}
          onSuccess={() => { setIsDirectPayModalOpen(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
