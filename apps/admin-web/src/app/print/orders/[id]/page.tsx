'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useEffect } from 'react';

async function fetchOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return data;
}

export default function PrintOrderPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });

  useEffect(() => {
    if (order && !isLoading) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [order, isLoading]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Cargando pedido...
      </div>
    );
  }
  if (error || !order) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#f00' }}>
        Error al cargar el pedido.
      </div>
    );
  }

  const addr = order.address;
  const customer = order.customer;
  const items: any[] = order.items ?? [];
  const orderDate = new Date(order.createdAt).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Combine detail and notes on a single line
  const addrLine2 = [addr?.detail, addr?.notes].filter(Boolean).join(' , ');

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; font-family: 'Helvetica Neue', Arial, sans-serif; }

        @media screen {
          body { background: #888; display: flex; justify-content: center; align-items: flex-start; padding: 32px; min-height: 100vh; }
          .page { background: white; width: 11in; min-height: 8.5in; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
        }

        @media print {
          body { background: white; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { size: letter landscape; margin: 0; }
          .page { width: 11in; min-height: 8.5in; }
        }

        .page-content {
          width: 5in;
          padding: 0.6in 0.7in;
        }

        .no-print {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 100;
          display: flex;
          gap: 8px;
        }
        .btn {
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .btn-print { background: #92400e; color: white; }
        .btn-print:hover { background: #78350f; }
        .btn-close { background: #374151; color: white; }
        .btn-close:hover { background: #1f2937; }

        /* Header */
        .lbl-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 8px;
          border-bottom: 1.5px solid #222;
          margin-bottom: 14px;
        }
        .lbl-brand {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.4px;
          color: #111;
          line-height: 1.2;
        }
        .lbl-brand-sub {
          font-size: 8.5px;
          color: #666;
          font-weight: 400;
          margin-top: 2px;
        }
        .lbl-order-info { text-align: right; }
        .lbl-order-num { font-size: 10px; font-weight: 700; color: #222; }
        .lbl-order-date { font-size: 9px; color: #666; margin-top: 2px; }

        /* Recipient box */
        .lbl-recipient-box {
          border: 1.5px solid #333;
          border-radius: 6px;
          padding: 12px 14px;
          margin-bottom: 20px;
        }
        .lbl-section-title {
          font-size: 7.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.4px;
          color: #999;
          margin-bottom: 6px;
        }
        .lbl-name {
          font-size: 17px;
          font-weight: 800;
          color: #111;
          line-height: 1.2;
          margin-bottom: 8px;
        }
        .lbl-addr-line { font-size: 11px; color: #222; line-height: 1.6; }
        .lbl-addr-city { font-size: 12px; font-weight: 700; color: #111; margin-top: 5px; margin-bottom: 5px; }
        .lbl-divider { border: none; border-top: 1px solid #ddd; margin: 8px 0; }
        .lbl-contact-line { font-size: 10px; color: #444; line-height: 1.6; }

        /* Products table */
        .lbl-products-title {
          font-size: 7.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.4px;
          color: #999;
          margin-bottom: 8px;
        }
        .lbl-table { width: 100%; border-collapse: collapse; }
        .lbl-table th {
          font-size: 9px; font-weight: 700; color: #333;
          text-align: left; border-bottom: 1px solid #ccc;
          padding-bottom: 4px; padding-right: 8px;
        }
        .lbl-table th:last-child { text-align: right; padding-right: 0; }
        .lbl-table td {
          font-size: 10px; color: #222;
          padding: 4px 8px 4px 0;
          border-bottom: 1px solid #eee;
          vertical-align: middle;
        }
        .lbl-table td:last-child { text-align: right; padding-right: 0; }
        .lbl-table tr:last-child td { border-bottom: none; }

        /* Footer */
        .lbl-footer {
          margin-top: 20px;
          text-align: center;
          font-size: 8px;
          color: #bbb;
          border-top: 1px solid #eee;
          padding-top: 8px;
        }
      `}</style>

      <div className="no-print">
        <button className="btn btn-print" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn-close" onClick={() => window.close()}>Cerrar</button>
      </div>

      <div className="page">
        <div className="page-content">
        {/* Header */}
        <div className="lbl-header">
          <div>
            <div className="lbl-brand">D PERFUME HOUSE</div>
            <div className="lbl-brand-sub">Etiqueta de Envío</div>
          </div>
          <div className="lbl-order-info">
            <div className="lbl-order-num">Pedido #{order.orderNumber || orderId.slice(0, 8)}</div>
            <div className="lbl-order-date">{orderDate}</div>
          </div>
        </div>

        {/* Recipient box */}
        <div className="lbl-recipient-box">
          <div className="lbl-section-title">Destinatario</div>
          <div className="lbl-name">{order.customerName || customer?.name || '-'}</div>

          {addr ? (
            <>
              <div className="lbl-addr-line">{addr.street}</div>
              {addrLine2 && <div className="lbl-addr-line">{addrLine2}</div>}
              <div className="lbl-addr-city">
                {addr.city}{addr.state ? `, ${addr.state}` : ''}
              </div>
              <hr className="lbl-divider" />
              <div className="lbl-contact-line">
                Tel: {addr.phoneCode || '+57'} {addr.phone || customer?.phone || '-'}
              </div>
              {(customer?.email || order.customerEmail) && (
                <div className="lbl-contact-line">{customer?.email || order.customerEmail}</div>
              )}
            </>
          ) : (
            <div className="lbl-addr-line" style={{ color: '#999' }}>Sin dirección registrada</div>
          )}
        </div>

        {/* Products */}
        {items.length > 0 && (
          <>
            <div className="lbl-products-title">Contenido del Paquete</div>
            <table className="lbl-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td>{item.variant?.name || item.productName || '-'}</td>
                    <td>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Footer */}
        <div className="lbl-footer">D Perfume House · dperfumehouse.com</div>
        </div>
      </div>
    </>
  );
}
