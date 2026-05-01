import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';

export interface WompiBank {
  id: string; // UUID
  name: string;
  code?: string;
}

export interface WompiAccount {
  id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
}

export interface WompiBatchTransaction {
  legalIdType: 'CC' | 'NIT' | 'CE' | 'PP';
  legalId: string;
  bankId: string;
  accountType: 'AHORROS' | 'CORRIENTE';
  accountNumber: string;
  name: string;
  email: string;
  amount: number; // in cents
  reference: string;
}

export interface WompiCreateBatchPayload {
  reference: string;
  accountId: string;
  paymentType: 'PAYROLL' | 'PROVIDERS' | 'OTHER';
  transactions: WompiBatchTransaction[];
}

export interface WompiCreateBatchResponse {
  id?: string;
  status?: string;
  reference?: string;
  transactions?: Array<{ id?: string; reference?: string; status?: string }>;
  [key: string]: any;
}

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);
  private banksCache: { items: WompiBank[]; expiresAt: number } | null = null;
  private accountIdCache: string | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getConfig() {
    const [baseUrl, apiKey, principalUserId] = await Promise.all([
      this.settings.get('wompi_payout_base_url'),
      this.settings.get('wompi_payout_api_key'),
      this.settings.get('wompi_payout_principal_user_id'),
    ]);
    if (!baseUrl || !apiKey || !principalUserId) {
      throw new BadRequestException(
        'Wompi no está configurado (faltan: base_url, api_key, principal_user_id)',
      );
    }
    return { baseUrl, apiKey, principalUserId };
  }

  private async request<T = any>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const { baseUrl, apiKey, principalUserId } = await this.getConfig();
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'user-principal-id': principalUserId,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    this.logger.log(`Wompi ${method} ${path}`);
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      this.logger.error(`Wompi ${method} ${path} → ${res.status}: ${text}`);
      throw new BadRequestException({
        message: `Wompi API error (${res.status})`,
        wompi: data,
      });
    }

    return data as T;
  }

  /** Fetch and cache the list of banks (24h TTL). */
  async getBanks(force = false): Promise<WompiBank[]> {
    const now = Date.now();
    if (!force && this.banksCache && this.banksCache.expiresAt > now) {
      return this.banksCache.items;
    }
    const data = await this.request<any>('GET', '/banks');
    const items: WompiBank[] = Array.isArray(data) ? data : data?.data ?? [];
    this.banksCache = { items, expiresAt: now + 24 * 60 * 60 * 1000 };
    this.logger.log(`Wompi banks cached: ${items.length}`);
    return items;
  }

  /** Get the configured origin accountId, auto-discovering from /accounts on first use. */
  async getAccountId(): Promise<string> {
    if (this.accountIdCache) return this.accountIdCache;
    const stored = await this.settings.get('wompi_payout_account_id');
    if (stored && stored.trim()) {
      this.accountIdCache = stored.trim();
      return this.accountIdCache;
    }
    const data = await this.request<any>('GET', '/accounts');
    const items: WompiAccount[] = Array.isArray(data) ? data : data?.data ?? [];
    if (items.length === 0) {
      throw new BadRequestException(
        'Wompi: no hay cuentas origen disponibles para pagos a terceros.',
      );
    }
    const id = items[0].id;
    await this.prisma.appSetting.update({
      where: { key: 'wompi_payout_account_id' },
      data: { value: id },
    });
    this.accountIdCache = id;
    this.logger.log(`Wompi accountId auto-discovered: ${id}`);
    return id;
  }

  /** Normalize a bank name string for fuzzy matching. */
  private normalize(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /** Map a free-form bank name to a Wompi bankId. Returns null if no confident match. */
  async resolveBankId(bankName: string | null | undefined): Promise<string | null> {
    if (!bankName || !bankName.trim()) return null;
    const banks = await this.getBanks();
    const target = this.normalize(bankName);

    // 1) exact normalized match
    const exact = banks.find((b) => this.normalize(b.name) === target);
    if (exact) return exact.id;

    // 2) target token list contained in candidate (or vice versa)
    const targetTokens = target.split(' ').filter((t) => t.length >= 3);
    let best: { bank: WompiBank; score: number } | null = null;
    for (const b of banks) {
      const cand = this.normalize(b.name);
      let score = 0;
      for (const tk of targetTokens) {
        if (cand.includes(tk)) score += tk.length;
      }
      if (cand.includes(target) || target.includes(cand)) {
        score += Math.min(cand.length, target.length);
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { bank: b, score };
      }
    }
    return best && best.score >= 5 ? best.bank.id : null;
  }

  async createBatch(
    payload: WompiCreateBatchPayload,
    idempotencyKey: string,
  ): Promise<WompiCreateBatchResponse> {
    return this.request<WompiCreateBatchResponse>(
      'POST',
      '/payouts',
      payload,
      { 'idempotency-key': idempotencyKey },
    );
  }

  async getBatch(batchId: string): Promise<any> {
    return this.request<any>('GET', `/payouts/${batchId}`);
  }

  /** Verify the HMAC signature of a Wompi event. */
  async verifyEventSignature(rawBody: string, signature: string): Promise<boolean> {
    const secret = await this.settings.get('wompi_payout_events_secret');
    if (!secret) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
