'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useEffect } from 'react';

async function fetchOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return data;
}

export default function PrintAddressPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });

  useEffect(() => {
    if (order && !isLoading) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [order, isLoading]);

  if (isLoading) return <div className="p-8 text-center">Cargando...</div>;
  if (error || !order) return <div className="p-8 text-center">Error al cargar pedido</div>;

  const addr = order.address;
  const customer = order.customer;

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: 5.5in 8.5in; margin: 0.5in; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition"
        >
          Imprimir
        </button>
        <button
          onClick={() => window.close()}
          className="ml-2 rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 transition"
        >
          Cerrar
        </button>
      </div>

      <div
        className="mx-auto bg-white text-black"
        style={{ width: '5.5in', minHeight: '8.5in', padding: '0.6in', fontFamily: 'system-ui, sans-serif' }}
      >
        {/* Header */}
        <div style={{ borderBottom: '2px solid #333', paddingBottom: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>D PERFUME HOUSE</h1>
              <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0' }}>Etiqueta de Envío</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                Pedido #{order.orderNumber || orderId.slice(0, 8)}
              </p>
              <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>
                {new Date(order.createdAt).toLocaleDateString('es-CO', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* DESTINATARIO */}
        <div style={{ border: '2px solid #333', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#888', letterSpacing: '1px', margin: '0 0 8px' }}>
            Destinatario
          </p>
          <p style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
            {order.customerName || customer?.name || '-'}
          </p>

          {addr ? (
            <>
              <p style={{ fontSize: '16px', margin: '0 0 4px' }}>{addr.street}</p>
              {addr.detail && (
                <p style={{ fontSize: '14px', color: '#444', margin: '0 0 4px' }}>{addr.detail}</p>
              )}
              <p style={{ fontSize: '16px', fontWeight: 600, margin: '8px 0 4px' }}>
                {addr.city}{addr.state ? `, ${addr.state}` : ''}
              </p>
              {addr.zip && (
                <p style={{ fontSize: '14px', color: '#444', margin: '0 0 4px' }}>CP: {addr.zip}</p>
              )}
              <div style={{ borderTop: '1px solid #ddd', marginTop: '12px', paddingTop: '12px' }}>
                <p style={{ fontSize: '14px', margin: '0' }}>
                  <strong>Tel:</strong> {addr.phoneCode || '+57'} {addr.phone || customer?.phone || '-'}
                </p>
                {(customer?.email || order.customerEmail) && (
                  <p style={{ fontSize: '13px', color: '#444', margin: '4px 0 0' }}>
                    {customer?.email || order.customerEmail}
                  </p>
                )}
              </div>
              {addr.notes && (
                <div style={{ borderTop: '1px solid #ddd', marginTop: '12px', paddingTop: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#888', letterSpacing: '1px', margin: '0 0 4px' }}>
                    Notas
                  </p>
                  <p style={{ fontSize: '13px', fontStyle: 'italic', margin: 0 }}>{addr.notes}</p>
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: '14px', color: '#999' }}>Sin dirección registrada</p>
          )}
        </div>

        {/* Productos */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#888', letterSpacing: '1px', margin: '0 0 8px' }}>
            Contenido del Paquete
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Producto</th>
                <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>Cant.</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || order.orderItems || []).map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px 0' }}>{item.productName || item.variant?.name || '-'}</td>
                  <td style={{ textAlign: 'center', padding: '6px 8px' }}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ccc', paddingTop: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>
            D Perfume House · dperfumehouse.com
          </p>
        </div>
      </div>
    </>
  );
}
