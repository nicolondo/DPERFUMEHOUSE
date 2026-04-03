import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  CreatePaymentLinkData,
  PaymentLinkResult,
} from './payment.interface';
import * as crypto from 'crypto';

interface MyxSpendAuthResponse {
  token: string;
  apiKey: string;
  companyId: string;
}

@Injectable()
export class MyxSpendService implements PaymentProvider {
  private readonly logger = new Logger(MyxSpendService.name);
  private readonly baseUrl = 'https://api.myxspend.com/v1';
  private readonly email: string;
  private readonly password: string;

  private cachedAuth: MyxSpendAuthResponse | null = null;
  private authExpiresAt: number = 0;

  constructor(private readonly configService: ConfigService) {
    this.email = this.configService.get<string>('MYXSPEND_EMAIL', '');
    this.password = this.configService.get<string>('MYXSPEND_PASSWORD', '');

    if (!this.email || !this.password) {
      this.logger.warn('MyxSpend credentials not configured - payment integration will not work until configured');
    }
  }

  private async authenticate(): Promise<MyxSpendAuthResponse> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.cachedAuth && Date.now() < this.authExpiresAt - 300_000) {
      return this.cachedAuth;
    }

    this.logger.log('Authenticating with MyxSpend API...');

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.email,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`MyxSpend auth failed: ${response.status} - ${body}`);
      throw new Error(
        `MyxSpend authentication failed: ${response.status}`,
      );
    }

    const data = (await response.json()) as any;

    this.cachedAuth = {
      token: data.token,
      apiKey: data.apiKey || data['X-API-KEY'] || data.api_key,
      companyId: data.companyId || data['X-COMPANY-ID'] || data.company_id,
    };

    // Cache for 1 hour
    this.authExpiresAt = Date.now() + 3_600_000;

    this.logger.log('MyxSpend authentication successful');
    return this.cachedAuth;
  }

  private async makeAuthenticatedRequest(
    path: string,
    options: RequestInit,
    retry = true,
  ): Promise<Response> {
    const auth = await this.authenticate();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
      'X-API-KEY': auth.apiKey,
      'X-COMPANY-ID': auth.companyId,
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    // If 401 and we haven't retried, clear cache and retry
    if (response.status === 401 && retry) {
      this.logger.warn(
        'MyxSpend returned 401, re-authenticating...',
      );
      this.cachedAuth = null;
      this.authExpiresAt = 0;
      return this.makeAuthenticatedRequest(path, options, false);
    }

    return response;
  }

  async createPaymentLink(
    data: CreatePaymentLinkData,
  ): Promise<PaymentLinkResult> {
    this.logger.log(
      `Creating payment link for order ${data.orderId}, amount: ${data.amount} ${data.currency}`,
    );

    const payload = {
      firstName: data.customerFirstName,
      lastName: data.customerLastName,
      customerOrderId: data.orderId,
      email: data.customerEmail,
      amount: data.amount,
      currency: data.currency,
      phone: data.customerPhone || '',
      success_url: data.successUrl,
      failure_url: data.failureUrl,
    };

    const response = await this.makeAuthenticatedRequest(
      '/payment/process',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `MyxSpend payment creation failed: ${response.status} - ${body}`,
      );
      throw new Error(
        `MyxSpend payment creation failed: ${response.status}`,
      );
    }

    const result = (await response.json()) as any;

    this.logger.log(
      `Payment link created for order ${data.orderId}: ${result.PaymentLinkCode || result.paymentLinkCode}`,
    );

    return {
      externalId: result.PaymentLinkCode || result.paymentLinkCode || result.id,
      url: result.PaymentLink || result.paymentLink || result.url,
      code: result.PaymentLinkCode || result.paymentLinkCode || result.code,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<string> {
    const response = await this.makeAuthenticatedRequest(
      `/payment/status/${paymentId}`,
      { method: 'GET' },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `MyxSpend status check failed for ${paymentId}: ${response.status} - ${body}`,
      );
      throw new Error(
        `MyxSpend status check failed: ${response.status}`,
      );
    }

    const result = (await response.json()) as any;
    return result.status || result.Status || 'unknown';
  }

  verifyWebhookSignature(
    url: string,
    signature: string,
    apiKey: string,
  ): boolean {
    // HMAC-SHA256 of the full callback URL using the API key
    const expectedSignature = crypto
      .createHmac('sha256', apiKey)
      .update(url)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );

    if (!isValid) {
      this.logger.warn(
        'MyxSpend webhook signature verification failed',
      );
    }

    return isValid;
  }
}
