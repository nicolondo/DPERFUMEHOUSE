import { notFound } from 'next/navigation';

interface OrderItem {
  quantity: number;
  unitPrice: string;
  total: string;
  variant: {
    name: string;
    price: string;
    images?: Array<{ url: string; thumbnailUrl?: string; isPrimary?: boolean }>;
  };
}

interface OrderPublicData {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  tax: string;
  shipping: string;
  total: string;
  customer: { name: string };
  seller: { name: string; phone: string };
  paymentLink: { url: string; status: string } | null;
  items: OrderItem[];
}

async function getOrder(orderNumber: string): Promise<OrderPublicData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/api/orders/public/number/${encodeURIComponent(orderNumber)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const fmt = (n: string | number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(n));

export default async function PayPage({ params }: { params: { orderNumber: string } }) {
  const order = await getOrder(params.orderNumber);

  if (!order) notFound();

  const isPaid = order.paymentStatus === 'PAID' || order.status === 'CONFIRMED';
  const hasActiveLink = order.paymentLink?.url && order.paymentLink.status === 'ACTIVE';
  const orderNum = order.orderNumber.replace(/^PH-/, '');

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#0a0703', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 0 48px' },
    wrap: { maxWidth: 480, margin: '0 auto', padding: '0 20px' },
    logo: { display: 'block', margin: '0 auto 28px', width: 160 },
    card: { background: '#16110a', borderRadius: 20, border: '1px solid #2e1f0e', overflow: 'hidden' },
    cardHead: { padding: '20px 24px 16px', borderBottom: '1px solid #2e1f0e' },
    label: { fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#6b4f35', margin: '0 0 4px' },
    orderNum: { fontSize: 20, fontWeight: 700, color: '#fff7eb', margin: 0 },
    customerName: { fontSize: 14, color: '#9c8568', margin: '4px 0 0' },
    itemsList: { listStyle: 'none', margin: 0, padding: '12px 0' },
    item: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px' },
    thumb: { width: 48, height: 48, borderRadius: 10, objectFit: 'cover' as const, background: '#1e160d', flexShrink: 0 },
    thumbPlaceholder: { width: 48, height: 48, borderRadius: 10, background: '#1e160d', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
    itemInfo: { flex: 1, minWidth: 0 },
    itemName: { fontSize: 13, fontWeight: 600, color: '#fff7eb', margin: '0 0 2px', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
    itemQty: { fontSize: 12, color: '#6b4f35', margin: 0 },
    itemPrice: { fontSize: 14, fontWeight: 700, color: '#bfa685', flexShrink: 0 },
    totals: { borderTop: '1px solid #2e1f0e', padding: '16px 24px' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    rowLabel: { fontSize: 13, color: '#6b4f35' },
    rowValue: { fontSize: 13, color: '#9c8568' },
    totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #2e1f0e' },
    totalLabel: { fontSize: 15, fontWeight: 700, color: '#fff7eb' },
    totalValue: { fontSize: 22, fontWeight: 800, color: '#c9a96e' },
    actions: { padding: '20px 24px 0' },
    btnPay: { display: 'block', width: '100%', background: 'linear-gradient(135deg, #c9a96e 0%, #a07840 100%)', color: '#0a0703', padding: '16px 24px', borderRadius: 14, fontWeight: 800, fontSize: 16, textDecoration: 'none', textAlign: 'center' as const, boxSizing: 'border-box' as const, letterSpacing: 0.3 },
    btnWa: { display: 'block', width: '100%', background: '#25d366', color: '#fff', padding: '13px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, textDecoration: 'none', textAlign: 'center' as const, boxSizing: 'border-box' as const },
    expired: { padding: '0 24px 20px', textAlign: 'center' as const },
    expiredText: { fontSize: 13, color: '#6b4f35', margin: '0 0 16px' },
    successIcon: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 },
    successTitle: { fontSize: 22, fontWeight: 700, color: '#fff7eb', margin: '0 0 8px', textAlign: 'center' as const },
    successSub: { fontSize: 14, color: '#9c8568', margin: 0, textAlign: 'center' as const },
  };

  // — Already paid —
  if (isPaid) {
    return (
      <div style={s.page}>
        <div style={s.wrap}>
          <img src="https://pos.dperfumehouse.com/icons/logo-email.png" alt="D Perfume House" style={s.logo} />
          <div style={{ ...s.card, padding: '40px 24px', textAlign: 'center' }}>
            <div style={s.successIcon}>✅</div>
            <h1 style={s.successTitle}>¡Pago recibido!</h1>
            <p style={s.successSub}>
              El pedido <strong style={{ color: '#c9a96e' }}>#{orderNum}</strong> fue pagado exitosamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const shipping = Number(order.shipping);

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <img src="https://pos.dperfumehouse.com/icons/logo-email.png" alt="D Perfume House" style={s.logo} />

        <div style={s.card}>
          {/* Header */}
          <div style={s.cardHead}>
            <p style={s.label}>Tu pedido</p>
            <p style={s.orderNum}>#{orderNum}</p>
            {order.customer?.name && (
              <p style={s.customerName}>Para {order.customer.name}</p>
            )}
          </div>

          {/* Items */}
          <ul style={s.itemsList}>
            {order.items.map((item, i) => {
              const img = item.variant.images?.find(x => x.isPrimary) ?? item.variant.images?.[0];
              return (
                <li key={i} style={s.item}>
                  {img?.thumbnailUrl || img?.url ? (
                    <img src={img.thumbnailUrl ?? img.url} alt={item.variant.name} style={s.thumb} />
                  ) : (
                    <div style={s.thumbPlaceholder}>🌸</div>
                  )}
                  <div style={s.itemInfo}>
                    <p style={s.itemName}>{item.variant.name}</p>
                    <p style={s.itemQty}>Cantidad: {item.quantity}</p>
                  </div>
                  <span style={s.itemPrice}>{fmt(item.unitPrice)}</span>
                </li>
              );
            })}
          </ul>

          {/* Totals */}
          <div style={s.totals}>
            <div style={s.row}>
              <span style={s.rowLabel}>Subtotal</span>
              <span style={s.rowValue}>{fmt(order.subtotal)}</span>
            </div>
            {shipping > 0 && (
              <div style={s.row}>
                <span style={s.rowLabel}>Envío</span>
                <span style={s.rowValue}>{fmt(order.shipping)}</span>
              </div>
            )}
            <div style={s.totalRow}>
              <span style={s.totalLabel}>Total</span>
              <span style={s.totalValue}>{fmt(order.total)}</span>
            </div>
          </div>

          {/* CTA */}
          <div style={s.actions}>
            {hasActiveLink ? (
              <a href={order.paymentLink!.url} style={s.btnPay}>
                Pagar ahora →
              </a>
            ) : (
              <div style={s.expired}>
                <p style={s.expiredText}>
                  El link de pago ya no está disponible.<br />Contacta a tu vendedor para solicitar uno nuevo.
                </p>
              </div>
            )}
          </div>

          {/* WhatsApp */}
          {order.seller?.phone && (
            <div style={{ padding: hasActiveLink ? '12px 24px 20px' : '0 24px 20px' }}>
              <a
                href={`https://wa.me/${order.seller.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, tengo una consulta sobre mi pedido #${orderNum}`)}`}
                style={s.btnWa}
              >
                💬 Contactar al vendedor
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
