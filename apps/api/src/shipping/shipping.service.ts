import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EnviaService, EnviaRateRequest, EnviaGenerateRequest, EnviaPickupRequest } from './envia.service';
import { MensajerosUrbanosService, MUCoordinate, MUProduct, MU_CITY, MU_DANE_CODE } from './mensajeros-urbanos.service';
import { ShipmentStatus } from '@prisma/client';

export const MU_CARRIER = 'mensajerosUrbanos';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private envia: EnviaService,
    private mu: MensajerosUrbanosService,
  ) {}

  /** Returns true if the destination is in Medellin (case/diacritics insensitive). */
  private isMedellinOrder(order: { address: { city: string } | null }): boolean {
    return MensajerosUrbanosService.isMedellin(order.address?.city);
  }

  /** Normalize a city string to a DANE code key (lowercase, no accents). */
  private toDaneKey(city: string | null | undefined): string {
    if (!city) return 'medellin';
    const norm = city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const aliases: Record<string, string> = {
      'santa marta': 'sta_marta',
      'sta marta': 'sta_marta',
      'la estrella': 'la_estrella',
      ant_envigado: 'envigado',
      ant_bello: 'bello',
      ant_itagui: 'itagui',
      ant_sabaneta: 'sabaneta',
      ant_la_estrella: 'la_estrella',
      ant_caldas: 'caldas',
    };
    const key = aliases[norm] ?? norm.replace(/\s+/g, '_');
    return key;
  }

  /**
   * Build coordinate(s) for MU requests.
   *
   * For /api/create: returns 1 coordinate (destination only), with client_data and products.
   * For /api/calculate: returns 2 lightweight coordinates [origin, destination].
   */
  private async buildMUCoordinates(
    order: any,
    extras?: { orderId: string; description: string; products: MUProduct[]; productsValue?: number },
  ): Promise<MUCoordinate[]> {
    if (!order.address) {
      throw new BadRequestException('La orden no tiene dirección de entrega');
    }

    const destAddress = order.address.detail
      ? `${order.address.street}, ${order.address.detail}`
      : order.address.street;

    if (extras) {
      // /api/create: single destination coordinate per MU docs
      return [
        {
          order_id: extras.orderId,
          address: destAddress,
          token: '',
          description: extras.description,
          client_data: {
            client_name: order.customer?.name || '',
            client_phone: this.normalizePhone(order.address.phone || order.customer?.phone) || '',
            client_email: order.customer?.email || '',
            products_value: '100',
            domicile_value: '0',
            payment_type: '3',
          },
          products: extras.products,
        },
      ];
    }

    // /api/calculate: lightweight [origin, destination]
    const [originStreet, originCity] = await Promise.all([
      this.settings.get('shipping_origin_street'),
      this.settings.get('shipping_origin_city'),
    ]);
    if (!originStreet || !originCity) {
      throw new BadRequestException('Falta configurar la dirección de origen (Settings → Envíos).');
    }
    return [
      {
        address: originStreet,
        city: originCity,
        observation: 'Recogida en tienda',
      },
      {
        address: destAddress,
        city: order.address.city,
        observation: order.address.detail || undefined,
      },
    ];
  }

  private async getOriginAddress() {
    const [name, phone, street, city, state, country, zip, senderIdType, senderIdNumber] = await Promise.all([
      this.settings.get('shipping_origin_name'),
      this.settings.get('shipping_origin_phone'),
      this.settings.get('shipping_origin_street'),
      this.settings.get('shipping_origin_city'),
      this.settings.get('shipping_origin_state'),
      this.settings.get('shipping_origin_country'),
      this.settings.get('shipping_origin_zip'),
      this.settings.get('shipping_sender_id_type'),
      this.settings.get('shipping_sender_id_number'),
    ]);

    if (!name || !street || !city || !country || !zip) {
      throw new BadRequestException('Shipping origin address not configured. Go to Settings → Envíos.');
    }

    const countryCode = this.normalizeCountry(country);
    const { street: parsedStreet, number: streetNumber } = this.parseStreetNumber(street);
    const identification_type = senderIdType || 'CC';
    const identification_number = senderIdNumber || '';
    const geo = await this.envia.locateCity(countryCode, city, state || undefined);
    const normalizedPhone = this.normalizePhone(phone);
    if (geo) {
      this.logger.log(`Origin geocoded: ${city} → ${geo.city}, ${geo.state}, ${geo.zipcode}, dane=${geo.cityCode || 'N/A'}`);
      return { name, phone: normalizedPhone, identification_type, identification_number, street: parsedStreet, number: streetNumber, city: geo.cityCode || geo.city, state: geo.state, country: countryCode, postalCode: geo.zipcode || zip };
    }

    return { name, phone: normalizedPhone, identification_type, identification_number, street: parsedStreet, number: streetNumber, city, state: this.normalizeState(state || ''), country: countryCode, postalCode: zip };
  }

  private async getDefaultPackage() {
    const [weightStr, dimensionsStr, itemsPerBoxStr, declaredValueStr, packagingModeStr] = await Promise.all([
      this.settings.get('shipping_default_weight'),
      this.settings.get('shipping_default_dimensions'),
      this.settings.get('shipping_items_per_box'),
      this.settings.get('shipping_declared_value_per_item'),
      this.settings.get('shipping_packaging_mode'),
    ]);

    const weight = parseFloat(weightStr || '1');
    let dimensions = { length: 25, width: 20, height: 10 };
    try {
      if (dimensionsStr) dimensions = JSON.parse(dimensionsStr);
    } catch {}

    const itemsPerBox = parseInt(itemsPerBoxStr || '4', 10) || 4;
    const declaredValuePerItem = parseFloat(declaredValueStr || '20000') || 20000;
    // Modes: 'grouped' (default) = group N items per box | 'single' = one box per item | 'all_in_one' = one box for everything
    const packagingMode = (packagingModeStr || 'grouped') as 'grouped' | 'single' | 'all_in_one';

    return { weight, dimensions, itemsPerBox, declaredValuePerItem, packagingMode };
  }

  // Map full state names to Envia-compatible abbreviations
  private static readonly STATE_MAP: Record<string, string> = {
    'amazonas': 'AMA', 'antioquia': 'ANT', 'arauca': 'ARA', 'atlantico': 'ATL',
    'atlántico': 'ATL', 'bogota': 'DC', 'bogotá': 'DC', 'bolivar': 'BOL',
    'bolívar': 'BOL', 'boyaca': 'BOY', 'boyacá': 'BOY', 'caldas': 'CAL',
    'caqueta': 'CAQ', 'caquetá': 'CAQ', 'casanare': 'CAS', 'cauca': 'CAU',
    'cesar': 'CES', 'choco': 'CHO', 'chocó': 'CHO', 'cordoba': 'COR',
    'córdoba': 'COR', 'cundinamarca': 'CUN', 'guainia': 'GUA', 'guainía': 'GUA',
    'guaviare': 'GUV', 'huila': 'HUI', 'la guajira': 'LAG', 'guajira': 'LAG',
    'magdalena': 'MAG', 'meta': 'MET', 'nariño': 'NAR', 'narino': 'NAR',
    'norte de santander': 'NSA', 'putumayo': 'PUT', 'quindio': 'QUI',
    'quindío': 'QUI', 'risaralda': 'RIS', 'san andres': 'SAP',
    'san andrés': 'SAP', 'santander': 'SAN', 'sucre': 'SUC',
    'tolima': 'TOL', 'valle del cauca': 'VAC', 'valle': 'VAC',
    'vaupes': 'VAU', 'vaupés': 'VAU', 'vichada': 'VIC',
  };

  private static readonly COUNTRY_MAP: Record<string, string> = {
    'colombia': 'CO', 'méxico': 'MX', 'mexico': 'MX', 'argentina': 'AR',
    'chile': 'CL', 'peru': 'PE', 'perú': 'PE', 'brasil': 'BR', 'brazil': 'BR',
    'estados unidos': 'US', 'united states': 'US', 'españa': 'ES', 'spain': 'ES',
  };

  /**
   * Split Colombian-style address into street + number.
   * "Crr 26a #9a-22" → { street: "Crr 26a", number: "9a-22" }
   * "Carrera 25a 1a Sur 45" → { street: "Carrera 25a 1a Sur 45", number: "S/N" }
   */
  private parseStreetNumber(fullStreet: string): { street: string; number: string } {
    if (!fullStreet) return { street: '', number: 'S/N' };
    const hashIdx = fullStreet.indexOf('#');
    if (hashIdx > 0) {
      return {
        street: fullStreet.substring(0, hashIdx).trim(),
        number: fullStreet.substring(hashIdx + 1).trim() || 'S/N',
      };
    }
    // Try to extract trailing number: "Calle 10 15-30" → street="Calle 10", number="15-30"
    const match = fullStreet.match(/^(.+?)\s+(\d+[\w-]*)$/);
    if (match) {
      return { street: match[1], number: match[2] };
    }
    return { street: fullStreet, number: 'S/N' };
  }

  private normalizeState(state: string): string {
    if (!state) return '';
    if (state.length <= 3) return state.toUpperCase();
    return ShippingService.STATE_MAP[state.toLowerCase().trim()] || state.substring(0, 3).toUpperCase();
  }

  private normalizeCountry(country: string): string {
    if (!country) return 'CO';
    if (country.length === 2) return country.toUpperCase();
    return ShippingService.COUNTRY_MAP[country.toLowerCase().trim()] || country.substring(0, 2).toUpperCase();
  }

  /**
   * Normalize phone to 10-digit Colombian format (3001234567).
   * Strips +57, 57 prefix, spaces, dashes, parens.
   */
  private normalizePhone(phone: string | null | undefined): string {
    if (!phone) return '';
    let digits = phone.replace(/[^\d]/g, '');
    // Remove country code: 57 prefix when result is 12 digits (573001234567)
    if (digits.length === 12 && digits.startsWith('57')) {
      digits = digits.substring(2);
    }
    // Also handle if they stored it as 573001234567 (11 digits with leading 57)
    if (digits.length > 10 && digits.startsWith('57')) {
      digits = digits.substring(2);
    }
    return digits;
  }

  private async buildDestination(order: { customer: { name: string; phone?: string | null; email?: string | null; documentType?: string | null; documentNumber?: string | null }; address: { street: string; detail?: string | null; city: string; state?: string | null; zip?: string | null; country: string; phone?: string | null } | null }) {
    if (!order.address) {
      throw new BadRequestException('Order has no delivery address');
    }

    const countryCode = this.normalizeCountry(order.address.country);
    const { street: parsedStreet, number: parsedNumber } = this.parseStreetNumber(order.address.street);
    const streetNumber = order.address.detail
      ? `${parsedNumber} ${order.address.detail}`
      : parsedNumber;
    const identification_type = order.customer.documentType || 'CC';
    const senderIdFallback = await this.settings.get('shipping_sender_id_number') || '22222222';
    const identification_number = order.customer.documentNumber || senderIdFallback;
    const normalizedPhone = this.normalizePhone(order.address.phone || order.customer.phone);
    const geo = await this.envia.locateCity(countryCode, order.address.city, order.address.state || undefined);
    if (geo) {
      this.logger.log(`Destination geocoded: ${order.address.city} → ${geo.city}, ${geo.state}, ${geo.zipcode}, dane=${geo.cityCode || 'N/A'}`);
      return {
        name: order.customer.name,
        phone: normalizedPhone,
        email: order.customer.email || '',
        identification_type,
        identification_number,
        street: parsedStreet,
        number: streetNumber,
        ...(order.address.detail ? { street2: order.address.detail } : {}),
        city: geo.cityCode || geo.city,
        state: geo.state,
        country: countryCode,
        postalCode: geo.zipcode || order.address.zip || '',
      };
    }

    return {
      name: order.customer.name,
      phone: normalizedPhone,
      email: order.customer.email || '',
      identification_type,
      identification_number,
      street: parsedStreet,
      number: streetNumber,
      ...(order.address.detail ? { street2: order.address.detail } : {}),
      city: order.address.city,
      state: this.normalizeState(order.address.state || ''),
      country: countryCode,
      postalCode: order.address.zip || '110111',
    };
  }

  private async buildPackages(order: { items: Array<{ quantity: number; unitPrice: any }>; subtotal: any }) {
    const pkg = await this.getDefaultPackage();
    const { weight: baseWeight, dimensions, itemsPerBox, declaredValuePerItem, packagingMode } = pkg;
    const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

    const makeBox = (qty: number) => ({
      type: 'box',
      content: 'Perfumes',
      amount: 1,
      declaredValue: qty * declaredValuePerItem,
      lengthUnit: 'CM',
      weightUnit: 'KG',
      weight: Math.max(0.1, qty * baseWeight),
      dimensions,
    });

    if (packagingMode === 'all_in_one') {
      // Everything in a single box
      return [makeBox(totalItems)];
    }

    if (packagingMode === 'single') {
      // One box per unit
      return Array.from({ length: totalItems }, () => makeBox(1));
    }

    // Default: 'grouped' — group up to itemsPerBox units per box
    const numBoxes = Math.ceil(totalItems / itemsPerBox);
    return Array.from({ length: numBoxes }, (_, i) => {
      const isLastBox = i === numBoxes - 1;
      const qty = isLastBox ? totalItems - i * itemsPerBox : itemsPerBox;
      return makeBox(qty);
    });
  }

  async getOrderForShipping(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        address: true,
        items: { include: { variant: true } },
        shipment: { include: { events: { orderBy: { timestamp: 'desc' } } } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async quoteRates(orderId: string, carrier?: string) {
    const order = await this.getOrderForShipping(orderId);

    // Medellin → use Mensajeros Urbanos exclusively
    if (this.isMedellinOrder(order)) {
      try {
        const declaredValue = Number(order.subtotal || 0);
        const coordinates = await this.buildMUCoordinates(order);
        const quote = await this.mu.calculate({ declaredValue, coordinates });
        const rate = {
          carrier: MU_CARRIER,
          service: 'sameDay',
          serviceDescription: 'Mensajeros Urbanos — Domicilio Medellín (mismo día)',
          deliveryEstimate: '2-4 horas',
          totalPrice: String(quote.total_service ?? 0),
          currency: 'COP',
          metadata: { distance: quote.total_distance, baseValue: quote.base_value },
        };
        return { orderId, rates: [rate] };
      } catch (e: any) {
        this.logger.warn(`MU quote failed: ${e.message}`);
        return { orderId, rates: [], error: `Mensajeros Urbanos: ${e.message}` };
      }
    }

    const origin = await this.getOriginAddress();
    const destination = await this.buildDestination(order);
    const packages = await this.buildPackages(order);

    this.logger.log(`Quote rates — origin: ${JSON.stringify(origin)}`);
    this.logger.log(`Quote rates — destination: ${JSON.stringify(destination)}`);
    this.logger.log(`Quote rates — packages: ${JSON.stringify(packages)}`);

    const carriers = carrier ? [carrier] : ['serviEntrega', 'coordinadora', 'interRapidisimo', 'tcc', 'deprisa'];

    const ratePromises = carriers.map(async (c) => {
      try {
        const response = await this.envia.getRates({
          origin,
          destination,
          packages,
          shipment: { type: 1, carrier: c },
        });
        this.logger.log(`Rate response for ${c}: ${JSON.stringify(response).substring(0, 500)}`);
        return response.data || [];
      } catch (error) {
        this.logger.warn(`Rate quote failed for ${c}: ${error.message}`);
        return [];
      }
    });

    const allResults = await Promise.all(ratePromises);
    const results = allResults.flat();

    // Sort by price ascending
    results.sort((a, b) => Number(a.totalPrice || 0) - Number(b.totalPrice || 0));

    return { orderId, rates: results };
  }

  async generateLabel(orderId: string, carrier: string, service: string) {
    const order = await this.getOrderForShipping(orderId);

    // Mensajeros Urbanos branch — either explicitly chosen or order is in Medellin
    if (carrier === MU_CARRIER || this.isMedellinOrder(order)) {
      return this.generateMULabel(orderId, order);
    }

    const origin = await this.getOriginAddress();
    const destination = await this.buildDestination(order);
    const packages = await this.buildPackages(order);

    const addressDetail = (order.address as any)?.detail || '';
    const labelRequest = {
      origin,
      destination,
      packages,
      shipment: { type: 1, carrier, service },
      settings: {
        currency: 'COP',
        printFormat: 'PDF',
        printSize: 'PAPER_4X6',
        ...(addressDetail ? { comments: addressDetail } : {}),
      },
    };

    this.logger.log(`Generate label request: ${JSON.stringify(labelRequest).substring(0, 1500)}`);

    const response = await this.envia.generateLabel(labelRequest);

    this.logger.log(`Generate label response: ${JSON.stringify(response).substring(0, 500)}`);

    if (response.meta === 'error' || !response.data?.length) {
      const errMsg = (response as any).error?.message || (response as any).error?.description || 'No se pudo generar la guía';
      throw new BadRequestException(`Error de transportadora: ${errMsg}`);
    }

    const labelData = response.data[0];

    const shipment = await this.prisma.shipment.upsert({
      where: { orderId },
      update: {
        carrier: labelData.carrier,
        service: labelData.service,
        trackingNumber: labelData.trackingNumber,
        trackUrl: labelData.trackUrl,
        labelUrl: labelData.label,
        enviaShipmentId: labelData.shipmentId,
        totalPrice: labelData.totalPrice,
        currency: labelData.currency,
        status: ShipmentStatus.LABEL_CREATED,
        enviaRawResponse: response as any,
      },
      create: {
        orderId,
        carrier: labelData.carrier,
        service: labelData.service,
        trackingNumber: labelData.trackingNumber,
        trackUrl: labelData.trackUrl,
        labelUrl: labelData.label,
        enviaShipmentId: labelData.shipmentId,
        totalPrice: labelData.totalPrice,
        currency: labelData.currency,
        status: ShipmentStatus.LABEL_CREATED,
        enviaRawResponse: response as any,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED', shipping: labelData.totalPrice },
    });

    return shipment;
  }

  private async generateMULabel(orderId: string, order: any) {
    const totalItems = order.items.reduce((s: number, i: any) => s + i.quantity, 0);
    const description = `${totalItems} producto${totalItems === 1 ? '' : 's'} — D Perfume House`;
    const observation = `Pedido ${order.orderNumber}`;

    // store_id is required per product by MU's /api/create endpoint
    const muStoreId = await this.settings.get('mensajeros_urbanos_store_id');
    const storeId = muStoreId || 'A100';
    const declaredValue = 100;

    // Build products using MU's documented schema
    const products = order.items.map((it: any) => ({
      store_id: storeId,
      sku: String(it.variant?.sku || it.variant?.id || 'SKU'),
      product_name: String(it.variant?.name || 'Producto'),
      value: 100,
      quantity: Number(it.quantity) || 1,
      url_img: '',
      barcode: String(it.variant?.sku || it.variant?.id || 'SKU'),
      planogram: 'Entrega',
    }));

    const coordinates = await this.buildMUCoordinates(order, {
      orderId: String(order.orderNumber || orderId),
      description,
      products,
    });

    // Resolve DANE code from delivery city
    const daneKey = this.toDaneKey(order.address?.city);
    const daneCode = MU_DANE_CODE[daneKey] ?? MU_DANE_CODE['medellin'];

    const now = new Date();
    // Format in Colombia timezone (UTC-5 / America/Bogota)
    const bogotaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const bogotaTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
    const startDate = bogotaDate; // YYYY-MM-DD
    const startTime = bogotaTime; // HH:MM:SS

    const result = await this.mu.createService({
      declaredValue,
      coordinates,
      description,
      observation,
      startDate,
      startTime,
      daneCode,
    });

    const shipment = await this.prisma.shipment.upsert({
      where: { orderId },
      update: {
        carrier: MU_CARRIER,
        service: 'sameDay',
        trackingNumber: result.uuid,
        trackUrl: null,
        labelUrl: null,
        enviaShipmentId: null,
        totalPrice: result.total,
        currency: 'COP',
        status: ShipmentStatus.LABEL_CREATED,
        enviaRawResponse: result as any,
      },
      create: {
        orderId,
        carrier: MU_CARRIER,
        service: 'sameDay',
        trackingNumber: result.uuid,
        trackUrl: null,
        totalPrice: result.total,
        currency: 'COP',
        status: ShipmentStatus.LABEL_CREATED,
        enviaRawResponse: result as any,
      },
    });

    // Clear any leftover events from a previous (cancelled) label
    await this.prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED', shipping: result.total },
    });

    return shipment;
  }

  /** Map MU's status_id (1..n) to internal ShipmentStatus. */
  private mapMUStatus(statusId: number | undefined, statusName?: string): ShipmentStatus | null {
    // Common MU status_id values:
    // 1 = Por asignar | 2 = Pendiente | 3 = Asignado | 4 = En curso (en camino)
    // 5 = Finalizado (entregado) | 6 = Cancelado | 7 = Sin mensajero
    if (statusId === 5) return ShipmentStatus.DELIVERED;
    if (statusId === 6 || statusId === 7) return ShipmentStatus.CANCELLED;
    if (statusId === 4) return ShipmentStatus.IN_TRANSIT;
    if (statusId === 3) return ShipmentStatus.PICKED_UP;
    if (statusId === 1 || statusId === 2) return ShipmentStatus.LABEL_CREATED;
    const s = (statusName || '').toLowerCase();
    if (s.includes('finaliz') || s.includes('entreg')) return ShipmentStatus.DELIVERED;
    if (s.includes('cancel')) return ShipmentStatus.CANCELLED;
    if (s.includes('curso') || s.includes('camino') || s.includes('progress')) return ShipmentStatus.IN_TRANSIT;
    if (s.includes('asign')) return ShipmentStatus.PICKED_UP;
    return null;
  }

  async trackOrder(orderId: string) {
    const order = await this.getOrderForShipping(orderId);

    if (!order.shipment?.trackingNumber) {
      throw new BadRequestException('No tracking number for this order');
    }

    if (order.shipment.carrier === MU_CARRIER) {
      const muData = await this.mu.track(order.shipment.trackingNumber);
      const newStatus = this.mapMUStatus(muData.status_id, muData.status);
      const events = (muData.history as any[]) || [];
      for (const ev of events) {
        const ts = new Date(ev.date || ev.timestamp || Date.now());
        const desc = ev.description || ev.status || '';
        const existing = await this.prisma.shipmentEvent.findFirst({
          where: { shipmentId: order.shipment.id, timestamp: ts, description: desc },
        });
        if (!existing) {
          await this.prisma.shipmentEvent.create({
            data: {
              shipmentId: order.shipment.id,
              timestamp: ts,
              location: ev.location || '',
              description: desc,
              status: muData.status || '',
            },
          });
        }
      }
      if (newStatus && order.shipment.status !== newStatus) {
        await this.prisma.shipment.update({ where: { orderId }, data: { status: newStatus } });
      }
      const resolvedStatus = newStatus ?? order.shipment.status;
      if (resolvedStatus === ShipmentStatus.DELIVERED && order.status !== 'DELIVERED') {
        await this.prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });
      } else if (
        (resolvedStatus === ShipmentStatus.IN_TRANSIT || resolvedStatus === ShipmentStatus.PICKED_UP) &&
        order.status !== 'IN_TRANSIT' && order.status !== 'DELIVERED'
      ) {
        await this.prisma.order.update({ where: { id: orderId }, data: { status: 'IN_TRANSIT' } });
      }
      const shipment = await this.prisma.shipment.findUnique({
        where: { orderId },
        include: { events: { orderBy: { timestamp: 'desc' } } },
      });
      return { tracking: muData, shipment };
    }

    const response = await this.envia.trackShipment([order.shipment.trackingNumber]);
    const trackData = response.data?.[0];

    // Envia returns eventHistory with { event, description, location, date }
    const events: any[] = trackData?.eventHistory || trackData?.events || [];
    if (events.length) {
      for (const event of events) {
        const ts = new Date(event.date || event.timestamp);
        const desc = event.event || event.description || '';
        const loc = event.location || '';
        const existing = await this.prisma.shipmentEvent.findFirst({
          where: {
            shipmentId: order.shipment.id,
            timestamp: ts,
            description: desc,
          },
        });
        if (!existing) {
          await this.prisma.shipmentEvent.create({
            data: {
              shipmentId: order.shipment.id,
              timestamp: ts,
              location: loc,
              description: desc,
              status: trackData.status || '',
            },
          });
        }
      }
    }

    // Update shipment status based on tracking
    const statusMap: Record<string, ShipmentStatus> = {
      'Created': ShipmentStatus.LABEL_CREATED,
      'Pickup': ShipmentStatus.PICKED_UP,
      'Transit': ShipmentStatus.IN_TRANSIT,
      'Delivered': ShipmentStatus.DELIVERED,
      'Cancelled': ShipmentStatus.CANCELLED,
      'Address error': ShipmentStatus.ADDRESS_ERROR,
      'Address Error': ShipmentStatus.ADDRESS_ERROR,
    };
    const newStatus = statusMap[trackData?.status];
    if (newStatus && order.shipment.status !== newStatus) {
      await this.prisma.shipment.update({
        where: { orderId },
        data: { status: newStatus },
      });
    }
    // Sync order status to DELIVERED whenever shipment is DELIVERED (handles backfill)
    const resolvedStatus = newStatus ?? order.shipment.status;
    if (resolvedStatus === ShipmentStatus.DELIVERED && order.status !== 'DELIVERED') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED' },
      });
      this.logger.log(`Order ${order.orderNumber} auto-marked as DELIVERED via tracking poll`);
    } else if (
      (resolvedStatus === ShipmentStatus.IN_TRANSIT || resolvedStatus === ShipmentStatus.PICKED_UP) &&
      order.status !== 'IN_TRANSIT' && order.status !== 'DELIVERED'
    ) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'IN_TRANSIT' },
      });
      this.logger.log(`Order ${order.orderNumber} auto-marked as IN_TRANSIT via tracking poll`);
    } else if (resolvedStatus === ShipmentStatus.ADDRESS_ERROR && order.status !== 'ADDRESS_ERROR') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'ADDRESS_ERROR' },
      });
      this.logger.warn(`Order ${order.orderNumber} marked ADDRESS_ERROR via tracking poll`);
    }

    const shipment = await this.prisma.shipment.findUnique({
      where: { orderId },
      include: { events: { orderBy: { timestamp: 'desc' } } },
    });

    return { tracking: trackData, shipment };
  }

  async schedulePickup(orderId: string, date: string, timeFrom: number, timeTo: number) {
    const order = await this.getOrderForShipping(orderId);

    if (!order.shipment?.trackingNumber || !order.shipment?.carrier) {
      throw new BadRequestException('Order must have a shipping label first');
    }

    if (order.shipment.carrier === MU_CARRIER) {
      throw new BadRequestException('Mensajeros Urbanos no requiere agendar recolección: el mensajero llega automáticamente.');
    }

    const origin = await this.getOriginAddress();
    const pkg = await this.getDefaultPackage();
    const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const ITEMS_PER_BOX = 4;

    let response: { meta: string; data: any };
    try {
      response = await this.envia.schedulePickup({
        origin,
        shipment: {
          type: 1,
          carrier: order.shipment.carrier,
          pickup: {
            weightUnit: 'KG',
            totalWeight: Math.ceil(totalItems / ITEMS_PER_BOX),
            totalPackages: 1,
            date,
            timeFrom,
            timeTo,
            carrier: order.shipment.carrier,
            trackingNumbers: [order.shipment.trackingNumber],
          },
        },
      });
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Error al agendar recogida con Envia');
    }

    await this.prisma.shipment.update({
      where: { orderId },
      data: {
        pickupConfirmation: response.data?.confirmation,
        status: ShipmentStatus.PICKUP_SCHEDULED,
      },
    });

    return response.data;
  }

  async cancelShipment(orderId: string) {
    const order = await this.getOrderForShipping(orderId);

    if (!order.shipment?.trackingNumber || !order.shipment?.carrier) {
      throw new BadRequestException('No shipment to cancel');
    }

    if (order.shipment.carrier === MU_CARRIER) {
      await this.mu.cancel(order.shipment.trackingNumber);
      await this.prisma.shipmentEvent.deleteMany({ where: { shipmentId: order.shipment.id } });
      await this.prisma.shipment.update({
        where: { orderId },
        data: { status: ShipmentStatus.CANCELLED },
      });
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } });
      return { cancelled: true };
    }

    const response = await this.envia.cancelShipment(
      order.shipment.carrier,
      order.shipment.trackingNumber,
    );

    await this.prisma.shipmentEvent.deleteMany({ where: { shipmentId: order.shipment.id } });
    await this.prisma.shipment.update({
      where: { orderId },
      data: { status: ShipmentStatus.CANCELLED },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });

    return response.data;
  }

  /**
   * Handle Mensajeros Urbanos status callback.
   * Payload shape (per MU docs):
   *   { token, id_company, type, date, order_id, details: { uuid, status, status_id, ... } }
   */
  async handleMUWebhook(payload: any) {
    const uuid = payload?.details?.uuid;
    if (!uuid) {
      this.logger.warn('MU webhook received without uuid');
      return;
    }

    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber: uuid, carrier: MU_CARRIER },
    });
    if (!shipment) {
      this.logger.warn(`MU webhook: no shipment for uuid ${uuid}`);
      return;
    }

    const newStatus = this.mapMUStatus(payload.details?.status_id, payload.details?.status) ?? shipment.status;

    await this.prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        timestamp: new Date(payload?.date || Date.now()),
        location: payload?.details?.url || '',
        description: payload?.details?.finish_description || payload?.details?.status || '',
        status: payload?.details?.status || '',
      },
    });

    if (newStatus !== shipment.status) {
      await this.prisma.shipment.update({ where: { id: shipment.id }, data: { status: newStatus } });
    }

    if (newStatus === ShipmentStatus.DELIVERED) {
      await this.prisma.order.update({ where: { id: shipment.orderId }, data: { status: 'DELIVERED' } });
    } else if (newStatus === ShipmentStatus.CANCELLED) {
      await this.prisma.order.update({ where: { id: shipment.orderId }, data: { status: 'PAID' } });
    } else if (newStatus === ShipmentStatus.IN_TRANSIT || newStatus === ShipmentStatus.PICKED_UP) {
      const order = await this.prisma.order.findUnique({ where: { id: shipment.orderId }, select: { status: true } });
      if (order && order.status !== 'IN_TRANSIT' && order.status !== 'DELIVERED') {
        await this.prisma.order.update({ where: { id: shipment.orderId }, data: { status: 'IN_TRANSIT' } });
      }
    }

    this.logger.log(`MU webhook processed: ${uuid} → ${newStatus}`);
  }

  /** Provision the MU pickup store using current shipping origin settings. */
  async setupMUStore() {
    const [name, phone, street, city] = await Promise.all([
      this.settings.get('shipping_origin_name'),
      this.settings.get('shipping_origin_phone'),
      this.settings.get('shipping_origin_street'),
      this.settings.get('shipping_origin_city'),
    ]);
    if (!street || !city) throw new BadRequestException('Configura primero la dirección de origen.');

    const cityId = MensajerosUrbanosService.isMedellin(city) ? MU_CITY.medellin : MU_CITY.medellin;
    const result = await this.mu.addStore({
      idPoint: 'dperfumehouse-main',
      name: name || 'D Perfume House',
      address: street,
      cityId,
      phone: this.normalizePhone(phone),
      schedule: 'L-S 9:00AM - 7:00PM',
      parking: 0,
    });
    await this.prisma.appSetting.upsert({
      where: { key: 'mensajeros_urbanos_store_id' },
      update: { value: String(result.id) },
      create: { key: 'mensajeros_urbanos_store_id', value: String(result.id), group: 'shipping' },
    });
    return result;
  }

  async handleWebhook(payload: any) {
    const trackingNumber = payload?.trackingNumber || payload?.tracking_number;
    if (!trackingNumber) {
      this.logger.warn('Webhook received without tracking number');
      return;
    }

    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber },
    });

    if (!shipment) {
      this.logger.warn(`Webhook: No shipment found for tracking ${trackingNumber}`);
      return;
    }

    const status = (payload?.status || '').toLowerCase();
    let shipmentStatus: ShipmentStatus = shipment.status;

    if (status.includes('transit') || status.includes('en camino')) {
      shipmentStatus = ShipmentStatus.IN_TRANSIT;
    } else if (status.includes('deliver') || status.includes('entregado')) {
      shipmentStatus = ShipmentStatus.DELIVERED;
    } else if (status.includes('picked') || status.includes('recolectado')) {
      shipmentStatus = ShipmentStatus.PICKED_UP;
    } else if (status.includes('address')) {
      shipmentStatus = ShipmentStatus.ADDRESS_ERROR;
    }

    await this.prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        timestamp: new Date(payload?.timestamp || Date.now()),
        location: payload?.location || '',
        description: payload?.description || status,
        status,
      },
    });

    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: { status: shipmentStatus },
    });

    if (shipmentStatus === ShipmentStatus.DELIVERED) {
      await this.prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: 'DELIVERED' },
      });
    } else if (shipmentStatus === ShipmentStatus.ADDRESS_ERROR) {
      await this.prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: 'ADDRESS_ERROR' },
      });
    } else if (shipmentStatus === ShipmentStatus.IN_TRANSIT || shipmentStatus === ShipmentStatus.PICKED_UP) {
      const order = await this.prisma.order.findUnique({ where: { id: shipment.orderId }, select: { status: true } });
      if (order && order.status !== 'IN_TRANSIT' && order.status !== 'DELIVERED') {
        await this.prisma.order.update({ where: { id: shipment.orderId }, data: { status: 'IN_TRANSIT' } });
      }
    }

    this.logger.log(`Webhook processed: ${trackingNumber} → ${shipmentStatus}`);
  }

  async listCarriers() {
    return this.envia.listCarriers('CO');
  }
}
