'use client';

import { useState } from 'react';
import { Link2, Copy, CheckCircle, Share2, MessageCircle, Mail } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface PaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentUrl: string;
  orderNumber: string;
  total: number;
  customerName?: string;
}

export function PaymentLinkModal({
  isOpen,
  onClose,
  paymentUrl,
  orderNumber,
  total,
  customerName,
}: PaymentLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsappMessage = encodeURIComponent(
    `Hola${customerName ? ` ${customerName}` : ''}! Aqui esta tu link de pago para el pedido #${orderNumber} por $${total.toLocaleString('es-CO')}:\n\n${paymentUrl}`,
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `Pago Pedido #${orderNumber}`,
        text: `Link de pago para el pedido #${orderNumber} por $${total.toLocaleString('es-CO')}`,
        url: paymentUrl,
      });
    } catch {
      // User cancelled
    }
  };

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString('es-CO')}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link de Pago">
      <div className="space-y-5">
        {/* Order summary */}
        <div className="rounded-xl bg-glass-50 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/50">Pedido</span>
            <span className="text-sm font-semibold text-white">#{orderNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/50">Total</span>
            <span className="text-sm font-semibold text-accent-gold">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment link */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
            Link de pago
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-glass-border bg-glass-50 p-3">
            <Link2 className="h-4 w-4 text-accent-purple flex-shrink-0" />
            <p className="text-sm text-white/80 truncate flex-1 select-all">
              {paymentUrl}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            fullWidth
            variant="secondary"
            onClick={handleCopy}
            leftIcon={
              copied
                ? <CheckCircle className="h-4 w-4 text-status-success" />
                : <Copy className="h-4 w-4" />
            }
          >
            {copied ? 'Link Copiado!' : 'Copiar Link'}
          </Button>

          <Button
            fullWidth
            variant="primary"
            onClick={() => window.open(whatsappUrl, '_blank')}
            leftIcon={<MessageCircle className="h-4 w-4" />}
            className="!bg-[#25D366] hover:!bg-[#20BD5A]"
          >
            Enviar por WhatsApp
          </Button>

          {'share' in navigator && (
            <Button
              fullWidth
              variant="outline"
              onClick={handleNativeShare}
              leftIcon={<Share2 className="h-4 w-4" />}
            >
              Compartir por otra app
            </Button>
          )}
        </div>

        {/* Email confirmation */}
        <div className="flex items-center gap-2 rounded-xl bg-status-success-muted/30 p-3">
          <Mail className="h-4 w-4 text-status-success flex-shrink-0" />
          <p className="text-xs text-status-success">
            Se envio un correo al cliente con el link de pago.
          </p>
        </div>
      </div>
    </Modal>
  );
}
