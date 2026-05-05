import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentLinkData,
  PaymentLinkResult,
} from './payment.interface';
import { SettingsService } from '../settings/settings.service';

interface MonabitCreateResponse {
  result: 'success' | 'failure';
  data?: {
    collection_id: string;
    payment_url: string;
  };
  message?: string;
}

interface MonabitStatusResponse {
  result: 'success' | 'failure';
  data?: {
    collection_id: string;
    status: string;
    amount?: number;
    currency?: string;
    complete_timestamp?: number;
  };
  message?: string;
}

@Injectable()
export class MonabitService implements PaymentProvider {
  private readonly logger = new Logger(MonabitService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getEnvironment(): Promise<'sandbox' | 'production'> {
    const env = await this.settingsService.get('monabit_environment');
    return env === 'production' ? 'production' : 'sandbox';
  }

  private async getBaseUrl(): Promise<string> {
    const env = await this.getEnvironment();
    return env === 'production'
      ? 'https://api.monabit.io'
      : 'https://testing-api.monabit.io';
  }

  private async getApiKey(): Promise<string> {
    const env = await this.getEnvironment();
    const key =
      env === 'production'
        ? await this.settingsService.get('monabit_api_key_prod')
        : await this.settingsService.get('monabit_api_key_test');
    if (!key) {
      throw new Error(`Monabit API key (${env}) not configured`);
    }
    return key;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const apiKey = await this.getApiKey();
    const url = `${baseUrl}${path}`;

    this.logger.log(`Monabit request POST ${path}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      this.logger.error(`Monabit ${path} non-JSON response: ${text.slice(0, 300)}`);
      throw new Error(`Monabit ${path} returned non-JSON response`);
    }

    if (!response.ok || json.result === 'failure') {
      const msg = json?.message || json?.error || text;
      this.logger.error(`Monabit ${path} error ${response.status}: ${msg}`);
      throw new Error(`Monabit ${path}: ${msg}`);
    }

    return json as T;
  }

  async createPaymentLink(
    data: CreatePaymentLinkData,
  ): Promise<PaymentLinkResult> {
    this.logger.log(
      `Creating Monabit collection for order ${data.orderId}, amount: ${data.amount} ${data.currency}`,
    );

    const body: Record<string, unknown> = {
      amount: data.amount,
      currency: data.currency || 'COP',
      description: `Order ${data.orderId}`,
      redirect_url: data.successUrl,
    };
    if (data.customerEmail) body.client_email = data.customerEmail;
    if (data.customerFirstName) body.first_name = data.customerFirstName;
    if (data.customerLastName) body.last_name = data.customerLastName;
    if (data.customerPhone) body.client_phone = data.customerPhone;
    if (data.customerDocumentNumber) body.client_identification = data.customerDocumentNumber;
    if (data.customerAddress) body.client_address = data.customerAddress;

    const result = await this.request<MonabitCreateResponse>(
      '/v1/collections/create',
      body,
    );

    if (!result.data?.collection_id || !result.data?.payment_url) {
      throw new Error('Monabit response missing collection_id or payment_url');
    }

    this.logger.log(
      `Monabit collection created for order ${data.orderId}: ${result.data.collection_id}`,
    );

    // Append customer data as query params to pre-fill the hosted checkout form
    let checkoutUrl = result.data.payment_url;
    try {
      const url = new URL(checkoutUrl);
      if (data.customerFirstName) url.searchParams.set('first_name', data.customerFirstName);
      if (data.customerLastName) url.searchParams.set('last_name', data.customerLastName);
      if (data.customerEmail) url.searchParams.set('email', data.customerEmail);
      if (data.customerPhone) url.searchParams.set('phone', data.customerPhone);
      if (data.customerDocumentNumber) url.searchParams.set('identification', data.customerDocumentNumber);
      if (data.customerAddress) url.searchParams.set('address', data.customerAddress);
      checkoutUrl = url.toString();
    } catch {
      // If URL parsing fails, use original URL
    }

    return {
      externalId: result.data.collection_id,
      url: checkoutUrl,
      code: result.data.collection_id,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    const result = await this.request<MonabitStatusResponse>(
      '/v1/collections/get-status',
      { collection_id: paymentId },
    );
    return result.data?.status || 'unknown';
  }

  /**
   * Monabit webhook signature verification.
   * The public Monabit docs do not document a signature mechanism — webhooks
   * arrive as plain JSON. This method satisfies the PaymentProvider interface
   * but is a no-op; identification is done by collection_id.
   */
  verifyWebhookSignature(
    _url: string,
    _signature: string,
    _apiKey: string,
  ): boolean {
    return true;
  }
}
