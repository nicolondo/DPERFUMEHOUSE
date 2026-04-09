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

  // In-memory cache for acceptance token (valid ~1 day, refresh every 30min)
  private acceptanceTokenCache: { token: string; permalink: string; expiresAt: number } | null = null;
  // In-memory cache for PSE financial institutions (refresh every 1h)
  private pseBanksCache: { data: WompiFinancialInstitution[]; expiresAt: number } | null = null;

  constructor(private readonly settingsService: SettingsService) {}

  private async getBaseUrl(): Promise<string> {
    const env = await this.settingsService.get('wompi_environment');
    return env === 'production'
      ? 'https://production.wompi.co/v1'
      : 'https://sandbox.wompi.co/v1';
  }

  private async getPrivateKey(): Promise<string> {
    const key = await this.settingsService.get('wompi_private_key');
    if (!key) {
      throw new Error('Wompi private key not configured');
    }
    return key;
  }

  private async generatePaymentLinkIntegritySignature(
    amountInCents: number,
    currency: string,
  ): Promise<string> {
    const integritySecret = await this.getIntegritySecret();
    const concatenated = `${amountInCents}${currency}${integritySecret}`;
    return crypto.createHash('sha256').update(concatenated).digest('hex');
  }

  async createPaymentLink(
    data: CreatePaymentLinkData,
  ): Promise<PaymentLinkResult> {
    this.logger.log(
      `Creating Wompi payment link for order ${data.orderId}, amount: ${data.amount} ${data.currency}`,
    );

    const baseUrl = await this.getBaseUrl();
    const privateKey = await this.getPrivateKey();

    // Wompi expects amount in centavos (multiply by 100)
    const amountInCents = Math.round(data.amount * 100);
    const integritySignature = await this.generatePaymentLinkIntegritySignature(
      amountInCents,
      'COP',
    );

    const payload = {
      name: `Orden ${data.orderId.substring(0, 8)}`,
      description: `Pago D Perfume House - ${data.customerFirstName} ${data.customerLastName}`,
      single_use: false,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: amountInCents,
      redirect_url: data.successUrl,
      signature: {
        integrity: integritySignature,
      },
      // Store orderId in sku field for webhook reference
      sku: data.orderId,
    };

    const response = await fetch(`${baseUrl}/payment_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${privateKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Wompi payment link creation failed: ${response.status} - ${body}`,
      );
      throw new Error(
        `Wompi payment link creation failed: ${response.status}`,
      );
    }

    const result = (await response.json()) as any;
    const linkData = result.data;
    const linkId = linkData.id;

    this.logger.log(
      `Wompi payment link created for order ${data.orderId}: ${linkId}`,
    );

    return {
      externalId: linkId,
      url: `https://checkout.wompi.co/l/${linkId}`,
      code: linkId,
    };
  }

  async getPublicKey(): Promise<string> {
    const key = await this.settingsService.get('wompi_public_key');
    if (!key) {
      throw new Error('Wompi public key not configured');
    }
    return key;
  }

  async getIntegritySecret(): Promise<string> {
    const secret = await this.settingsService.get('wompi_integrity_secret');
    if (!secret) {
      throw new Error('Wompi integrity secret not configured');
    }
    return secret;
  }

  /**
   * Generate SHA256 integrity signature for Wompi widget/checkout.
   * Concatenation order: reference + amountInCents + currency + integritySecret
   */
  async generateIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string,
  ): Promise<string> {
    const integritySecret = await this.getIntegritySecret();
    const concatenated = `${reference}${amountInCents}${currency}${integritySecret}`;
    return crypto.createHash('sha256').update(concatenated).digest('hex');
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
   * Fetch a fresh Wompi acceptance token required for direct transactions.
   * NOT cached — Wompi acceptance tokens are single-use.
   */
  async getAcceptanceToken(): Promise<{ token: string; permalink: string }> {
    const baseUrl = await this.getBaseUrl();
    const publicKey = await this.getPublicKey();

    const response = await fetch(`${baseUrl}/merchants/${publicKey}`);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Wompi merchant fetch failed: ${response.status} - ${body}`);
    }

    const result = (await response.json()) as any;
    const token: string = result.data?.presigned_acceptance?.acceptance_token;
    const permalink: string = result.data?.presigned_acceptance?.permalink;

    if (!token) {
      throw new Error('Wompi acceptance token not found in merchant response');
    }

    this.logger.debug('Wompi acceptance token fetched (fresh)');
    return { token, permalink };
  }

  /**
   * Fetch PSE financial institutions list from Wompi.
   * Cached in-memory for 1 hour.
   */
  async getFinancialInstitutions(): Promise<WompiFinancialInstitution[]> {
    const now = Date.now();
    if (this.pseBanksCache && this.pseBanksCache.expiresAt > now) {
      return this.pseBanksCache.data;
    }

    const baseUrl = await this.getBaseUrl();
    const publicKey = await this.getPublicKey();

    const response = await fetch(`${baseUrl}/pse/financial_institutions`, {
      headers: { Authorization: `Bearer ${publicKey}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Wompi PSE banks fetch failed: ${response.status} - ${body}`);
    }

    const result = (await response.json()) as any;
    const data: WompiFinancialInstitution[] = result.data || [];
    this.pseBanksCache = { data, expiresAt: now + 60 * 60 * 1000 };
    this.logger.debug(`Wompi PSE banks refreshed: ${data.length} institutions`);
    return data;
  }

  /**
   * Create a direct Wompi transaction (bypasses widget).
   * acceptance_token must be obtained from getAcceptanceToken() and included.
   */
  async createTransaction(payload: WompiTransactionPayload): Promise<WompiTransactionResult> {
    const baseUrl = await this.getBaseUrl();
    const privateKey = await this.getPrivateKey();

    const response = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${privateKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as any;

    if (!response.ok) {
      this.logger.error(
        `Wompi transaction creation failed: ${response.status} - ${JSON.stringify(result)}`,
      );
      throw new Error(result?.error?.messages
        ? Object.values(result.error.messages).flat().join(', ')
        : `Wompi transaction failed: ${response.status}`,
      );
    }

    return result.data as WompiTransactionResult;
  }

  /**
   * Get a Wompi transaction by its ID.
   */
  async getTransactionById(transactionId: string): Promise<WompiTransactionResult> {
    const baseUrl = await this.getBaseUrl();
    const privateKey = await this.getPrivateKey();

    const response = await fetch(`${baseUrl}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Wompi get transaction failed: ${response.status} - ${body}`);
    }

    const result = (await response.json()) as any;
    return result.data as WompiTransactionResult;
  }
}

export interface WompiFinancialInstitution {
  financial_institution_code: string;
  financial_institution_name: string;
}

export interface WompiTransactionPayload {
  amount_in_cents: number;
  currency: string;
  customer_email: string;
  reference: string;
  acceptance_token: string;
  signature: string;
  payment_method: Record<string, any>;
  customer_data?: Record<string, any>;
  shipping_address?: Record<string, any>;
  redirect_url?: string;
}

export interface WompiTransactionResult {
  id: string;
  status: string; // PENDING, APPROVED, DECLINED, VOIDED, ERROR
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type: string;
  payment_method?: Record<string, any>;
  redirect_url?: string;
  async_payment_url?: string;
  [key: string]: any;
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
