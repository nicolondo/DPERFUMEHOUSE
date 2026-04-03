import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

interface EnviaAddress {
  name: string;
  phone: string;
  email?: string;
  identification_type?: string;
  identification_number?: string;
  street: string;
  number: string;
  street2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

interface EnviaPackage {
  type: string;
  content: string;
  amount: number;
  declaredValue: number;
  lengthUnit: string;
  weightUnit: string;
  weight: number;
  dimensions: { length: number; width: number; height: number };
}

export interface EnviaRateRequest {
  origin: EnviaAddress;
  destination: EnviaAddress;
  packages: EnviaPackage[];
  shipment: { type: number; carrier: string };
}

export interface EnviaRateResult {
  carrier: string;
  service: string;
  serviceDescription: string;
  deliveryEstimate: string;
  totalPrice: string;
  currency: string;
}

export interface EnviaGenerateRequest {
  origin: EnviaAddress;
  destination: EnviaAddress;
  packages: EnviaPackage[];
  shipment: { type: number; carrier: string; service: string };
  settings?: { currency: string; printFormat?: string; printSize?: string; comments?: string };
}

export interface EnviaGenerateResult {
  carrier: string;
  service: string;
  shipmentId: number;
  trackingNumber: string;
  trackUrl: string;
  label: string;
  totalPrice: number;
  currency: string;
}

export interface EnviaTrackResult {
  trackingNumber: string;
  status: string;
  carrier: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  signedBy?: string;
  trackUrl?: string;
  trackUrlSite?: string;
  events?: Array<{
    timestamp: string;
    location: string;
    description: string;
  }>;
  eventHistory?: Array<{
    event: string;
    description: string;
    location: string;
    date: string;
  }>;
}

export interface EnviaPickupRequest {
  origin: EnviaAddress;
  shipment: {
    type: number;
    carrier: string;
    pickup: {
      weightUnit: string;
      totalWeight: number;
      totalPackages: number;
      date: string;
      timeFrom: number;
      timeTo: number;
      carrier: string;
      trackingNumbers: string[];
      instructions?: string;
    };
  };
}

export interface EnviaPickupResult {
  carrier: string;
  confirmation: string;
  status: string;
  date: string;
  timeFrom: number;
  timeTo: number;
}

export interface EnviaCancelResult {
  carrier: string;
  trackingNumber: string;
  balanceReturned: boolean;
}

@Injectable()
export class EnviaService {
  private readonly logger = new Logger(EnviaService.name);
  private readonly envBaseUrl: string;
  private readonly envQueriesUrl: string;
  private readonly envApiKey: string;

  constructor(
    private configService: ConfigService,
    private settings: SettingsService,
  ) {
    this.envApiKey = this.configService.get<string>('ENVIA_API_KEY', '');
    this.envBaseUrl = this.configService.get<string>('ENVIA_BASE_URL', 'https://api.envia.com');
    this.envQueriesUrl = this.configService.get<string>('ENVIA_QUERIES_URL', 'https://queries.envia.com');
  }

  private async getApiKey(): Promise<string> {
    const dbKey = await this.settings.get('envia_api_key');
    return dbKey || this.envApiKey;
  }

  private async getBaseUrl(): Promise<string> {
    const dbUrl = await this.settings.get('envia_base_url');
    return dbUrl || this.envBaseUrl;
  }

  private async getQueriesUrl(): Promise<string> {
    const dbUrl = await this.settings.get('envia_queries_url');
    return dbUrl || this.envQueriesUrl;
  }

  private async request<T>(url: string, method: string, body?: unknown): Promise<T> {
    const apiKey = await this.getApiKey();
    this.logger.log(`Request ${method} ${url} — key: ...${apiKey.slice(-8)}`);
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      this.logger.error(`Envia API non-JSON response (${response.status}): ${text.substring(0, 200)}`);
      throw new Error(`Envia API error: ${response.status} - ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
      this.logger.error(`Envia API error: ${response.status} ${JSON.stringify(data)}`);
      throw new Error(`Envia API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    return data as T;
  }

  async getRates(req: EnviaRateRequest): Promise<{ meta: string; data: EnviaRateResult[] }> {
    this.logger.log(`Quoting rates for carrier: ${req.shipment.carrier}`);
    const baseUrl = await this.getBaseUrl();
    return this.request(`${baseUrl}/ship/rate/`, 'POST', req);
  }

  async generateLabel(req: EnviaGenerateRequest): Promise<{ meta: string; data: EnviaGenerateResult[] }> {
    this.logger.log(`Generating label: ${req.shipment.carrier} / ${req.shipment.service}`);
    const baseUrl = await this.getBaseUrl();
    return this.request(`${baseUrl}/ship/generate/`, 'POST', req);
  }

  async trackShipment(trackingNumbers: string[]): Promise<{ meta: string; data: EnviaTrackResult[] }> {
    this.logger.log(`Tracking: ${trackingNumbers.join(', ')}`);
    const baseUrl = await this.getBaseUrl();
    return this.request(`${baseUrl}/ship/generaltrack/`, 'POST', { trackingNumbers });
  }

  async schedulePickup(req: EnviaPickupRequest): Promise<{ meta: string; data: EnviaPickupResult }> {
    this.logger.log(`Scheduling pickup for ${req.shipment.carrier}`);
    const baseUrl = await this.getBaseUrl();
    return this.request(`${baseUrl}/ship/pickup/`, 'POST', req);
  }

  async cancelShipment(carrier: string, trackingNumber: string): Promise<{ meta: string; data: EnviaCancelResult }> {
    this.logger.log(`Cancelling shipment: ${trackingNumber}`);
    const baseUrl = await this.getBaseUrl();
    return this.request(`${baseUrl}/ship/cancel/`, 'POST', { carrier, trackingNumber });
  }

  async listCarriers(country: string = 'CO'): Promise<unknown> {
    const queriesUrl = await this.getQueriesUrl();
    return this.request(`${queriesUrl}/available-carriers/${country}`, 'GET');
  }

  async locateCity(country: string, city: string, hintState?: string): Promise<{ city: string; state: string; zipcode: string; cityCode?: string } | null> {
    try {
      const results = await this.request<Array<{
        country: { name: string; code: string };
        state: { name: string; code: { '1digit': string | null; '2digit': string | null; '3digit': string | null } };
        zip_codes: Array<{ zip_code: string; locality: string; info: { stat: string; stat_8digit: string } }>;
      }>>(
        `https://geocodes.envia.com/locate/${encodeURIComponent(country)}/${encodeURIComponent(city)}`,
        'GET',
      );

      if (!Array.isArray(results) || results.length === 0) return null;

      // Pick the best match — prefer result matching hintState if provided
      let match = results[0];
      if (hintState && results.length > 1) {
        const hint = hintState.toLowerCase().trim();
        const stateMatch = results.find(r => {
          const name = r.state?.name?.toLowerCase() || '';
          const c2 = r.state?.code?.['2digit']?.toLowerCase() || '';
          const c3 = r.state?.code?.['3digit']?.toLowerCase() || '';
          return name === hint || c2 === hint || c3 === hint;
        });
        if (stateMatch) match = stateMatch;
      }

      const stateCode = match.state?.code?.['2digit'] || match.state?.code?.['3digit'] || match.state?.name || '';
      const zipEntry = match.zip_codes?.[0];
      // Strip diacritics (accents) for carrier compatibility
      const rawCity = zipEntry?.locality || city;
      const cityName = rawCity.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const zipCode = zipEntry?.zip_code || '';
      // DANE 8-digit code — required by TCC and other Colombian carriers
      const cityCode = zipEntry?.info?.stat_8digit || undefined;

      this.logger.log(`Geocode result: ${city} → city=${cityName}, state=${stateCode}, zip=${zipCode}, dane=${cityCode || 'N/A'}`);
      return { city: cityName, state: stateCode, zipcode: zipCode, cityCode };
    } catch (error) {
      this.logger.warn(`Geocode locate failed for ${city}, ${country}: ${error.message}`);
      return null;
    }
  }
}
