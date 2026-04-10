import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentLinkData,
  PaymentLinkResult,
} from './payment.interface';
import { SettingsService } from '../settings/settings.service';
import * as crypto from 'crypto';

@Injectable()
export class WompiService implements PaymentProvider {
  private readonly logger = new Logger(WompiService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getBaseUrl(): Promise<string> {
    const env = await this.settingsService.get('wompi_environment');
    return env === 'production'
      ? 'https://production.wompi.co/v1'
      : 'https://sandbox.wompi.co/v1';
  }

  async getPublicKey(): Promise<string> {
    const key = await this.settingsService.get('wompi_public_key');
    if (!key) {
      throw new Error('Wompi public key not configured');
    }
    return key;
  }

  private async getPrivateKey(): Promise<string> {
    const key = await this.settingsService.get('wompi_private_key');
    if (!key) {
      throw new Error('Wompi private key not configured');
    }
    return key;
  }

  private async getIntegritySecret(): Promise<string> {
    const secret = await this.settingsService.get('wompi_integrity_secret');
    if (!secret) {
      throw new Error('Wompi integrity secret not configured');
    }
    return secret;
  }

  /**
   * Generate SHA256 integrity signature for Wompi.
   * Format: SHA256(reference + amountInCents + currency + integritySecret)
   */
  generateIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string,
    integritySecret: string,
  ): string {
    const payload = `${reference}${amountInCents}${currency}${integritySecret}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async createPaymentLink(
    data: CreatePaymentLinkData,
  ): Promise<PaymentLinkResult> {
    this.logger.log(
      `Creating Wompi checkout URL for order ${data.orderId}, amount: ${data.amount} ${data.currency}`,
    );

    const publicKey = await this.getPublicKey();
    const integritySecret = await this.getIntegritySecret();

    // Wompi expects amount in centavos (multiply by 100)
    const amountInCents = Math.round(data.amount * 100);
    const currency = 'COP';
    // Use orderId as the unique reference
    const reference = data.orderId;

    // Generate integrity signature: SHA256(reference + amountInCents + currency + integritySecret)
    const signature = this.generateIntegritySignature(
      reference,
      amountInCents,
      currency,
      integritySecret,
    );

    // Build Wompi Web Checkout URL with all required params
    const params = new URLSearchParams();
    params.set('public-key', publicKey);
    params.set('currency', currency);
    params.set('amount-in-cents', amountInCents.toString());
    params.set('reference', reference);
    params.set('signature:integrity', signature);
    params.set('redirect-url', data.successUrl);
    // Optional: pre-fill customer data
    if (data.customerEmail) {
      params.set('customer-data:email', data.customerEmail);
    }
    const fullName = `${data.customerFirstName} ${data.customerLastName}`.trim();
    if (fullName) {
      params.set('customer-data:full-name', fullName);
    }
    if (data.customerPhone) {
      params.set('customer-data:phone-number', data.customerPhone);
      params.set('customer-data:phone-number-prefix', '+57');
    }

    const checkoutUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

    this.logger.log(
      `Wompi checkout URL created for order ${data.orderId}`,
    );

    return {
      externalId: reference,
      url: checkoutUrl,
      code: reference,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();

    // Try as transaction first
    const response = await fetch(
      `${baseUrl}/transactions/${paymentId}`,
      { method: 'GET' },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Wompi status check failed for ${paymentId}: ${response.status} - ${body}`,
      );
      throw new Error(
        `Wompi status check failed: ${response.status}`,
      );
    }

    const result = (await response.json()) as any;
    return result.data?.status || 'unknown';
  }

  /**
   * Verify Wompi webhook signature.
   * Wompi concatenates the values of signature.properties from the event data
   * + timestamp + events_secret, then SHA256 hashes it.
   *
   * NOTE: This method satisfies the PaymentProvider interface but is not used
   * directly. Use verifyEventChecksum() for actual Wompi webhook verification.
   */
  verifyWebhookSignature(
    _url: string,
    _signature: string,
    _apiKey: string,
  ): boolean {
    // Not used for Wompi - see verifyEventChecksum
    return false;
  }

  /**
   * Verify a Wompi event webhook checksum.
   * @param eventBody The full webhook request body from Wompi
   * @param eventsSecret The events secret from settings
   */
  verifyEventChecksum(
    eventBody: WompiWebhookEvent,
    eventsSecret: string,
  ): boolean {
    try {
      const { signature, timestamp } = eventBody;
      if (!signature || !signature.properties || !signature.checksum) {
        this.logger.error('Wompi webhook missing signature data');
        return false;
      }

      // Build the concatenated string from signature.properties
      // Properties are dot-path references into eventBody.data, e.g. "transaction.id"
      const values = signature.properties.map((propPath: string) => {
        const parts = propPath.split('.');
        let value: any = eventBody.data;
        for (const part of parts) {
          value = value?.[part];
        }
        return value;
      });

      const concatenated = values.join('') + timestamp + eventsSecret;
      const hash = crypto
        .createHash('sha256')
        .update(concatenated)
        .digest('hex');

      const isValid = hash === signature.checksum;

      if (!isValid) {
        this.logger.warn(
          `Wompi webhook checksum mismatch. Expected: ${signature.checksum}, Got: ${hash}`,
        );
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying Wompi webhook checksum', error);
      return false;
    }
  }

  /**
   * Convenience async method that resolves the integrity secret from settings.
   */
  async generateSignature(
    reference: string,
    amountInCents: number,
    currency: string,
  ): Promise<string> {
    const integritySecret = await this.getIntegritySecret();
    return this.generateIntegritySignature(
      reference,
      amountInCents,
      currency,
      integritySecret,
    );
  }

  /**
   * Fetch the merchant acceptance token + permalink from Wompi.
   */
  async getAcceptanceToken(): Promise<{
    acceptanceToken: string;
    permalink: string;
  }> {
    const baseUrl = await this.getBaseUrl();
    const publicKey = await this.getPublicKey();

    const res = await fetch(`${baseUrl}/merchants/${publicKey}`);

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Wompi merchant fetch failed: ${res.status} - ${body}`,
      );
      throw new Error('Failed to fetch Wompi merchant data');
    }

    const data = (await res.json()) as any;
    const presigned = data?.data?.presigned_acceptance;

    return {
      acceptanceToken: presigned?.acceptance_token || '',
      permalink: presigned?.permalink || '',
    };
  }

  /**
   * Fetch financial institutions (banks) for PSE.
   */
  async getPseBanks(): Promise<any[]> {
    const baseUrl = await this.getBaseUrl();
    const publicKey = await this.getPublicKey();

    const res = await fetch(
      `${baseUrl}/pse/financial_institutions`,
      {
        headers: { Authorization: `Bearer ${publicKey}` },
      },
    );

    if (!res.ok) {
      this.logger.error(`Wompi PSE banks fetch failed: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as any;
    return data?.data || [];
  }

  /**
   * Create a direct transaction via the Wompi API.
   */
  async createTransaction(payload: {
    amountInCents: number;
    currency: string;
    reference: string;
    customerEmail: string;
    acceptanceToken: string;
    signature: string;
    paymentMethod: Record<string, any>;
    redirectUrl?: string;
  }): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const privateKey = await this.getPrivateKey();

    const body = {
      amount_in_cents: payload.amountInCents,
      currency: payload.currency,
      reference: payload.reference,
      customer_email: payload.customerEmail,
      acceptance_token: payload.acceptanceToken,
      signature: payload.signature,
      payment_method: payload.paymentMethod,
      ...(payload.redirectUrl
        ? { redirect_url: payload.redirectUrl }
        : {}),
    };

    const res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${privateKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      this.logger.error(
        `Wompi transaction failed: ${res.status} - ${JSON.stringify(data)}`,
      );
      throw new Error(
        data?.error?.message ||
          data?.error?.reason ||
          'Wompi transaction failed',
      );
    }

    return data?.data || data;
  }

  /**
   * Get full transaction data by Wompi transaction ID.
   */
  async getTransactionStatus(
    transactionId: string,
  ): Promise<{ id: string; status: string; [key: string]: any }> {
    const baseUrl = await this.getBaseUrl();

    const res = await fetch(
      `${baseUrl}/transactions/${transactionId}`,
    );

    if (!res.ok) {
      this.logger.error(
        `Wompi transaction status failed: ${res.status}`,
      );
      throw new Error('Failed to fetch transaction status');
    }

    const data = (await res.json()) as any;
    return data?.data || data;
  }
}

export interface WompiWebhookEvent {
  event: string; // e.g. "transaction.updated"
  data: {
    transaction: {
      id: string;
      status: string; // APPROVED, DECLINED, VOIDED, ERROR
      amount_in_cents: number;
      reference: string;
      currency: string;
      payment_link_id?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  environment: string;
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
}
