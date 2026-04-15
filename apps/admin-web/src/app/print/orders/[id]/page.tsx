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
  const orderDate = new Date(order.createdAt).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          background: #777;
          font-family: 'Helvetica Neue', Arial, sans-serif;
        }

        @media screen {
          .page-wrap {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 40px 20px;
            min-height: 100vh;
            background: #777;
          }
          .page {
            background: white;
            width: 11in;
            min-height: 8.5in;
            position: relative;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          }
        }

        @media print {
          html, body { background: white; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .page-wrap { padding: 0; background: white; }
          @page { size: letter landscape; margin: 0; }
          .page { width: 11in; min-height: 8.5in; background: white; box-shadow: none; }
        }

        /* Screen controls */
        .no-print {
          position: fixed;
          top: 12px;
          right: 12px;
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
        .btn-print { background: #7c5c1b; color: white; }
        .btn-print:hover { background: #5c3f10; }
        .btn-close { background: #374151; color: white; }
        .btn-close:hover { background: #1f2937; }

        /* Content area — upper-left of the landscape page */
        .content-area {
          padding: 0.65in 0.75in;
          width: 5.5in;
        }

        /* Header: brand left, order info right */
        .label-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
        }
        .brand-name {
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 1.5px;
          color: #111;
          line-height: 1.1;
          text-transform: uppercase;
        }
        .brand-sub {
          font-size: 9px;
          color: #888;
          font-weight: 400;
          margin-top: 3px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .order-info {
          text-align: right;
        }
        .order-num {
          font-size: 11px;
          font-weight: 700;
          color: #222;
        }
        .order-date {
          font-size: 10px;
          color: #777;
          margin-top: 3px;
        }

        /* Horizontal rule separator */
        .header-divider {
          border: none;
          border-top: 1.5px solid #ccc;
          margin: 10px 0 16px;
        }

        /* Recipient box */
        .recipient-box {
          border: 1.5px solid #333;
          border-radius: 10px;
          padding: 18px 20px;
        }

        .to-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #aaa;
          margin-bottom: 8px;
        }

        .recipient-name {
          font-size: 22px;
          font-weight: 900;
          color: #111;
          line-height: 1.15;
          margin-bottom: 10px;
        }

        .addr-line {
          font-size: 13px;
          color: #333;
          line-height: 1.65;
        }
        .addr-city {
          font-size: 14px;
          font-weight: 700;
          color: #111;
          margin-top: 4px;
          margin-bottom: 10px;
        }
        .divider {
          border: none;
          border-top: 1px solid #ddd;
          margin: 10px 0;
        }
        .contact-line {
          font-size: 11px;
          color: #555;
          line-height: 1.8;
        }
        .notes-text {
          font-size: 11px;
          color: #777;
          font-style: italic;
          margin-top: 6px;
        }
      `}</style>

      {/* Controls */}
      <div className="no-print">
        <button className="btn btn-print" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn-close" onClick={() => window.close()}>Cerrar</button>
      </div>

      {/* Page */}
      <div className="page-wrap">
        <div className="page">
          <div className="content-area">
            {/* Header */}
            <div className="label-header">
              <div>
                <div className="brand-name">D Perfume House</div>
                <div className="brand-sub">Etiqueta de Envío</div>
              </div>
              <div className="order-info">
                <div className="order-num">Pedido #{order.orderNumber || orderId.slice(0, 8).toUpperCase()}</div>
                <div className="order-date">{orderDate}</div>
              </div>
            </div>

            <hr className="header-divider" />

            {/* Recipient box */}
            <div className="recipient-box">
              <div className="to-label">Destinatario</div>
              <div className="recipient-name">
                {order.customerName || customer?.name || '—'}
              </div>

              {addr ? (
                <>
                  <div className="addr-line">{addr.street}</div>
                  {addr.detail && <div className="addr-line">{addr.detail}</div>}
                  {addr.notes && <div className="addr-line">{addr.notes}</div>}
                  <div className="addr-city">
                    {addr.city}{addr.state ? `, ${addr.state}` : ''}
                  </div>
                  <hr className="divider" />
                  <div className="contact-line">
                    <strong>Tel:</strong> {addr.phoneCode || '+57'} {addr.phone || customer?.phone || '—'}
                  </div>
                  {(customer?.email || order.customerEmail) && (
                    <div className="contact-line">{customer?.email || order.customerEmail}</div>
                  )}
                </>
              ) : (
                <div className="addr-line" style={{ color: '#bbb' }}>Sin dirección registrada</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
