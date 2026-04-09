import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EnviaService, EnviaRateRequest, EnviaGenerateRequest, EnviaPickupRequest } from './envia.service';
import { OdooService } from '../odoo/odoo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShipmentStatus } from '@prisma/client';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private envia: EnviaService,
    private odoo: OdooService,
    private notificationsService: NotificationsService,
    @InjectQueue('email-send') private readonly emailQueue: Queue,
  ) {}

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
    const [weightStr, dimensionsStr] = await Promise.all([
      this.settings.get('shipping_default_weight'),
      this.settings.get('shipping_default_dimensions'),
    ]);

    const weight = parseFloat(weightStr || '1');
    let dimensions = { length: 25, width: 20, height: 10 };
    try {
      if (dimensionsStr) dimensions = JSON.parse(dimensionsStr);
    } catch {}

    return { weight, dimensions };
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

  private async buildDestination(order: { customer: { name: string; phone?: string | null; email?: string | null; documentType?: string | null; documentNumber?: string | null }; address: { street: string; city: string; state?: string | null; zip?: string | null; country: string; phone?: string | null } | null }) {
    if (!order.address) {
      throw new BadRequestException('Order has no delivery address');
    }

    const countryCode = this.normalizeCountry(order.address.country);
    const { street: parsedStreet, number: streetNumber } = this.parseStreetNumber(order.address.street);
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
      city: order.address.city,
      state: this.normalizeState(order.address.state || ''),
      country: countryCode,
      postalCode: order.address.zip || '110111',
    };
  }

  private async buildPackages(order: { items: Array<{ quantity: number; unitPrice: any }>; subtotal: any }) {
    const pkg = await this.getDefaultPackage();
    const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

    // Weight tiers: 1-4 items = 1kg, 5-9 items = 2kg, 10+ = default weight * items
    let weight: number;
    if (totalItems <= 4) {
      weight = 1;
    } else if (totalItems <= 9) {
      weight = 2;
    } else {
      weight = pkg.weight * totalItems;
    }

    return [{
      type: 'box',
      content: 'Perfumes',
      amount: 1,
      declaredValue: totalItems * 20000,
      lengthUnit: 'CM',
      weightUnit: 'KG',
      weight,
      dimensions: pkg.dimensions,
    }];
  }

  async getOrderForShipping(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        address: true,
        items: true,
        shipment: { include: { events: { orderBy: { timestamp: 'desc' } } } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async quoteRates(orderId: string, carrier?: string) {
    const order = await this.getOrderForShipping(orderId);
    const origin = await this.getOriginAddress();
    const destination = await this.buildDestination(order);
    const packages = await this.buildPackages(order);

    this.logger.log(`Quote rates — origin: ${JSON.stringify(origin)}`);
    this.logger.log(`Quote rates — destination: ${JSON.stringify(destination)}`);
    this.logger.log(`Quote rates — packages: ${JSON.stringify(packages)}`);

    const carriers = carrier ? [carrier] : ['serviEntrega', 'coordinadora', 'interRapidisimo', 'tcc', 'deprisa', 'mensajerosUrbanos'];

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
    const origin = await this.getOriginAddress();
    const destination = await this.buildDestination(order);
    const packages = await this.buildPackages(order);

    const labelRequest = {
      origin,
      destination,
      packages,
      shipment: { type: 1, carrier, service },
      settings: { currency: 'COP', printFormat: 'PDF', printSize: 'PAPER_4X6' },
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

    // Validate delivery in Odoo (best-effort)
    try {
      const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { odooSaleOrderId: true } });
      if (order?.odooSaleOrderId) {
        const deliveryId = await this.odoo.createDelivery(order.odooSaleOrderId);
        if (deliveryId) {
          await this.prisma.order.update({ where: { id: orderId }, data: { odooDeliveryId: deliveryId } });
          this.logger.log(`Odoo delivery ${deliveryId} validated for order ${orderId}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Could not validate Odoo delivery for order ${orderId}: ${err.message}`);
    }

    // Send customer shipping email & seller push notification
    const fullOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, seller: true },
    });
    if (fullOrder?.customer?.email) {
      this.emailQueue.add('send-shipping-notification', {
        customerEmail: fullOrder.customer.email,
        customerName: fullOrder.customer.name,
        orderNumber: fullOrder.orderNumber,
        trackingNumber: labelData.trackingNumber || '',
        trackUrl: labelData.trackUrl || '',
        carrier: labelData.carrier || '',
      }).catch(() => {});
    }
    if (fullOrder?.sellerId) {
      this.notificationsService.sendToUser(
        fullOrder.sellerId,
        '📦 Pedido enviado',
        `El pedido ${fullOrder.orderNumber} fue enviado. Guía: ${labelData.trackingNumber || 'N/A'}`,
        { orderId, orderNumber: fullOrder.orderNumber, trackingNumber: labelData.trackingNumber },
        `/orders/${orderId}`,
      ).catch(() => {});
    }

    return shipment;
  }

  async trackOrder(orderId: string) {
    const order = await this.getOrderForShipping(orderId);

    if (!order.shipment?.trackingNumber) {
      throw new BadRequestException('No tracking number for this order');
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
    };
    const newStatus = statusMap[trackData?.status];
    if (newStatus && order.shipment.status !== newStatus) {
      await this.prisma.shipment.update({
        where: { orderId },
        data: { status: newStatus },
      });
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

    const origin = await this.getOriginAddress();
    const pkg = await this.getDefaultPackage();
    const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

    const response = await this.envia.schedulePickup({
      origin,
      shipment: {
        type: 1,
        carrier: order.shipment.carrier,
        pickup: {
          weightUnit: 'KG',
          totalWeight: pkg.weight * totalItems,
          totalPackages: 1,
          date,
          timeFrom,
          timeTo,
          carrier: order.shipment.carrier,
          trackingNumbers: [order.shipment.trackingNumber],
        },
      },
    });

    await this.prisma.shipment.update({
      where: { orderId },
      data: {
        pickupConfirmation: response.data?.pickupNumber != null ? String(response.data.pickupNumber) : response.data?.confirmation != null ? String(response.data.confirmation) : null,
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

    const response = await this.envia.cancelShipment(
      order.shipment.carrier,
      order.shipment.trackingNumber,
    );

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

      // Send customer delivered email & seller push notification
      const fullOrder = await this.prisma.order.findUnique({
        where: { id: shipment.orderId },
        include: { customer: true, seller: true },
      });
      if (fullOrder?.customer?.email) {
        this.emailQueue.add('send-delivered-notification', {
          customerEmail: fullOrder.customer.email,
          customerName: fullOrder.customer.name,
          orderNumber: fullOrder.orderNumber,
        }).catch(() => {});
      }
      if (fullOrder?.sellerId) {
        this.notificationsService.sendToUser(
          fullOrder.sellerId,
          '✅ Pedido entregado',
          `El pedido ${fullOrder?.orderNumber} fue entregado exitosamente al cliente.`,
        ).catch(() => {});
      }
    }

    this.logger.log(`Webhook processed: ${trackingNumber} → ${shipmentStatus}`);
  }

  async listCarriers() {
    return this.envia.listCarriers('CO');
  }
}
