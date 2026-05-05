export interface PaymentProvider {
  createPaymentLink(data: CreatePaymentLinkData): Promise<PaymentLinkResult>;
  getPaymentStatus(paymentId: string): Promise<string>;
  verifyWebhookSignature(
    url: string,
    signature: string,
    apiKey: string,
  ): boolean;
}

export interface CreatePaymentLinkData {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  customerDocumentNumber?: string;
  customerAddress?: string;
  successUrl: string;
  failureUrl: string;
}

export interface PaymentLinkResult {
  externalId: string;
  url: string;
  code: string;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
