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
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [order, isLoading]);

  if (isLoading) return <div style={{ padding: 32, textAlign: 'center', fontFamily: 'sans-serif' }}>Cargando...</div>;
  if (error || !order) return <div style={{ padding: 32, textAlign: 'center', fontFamily: 'sans-serif' }}>Error al cargar pedido</div>;

  const addr = order.address;
  const customer = order.customer;
  const orderDate = new Date(order.createdAt).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; font-family: 'Helvetica Neue', Arial, sans-serif; }

        @media screen {
          body { background: #888; display: flex; justify-content: center; align-items: flex-start; padding: 32px; min-height: 100vh; }
          .page { background: white; width: 8.5in; min-height: 11in; position: relative; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
        }

        @media print {
          body { background: white; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { size: letter portrait; margin: 0; }
          .page { width: 8.5in; height: 11in; position: relative; overflow: hidden; }
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

        /* The label: rotated 90deg, positioned top-right of the page */
        .label-wrapper {
          position: absolute;
          top: 1in;
          right: 0.75in;
          /* Label dimensions when rotated: width becomes height and vice versa */
          /* Original (before rotate): width=3.8in height=5in */
          transform: rotate(90deg);
          transform-origin: top right;
          /* After 90deg rotation, the element's top-right corner stays anchored */
        }

        .label {
          width: 3.8in;
          border: 1.5px solid #333;
          border-radius: 6px;
          overflow: hidden;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background: white;
        }

        .label-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px 12px;
          border-bottom: 1px solid #bbb;
          background: #f9f9f9;
        }
        .label-header-brand {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #111;
          line-height: 1.2;
        }
        .label-header-sub {
          font-size: 9px;
          color: #666;
          font-weight: 400;
          margin-top: 1px;
        }
        .label-header-order {
          text-align: right;
        }
        .label-header-num {
          font-size: 10px;
          font-weight: 700;
          color: #222;
        }
        .label-header-date {
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }

        .label-body {
          padding: 10px 12px;
        }
        .label-section-title {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #888;
          margin-bottom: 6px;
        }
        .label-name {
          font-size: 18px;
          font-weight: 800;
          color: #111;
          line-height: 1.15;
          margin-bottom: 8px;
        }
        .label-addr-line {
          font-size: 11px;
          color: #222;
          line-height: 1.55;
        }
        .label-addr-city {
          font-size: 12px;
          font-weight: 700;
          color: #111;
          margin-top: 5px;
          margin-bottom: 5px;
        }
        .label-divider {
          border: none;
          border-top: 1px solid #ddd;
          margin: 8px 0;
        }
        .label-contact-line {
          font-size: 10px;
          color: #444;
          line-height: 1.55;
        }
        .label-notes {
          font-size: 10px;
          color: #555;
          font-style: italic;
          margin-top: 4px;
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print">
        <button className="btn btn-print" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn-close" onClick={() => window.close()}>Cerrar</button>
      </div>

      {/* Letter page */}
      <div className="page">
        <div className="label-wrapper">
          <div className="label">
            {/* Header */}
            <div className="label-header">
              <div>
                <div className="label-header-brand">D PERFUME HOUSE</div>
                <div className="label-header-sub">Etiqueta de Envío</div>
              </div>
              <div className="label-header-order">
                <div className="label-header-num">Pedido #{order.orderNumber || orderId.slice(0, 8)}</div>
                <div className="label-header-date">{orderDate}</div>
              </div>
            </div>

            {/* Body */}
            <div className="label-body">
              <div className="label-section-title">Destinatario</div>
              <div className="label-name">
                {order.customerName || customer?.name || '-'}
              </div>

              {addr ? (
                <>
                  <div className="label-addr-line">{addr.street}</div>
                  {addr.detail && (
                    <div className="label-addr-line">{addr.detail}</div>
                  )}
                  {addr.notes && (
                    <div className="label-notes">{addr.notes}</div>
                  )}
                  <div className="label-addr-city">
                    {addr.city}{addr.state ? `, ${addr.state}` : ''}
                  </div>
                  <hr className="label-divider" />
                  <div className="label-contact-line">
                    Tel: {addr.phoneCode || '+57'} {addr.phone || customer?.phone || '-'}
                  </div>
                  {(customer?.email || order.customerEmail) && (
                    <div className="label-contact-line">
                      {customer?.email || order.customerEmail}
                    </div>
                  )}
                </>
              ) : (
                <div className="label-addr-line" style={{ color: '#999' }}>Sin dirección registrada</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
