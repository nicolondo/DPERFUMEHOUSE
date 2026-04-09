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

  private async getPrivateKey(): Promise<string> {
    const key = await this.settingsService.get('wompi_private_key');
    if (!key) {
      throw new Error('Wompi private key not configured');
    }
    return key;
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

    const payload = {
      name: `Orden ${data.orderId.substring(0, 8)}`,
      description: `Pago D Perfume House - ${data.customerFirstName} ${data.customerLastName}`,
      single_use: false,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: amountInCents,
      redirect_url: data.successUrl,
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
