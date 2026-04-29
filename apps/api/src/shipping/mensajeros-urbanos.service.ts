import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

/**
 * Mensajeros Urbanos (MU) — Domicilios API v2.0 client.
 * Docs: https://integraciones.mensajerosurbanos.com/domicilios
 *
 * Currently supports Medellin only (city id = 3).
 */

export const MU_CITY = {
  bogota: 1,
  cali: 2,
  medellin: 3,
  barranquilla: 4,
  cartagena: 8,
  sta_marta: 9,
  bucaramanga: 10,
} as const;

export const MU_TYPE_SERVICE_DELIVERY = 4;

export interface MUCoordinate {
  lat?: number;
  long?: number;
  address: string;
  city: string;
  country?: string;
  /** Origin/destination contact info (only required for create endpoint) */
  name?: string;
  phone?: string;
  email?: string;
  observation?: string;
  /** 1 = pickup point (origin), 2 = delivery point (destination) */
  type?: number;
}

export interface MUCalculateRequest {
  type_service: number;
  roundtrip: 0 | 1;
  declared_value: number;
  city: number;
  parking_surcharge: number;
  coordinates: MUCoordinate[];
}

export interface MUCalculateResponse {
  total_service: number;
  total_distance: number;
  base_value: number;
  declared_value: number;
  iva?: number;
  [k: string]: unknown;
}

export interface MUCreateRequest {
  type_service: number;
  roundtrip: 0 | 1;
  declared_value: number;
  city: number;
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  observation: string;
  description: string;
  os: string;
  coordinates: MUCoordinate[];
}

export interface MUCreateResponse {
  task_id: number;
  uuid: string;
  status: number;
  total: number;
  date: string;
  distance: number;
  error: number;
}

export interface MUTrackResponse {
  task_id: number;
  uuid: string;
  status_id: number;
  status: string;
  total_value: number;
  city_id: number;
  city: string;
  type_task: string;
  date_start: string;
  time_start: string;
  address: any[];
  resource: any[];
  history: any[];
  [k: string]: unknown;
}

export interface MUEnvelope<T> {
  version: string;
  status: string;
  status_code: number;
  message: string;
  href?: string;
  data: T;
}

@Injectable()
export class MensajerosUrbanosService {
  private readonly logger = new Logger(MensajerosUrbanosService.name);
  private readonly baseUrl = 'https://mu-integraciones.mensajerosurbanos.com';

  constructor(private settings: SettingsService) {}

  /** Detect Medellin from a city string. */
  static isMedellin(city: string | null | undefined): boolean {
    if (!city) return false;
    const normalized = city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    return normalized === 'medellin' || normalized.startsWith('medellin');
  }

  private async getToken(): Promise<string> {
    const token = await this.settings.get('mensajeros_urbanos_token');
    if (!token) {
      throw new BadRequestException(
        'Mensajeros Urbanos no está configurado. Falta el token en Settings → Envíos.',
      );
    }
    return token;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.getToken();
    const url = `${this.baseUrl}${path}`;
    const payload = { access_token: token, ...body };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new BadRequestException(`MU respuesta inválida (${res.status}): ${text.slice(0, 300)}`);
    }

    if (!res.ok || (parsed?.status && parsed.status !== 'success' && parsed.status_code !== 200)) {
      const msg = parsed?.message || parsed?.error || res.statusText;
      this.logger.warn(`MU ${path} error ${res.status}: ${JSON.stringify(parsed).slice(0, 500)}`);
      throw new BadRequestException(`Mensajeros Urbanos: ${msg}`);
    }

    return parsed as T;
  }

  /** POST /api/calculate — quote a delivery price. */
  async calculate(input: {
    declaredValue: number;
    coordinates: MUCoordinate[];
    roundtrip?: 0 | 1;
    parkingSurcharge?: number;
    cityId?: number;
  }): Promise<MUCalculateResponse> {
    const body: MUCalculateRequest = {
      type_service: MU_TYPE_SERVICE_DELIVERY,
      roundtrip: input.roundtrip ?? 0,
      declared_value: Math.max(0, Math.round(input.declaredValue)),
      city: input.cityId ?? MU_CITY.medellin,
      parking_surcharge: input.parkingSurcharge ?? 0,
      coordinates: input.coordinates,
    };

    this.logger.log(`MU calculate request: ${JSON.stringify(body).slice(0, 800)}`);
    const res = await this.request<MUEnvelope<MUCalculateResponse>>('/api/calculate', body as any);
    return res.data;
  }

  /** POST /api/create — create a real delivery service. */
  async createService(input: {
    declaredValue: number;
    coordinates: MUCoordinate[];
    description: string;
    observation: string;
    startDate: string;
    startTime: string;
    roundtrip?: 0 | 1;
    cityId?: number;
  }): Promise<MUCreateResponse> {
    const body: MUCreateRequest = {
      type_service: MU_TYPE_SERVICE_DELIVERY,
      roundtrip: input.roundtrip ?? 0,
      declared_value: Math.max(0, Math.round(input.declaredValue)),
      city: input.cityId ?? MU_CITY.medellin,
      start_date: input.startDate,
      start_time: input.startTime,
      observation: input.observation,
      description: input.description,
      os: 'NEW API 2.0',
      coordinates: input.coordinates,
    };

    this.logger.log(`MU create request: ${JSON.stringify(body).slice(0, 1500)}`);
    const res = await this.request<MUEnvelope<MUCreateResponse>>('/api/create', body as any);
    return res.data;
  }

  /** POST /api/track — fetch the current status of a service by uuid. */
  async track(uuid: string): Promise<MUTrackResponse> {
    const res = await this.request<MUEnvelope<MUTrackResponse>>('/api/track', { uuid });
    return res.data;
  }

  /** POST /api/cancel — cancel a service by uuid. */
  async cancel(uuid: string, description = 'Cancelado desde admin', cancellationType: 1 | 2 | 3 | 4 = 4) {
    return this.request<MUEnvelope<unknown>>('/api/cancel', {
      task_uuid: uuid,
      cancellation_type: cancellationType,
      description,
    });
  }

  /** POST /api/Add-store — register the pickup store. Returns store id. */
  async addStore(input: {
    idPoint: string;
    name: string;
    address: string;
    cityId?: number;
    phone?: string;
    schedule?: string;
    parking?: number;
    addressComplement?: string;
  }): Promise<{ id: string }> {
    const body = {
      id_point: input.idPoint,
      name: input.name,
      address: input.address,
      city: input.cityId ?? MU_CITY.medellin,
      phone: input.phone,
      schedule: input.schedule,
      parking: input.parking ?? 0,
      address_complement: input.addressComplement,
    };

    const res = await this.request<MUEnvelope<{ id: string }>>('/api/Add-store', body as any);
    return res.data;
  }

  /** POST /api/webhook — register a webhook URL for status callbacks. */
  async registerWebhook(endpoint: string, tokenEndpoint: 'php' | 'node' | 'json' = 'json', tokenId?: string) {
    return this.request<unknown>('/api/webhook', {
      endpoint,
      token_endpoint: tokenEndpoint,
      token_id: tokenId ?? null,
    });
  }
}
