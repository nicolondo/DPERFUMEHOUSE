import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

/**
 * Mensajeros Urbanos (MU) — Domicilios API v2.0 client.
 * Docs: https://integraciones.mensajerosurbanos.com/domicilios
 */

/** DANE codes for supported cities (used by /api/create). */
export const MU_DANE_CODE: Record<string, string> = {
  medellin: '05001',
  bogota: '11001',
  cali: '76001',
  barranquilla: '08001',
  cartagena: '13001',
  sta_marta: '47001',
  bucaramanga: '68001',
  ibague: '73001',
  armenia: '63001',
  pereira: '66001',
  manizales: '17001',
  neiva: '41001',
  valledupar: '20001',
  chia: '25175',
  envigado: '05266',
  bello: '05088',
  itagui: '05360',
  sabaneta: '05631',
  la_estrella: '05380',
  caldas: '05129',
};

/** City numeric ID used by /api/calculate only. */
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

/** Client contact info per coordinate for /api/create. */
export interface MUClientData {
  client_name: string;
  client_phone: string;
  client_email?: string;
  products_value?: string;
  domicile_value?: string;
  client_document?: string;
  payment_type?: string;
}

/** Product item per coordinate for /api/create. */
export interface MUProduct {
  store_id: string;
  sku: string;
  product_name: string;
  url_img?: string;
  value: number;
  quantity: number;
  barcode?: string;
  planogram?: string;
}

/** Coordinate shape for /api/create. */
export interface MUCoordinate {
  order_id?: string;
  address: string;
  /** /api/create: not sent (dane_code at root). /api/calculate: free-text city. */
  city?: string;
  token?: string;
  description?: string;
  observation?: string;
  client_data?: MUClientData;
  products?: MUProduct[];
  lat?: number;
  long?: number;
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
  dane_code: string;
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  observation: string;
  description: string;
  os: string;
  store_id?: string | number;
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
  private readonly defaultBaseUrl = 'https://mu-integraciones.mensajerosurbanos.com';

  constructor(private settings: SettingsService) {}

  private async getBaseUrl(): Promise<string> {
    const configured = await this.settings.get('mensajeros_urbanos_base_url');
    return (configured && configured.trim().replace(/\/+$/, '')) || this.defaultBaseUrl;
  }

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
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${path}`;
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
      const raw = parsed?.message || parsed?.error || res.statusText;
      const msg =
        res.status === 500
          ? `Error interno en Mensajeros Urbanos (500). Verificá que la cuenta MU esté activada y el store_id configurado en Settings → Envíos. Detalle: ${raw}`
          : raw;
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
    daneCode?: string;
    storeId?: string;
  }): Promise<MUCreateResponse> {
    // Fallback to the store_id saved in settings if not passed explicitly
    const storeId = input.storeId || (await this.settings.get('mensajeros_urbanos_store_id')) || undefined;
    const body: MUCreateRequest = {
      type_service: MU_TYPE_SERVICE_DELIVERY,
      roundtrip: input.roundtrip ?? 0,
      declared_value: Math.max(0, Math.round(input.declaredValue)),
      dane_code: input.daneCode ?? MU_DANE_CODE['medellin'],
      start_date: input.startDate,
      start_time: input.startTime,
      observation: input.observation,
      description: input.description,
      os: 'NEW API 2.0',
      ...(storeId ? { store_id: storeId } : {}),
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
