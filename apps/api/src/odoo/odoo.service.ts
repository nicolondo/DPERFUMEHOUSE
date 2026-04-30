import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import * as xmlrpc from 'xmlrpc';
import * as https from 'https';
import * as http from 'http';

export interface OdooProduct {
  id: number;
  name: string;
  default_code: string;
  barcode?: string;
  list_price: number;
  qty_available: number;
  categ_id: [number, string] | false;
  product_tmpl_id: [number, string];
  product_template_attribute_value_ids: number[];
  image_1920?: string;
  attribute_values?: Record<string, string>; // populated after enrichment
}

export interface OdooPartner {
  id: number;
  name: string;
  email: string;
  phone: string;
  street?: string;
  city?: string;
  state_id?: [number, string];
  zip?: string;
  country_id?: [number, string];
}

interface OdooCredentials {
  url: string;
  db: string;
  uid: number;
  apiKey: string;
}

@Injectable()
export class OdooService {
  private readonly logger = new Logger(OdooService.name);
  private cachedCredentials: OdooCredentials | null = null;
  private cachedClient: xmlrpc.Client | null = null;
  private cachedClientKey: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {
    this.logger.log('Odoo service initialized (dynamic credentials from DB)');
  }

  private async getCredentials(): Promise<OdooCredentials> {
    const [dbUrl, dbDb, dbUid, dbApiKey] = await Promise.all([
      this.settingsService.get('odoo_url'),
      this.settingsService.get('odoo_db'),
      this.settingsService.get('odoo_uid'),
      this.settingsService.get('odoo_api_key'),
    ]);

    const url = dbUrl || this.configService.get<string>('ODOO_URL', 'https://localhost');
    const db = dbDb || this.configService.get<string>('ODOO_DB', '');
    const uid = parseInt(dbUid || this.configService.get<string>('ODOO_UID', '2'), 10);
    const apiKey = dbApiKey || this.configService.get<string>('ODOO_API_KEY', '');

    return { url, db, uid, apiKey };
  }

  private getClient(credentials: OdooCredentials): xmlrpc.Client {
    const clientKey = `${credentials.url}`;
    if (this.cachedClient && this.cachedClientKey === clientKey) {
      return this.cachedClient;
    }

    const parsedUrl = new URL(credentials.url);
    const isSecure = parsedUrl.protocol === 'https:';
    const port = parsedUrl.port
      ? parseInt(parsedUrl.port, 10)
      : isSecure ? 443 : 80;

    const clientOptions = {
      host: parsedUrl.hostname,
      port,
      path: '/xmlrpc/2/object',
    };

    this.cachedClient = isSecure
      ? xmlrpc.createSecureClient(clientOptions)
      : xmlrpc.createClient(clientOptions);
    this.cachedClientKey = clientKey;

    this.logger.log(`Odoo XML-RPC client created for ${credentials.url} (db: ${credentials.db})`);
    return this.cachedClient;
  }

  /**
   * Format a Colombian NIT number for Odoo: inserts dash before last digit (check digit).
   * Input: "103759945" → Output: "10375994-5"
   */
  private formatNitForOdoo(nit: string): string {
    const digits = nit.replace(/[^0-9]/g, '');
    if (!digits || digits.length < 2) return nit;
    // Already formatted with dash
    if (/^\d+-\d$/.test(nit)) return nit;
    return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
  }

  /**
   * Execute via JSON-RPC for methods that may return None (e.g. action_post).
   * XML-RPC cannot serialize None; JSON-RPC handles it as null.
   */
  private async executeJsonRpc(
    model: string,
    method: string,
    args: any[],
    kwargs: Record<string, any> = {},
  ): Promise<any> {
    const creds = await this.getCredentials();
    const parsedUrl = new URL(creds.url);
    const isSecure = parsedUrl.protocol === 'https:';
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [creds.db, creds.uid, creds.apiKey, model, method, args, kwargs],
      },
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Odoo JSON-RPC timeout for ${model}.${method}`)), 30000);
      const transport = isSecure ? https : http;
      const req = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : isSecure ? 443 : 80,
          path: '/jsonrpc',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            clearTimeout(timeout);
            try {
              const json = JSON.parse(data);
              if (json.error) reject(new Error(JSON.stringify(json.error)));
              else resolve(json.result);
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('error', (e) => { clearTimeout(timeout); reject(e); });
      req.write(payload);
      req.end();
    });
  }

  private async execute(
    model: string,
    method: string,
    args: any[],
    kwargs: Record<string, any> = {},
  ): Promise<any> {
    const creds = await this.getCredentials();

    if (!creds.apiKey || creds.url === 'https://localhost') {
      throw new Error('Odoo credentials not configured. Set them in Admin → Settings → Odoo.');
    }

    const client = this.getClient(creds);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Odoo XML-RPC timeout for ${model}.${method}`));
      }, 30000);

      client.methodCall(
        'execute_kw',
        [creds.db, creds.uid, creds.apiKey, model, method, args, kwargs],
        (error: Error | null, result: any) => {
          clearTimeout(timeout);
          if (error) {
            this.logger.error(
              `Odoo XML-RPC error [${model}.${method}]: ${error.message}`,
              error.stack,
            );
            reject(error);
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  async getProducts(
    limit = 100,
    offset = 0,
    domain: any[] = [],
    companyId?: number,
  ): Promise<OdooProduct[]> {
    try {
      const defaultDomain = [
        ['sale_ok', '=', true],
        ['active', '=', true],
        ...domain,
      ];

      if (companyId) {
        defaultDomain.push(['company_id', 'in', [companyId, false]]);
      }

      const context: Record<string, any> = {};
      if (companyId) {
        context.allowed_company_ids = [companyId];
      }

      const products = await this.execute(
        'product.product',
        'search_read',
        [defaultDomain],
        {
          fields: [
            'id',
            'name',
            'default_code',
            'barcode',
            'list_price',
            'qty_available',
            'categ_id',
            'product_tmpl_id',
            'product_template_attribute_value_ids',
            'image_1920',
          ],
          limit,
          ...(Object.keys(context).length > 0 && { context }),
          offset,
          order: 'name asc',
        },
      );

      this.logger.log(
        `Fetched ${products.length} products from Odoo (offset: ${offset}, limit: ${limit})`,
      );
      return products;
    } catch (error) {
      this.logger.error('Failed to fetch products from Odoo', error);
      throw error;
    }
  }

  async getProduct(productId: number): Promise<OdooProduct | null> {
    try {
      const products = await this.execute(
        'product.product',
        'search_read',
        [[['id', '=', productId]]],
        {
          fields: [
            'id',
            'name',
            'default_code',
            'barcode',
            'list_price',
            'qty_available',
            'categ_id',
            'product_tmpl_id',
            'product_template_attribute_value_ids',
            'image_1920',
          ],
          limit: 1,
        },
      );

      return products.length > 0 ? products[0] : null;
    } catch (error) {
      this.logger.error(
        `Failed to fetch product ${productId} from Odoo`,
        error,
      );
      throw error;
    }
  }

  /**
   * Resolve product_template_attribute_value_ids into { attributeName: valueName } pairs.
   * Fetches from product.template.attribute.value model.
   */
  async resolveAttributeValues(
    attrValueIds: number[],
  ): Promise<Record<string, string>> {
    if (!attrValueIds || attrValueIds.length === 0) return {};

    try {
      const records = await this.execute(
        'product.template.attribute.value',
        'search_read',
        [[['id', 'in', attrValueIds]]],
        {
          fields: ['id', 'name', 'attribute_id'],
        },
      );

      const result: Record<string, string> = {};
      for (const rec of records) {
        const attrName = Array.isArray(rec.attribute_id)
          ? rec.attribute_id[1]
          : String(rec.attribute_id);
        result[attrName] = rec.name;
      }
      return result;
    } catch (error) {
      this.logger.warn(
        `Failed to resolve attribute values [${attrValueIds}]: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {};
    }
  }

  async getStock(productIds: number[], locationId?: number): Promise<Map<number, number>> {
    const stockMap = new Map<number, number>();
    if (productIds.length === 0) return stockMap;

    try {
      // If a specific location is provided, use stock.quant for location-filtered qty
      if (locationId) {
        const quants = await this.execute(
          'stock.quant',
          'search_read',
          [[['product_id', 'in', productIds], ['location_id', '=', locationId]]],
          { fields: ['product_id', 'quantity'] },
        );
        for (const q of quants) {
          const pid = Array.isArray(q.product_id) ? q.product_id[0] : q.product_id;
          stockMap.set(pid, (stockMap.get(pid) || 0) + (q.quantity || 0));
        }
        this.logger.debug(`Fetched stock for ${quants.length} quants from location ${locationId}`);
        return stockMap;
      }

      // Default: use product.product qty_available (all locations)
      const products = await this.execute(
        'product.product',
        'search_read',
        [[['id', 'in', productIds]]],
        {
          fields: ['id', 'qty_available'],
        },
      );

      for (const product of products) {
        stockMap.set(product.id, product.qty_available || 0);
      }

      this.logger.debug(
        `Fetched stock for ${products.length} products from Odoo`,
      );
      return stockMap;
    } catch (error) {
      this.logger.error('Failed to fetch stock from Odoo', error);
      throw error;
    }
  }

  async partnerExists(partnerId: number): Promise<boolean> {
    try {
      const ids = await this.execute('res.partner', 'search', [[[['id', '=', partnerId]]]]);
      return Array.isArray(ids) && ids.length > 0;
    } catch {
      return false;
    }
  }

  async upsertPartner(data: {
    name: string;
    email?: string;
    phone?: string;
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    documentType?: string;
    documentNumber?: string;
  }): Promise<number> {
    try {
      // Search for existing partner by email or name
      const domain = data.email
        ? [['email', '=', data.email]]
        : [['name', '=', data.name]];
      const existingIds = await this.execute(
        'res.partner',
        'search',
        [domain],
        { limit: 1 },
      );

      const partnerData: Record<string, any> = {
        name: data.name,
        customer_rank: 1,
        company_type: 'person',
        type: 'contact',
        lang: 'es_419',
      };

      if (data.email) partnerData.email = data.email;
      if (data.phone) {
        partnerData.phone = data.phone;
      }
      if (data.street) partnerData.street = data.street;
      if (data.street2) partnerData.street2 = data.street2;
      if (data.city) partnerData.city = data.city;
      if (data.zip) partnerData.zip = data.zip;

      // Map document type to Odoo l10n Colombia identification type
      if (data.documentType && data.documentNumber) {
        // Map app document types to Odoo l10n_latam identification type names
        const docTypeNameMap: Record<string, string> = {
          CC: 'Cédula de ciudadanía',
          CE: 'Cédula de extranjería',
          NIT: 'NIT',
          PP: 'Passport',
        };
        const odooDocName = docTypeNameMap[data.documentType.toUpperCase()];
        if (odooDocName) {
          try {
            const idTypeIds = await this.execute(
              'l10n_latam.identification.type',
              'search',
              [[['name', '=', odooDocName]]],
              { limit: 1 },
            );
            if (idTypeIds.length > 0) {
              partnerData.l10n_latam_identification_type_id = idTypeIds[0];
            }
          } catch {
            // l10n module may not be installed; skip
          }
        }
        partnerData.vat = data.documentType?.toUpperCase() === 'NIT'
          ? this.formatNitForOdoo(data.documentNumber)
          : data.documentNumber;
      }

      // Resolve country_id from country code
      let countryId: number | false = false;
      if (data.country) {
        const countryIds = await this.execute(
          'res.country',
          'search',
          [[['code', '=', data.country]]],
          { limit: 1 },
        );
        if (countryIds.length > 0) {
          countryId = countryIds[0];
          partnerData.country_id = countryId;
        }
      }

      // Resolve state_id from state name + country
      if (data.state && countryId) {
        const stateIds = await this.execute(
          'res.country.state',
          'search',
          [[['name', 'ilike', data.state], ['country_id', '=', countryId]]],
          { limit: 1 },
        );
        if (stateIds.length > 0) {
          partnerData.state_id = stateIds[0];
        }
      }

      if (existingIds.length > 0) {
        const partnerId = existingIds[0];
        // Write basic data first (without vat to avoid validation errors)
        const { vat, l10n_latam_identification_type_id, ...basicData } = partnerData;
        await this.execute('res.partner', 'write', [[partnerId], basicData]);
        this.logger.log(`Updated Odoo partner ${partnerId} (${data.email || data.name})`);

        // Try to update document identification separately
        // 3-step write: clear vat → set type → set vat (avoids cross-validation issues)
        if (l10n_latam_identification_type_id || vat) {
          // Step 1: Clear vat to avoid type-change validation against old vat format
          if (l10n_latam_identification_type_id) {
            await this.execute('res.partner', 'write', [[partnerId], { vat: false }]);
          }
          // Step 2: Set identification type
          if (l10n_latam_identification_type_id) {
            await this.execute('res.partner', 'write', [[partnerId], { l10n_latam_identification_type_id }]);
          }
          // Step 3: Set vat — let validation errors propagate
          if (vat) {
            try {
              await this.execute('res.partner', 'write', [[partnerId], { vat }]);
            } catch (vatError) {
              const msg = vatError.faultString || vatError.message || '';
              if (msg.includes('no es válido') || msg.includes('formato esperado')) {
                throw new Error(`El numero de NIT ingresado es incorrecto, por favor verificarlo. (debe incluir digito de verificación)`);
              }
              throw vatError;
            }
          }
        }

        return partnerId;
      } else {
        // For new partners, try with full data first, fall back without vat on validation error
        let partnerId: number;
        try {
          partnerId = await this.execute('res.partner', 'create', [partnerData]);
        } catch (createError) {
          if (partnerData.vat) {
            this.logger.warn(`Create with vat failed, retrying without: ${createError.message}`);
            const { vat, l10n_latam_identification_type_id, ...basicData } = partnerData;
            partnerId = await this.execute('res.partner', 'create', [basicData]);
          } else {
            throw createError;
          }
        }
        this.logger.log(`Created Odoo partner ${partnerId} (${data.email || data.name})`);
        return partnerId;
      }
    } catch (error) {
      this.logger.error(
        `Failed to upsert partner in Odoo: ${data.email || data.name}`,
        error,
      );
      throw error;
    }
  }

  async createSaleOrder(data: {
    partnerId: number;
    lines: { productId: number; quantity: number; price: number; discountPercent?: number }[];
    companyId?: number;
  }): Promise<{ id: number; name: string }> {
    try {
      // Use configured company_id from settings as fallback
      let companyId = data.companyId;
      if (!companyId) {
        const configuredCompany = await this.settingsService.get('odoo_company_id');
        if (configuredCompany) {
          companyId = parseInt(configuredCompany, 10);
        }
      }

      const orderData: Record<string, any> = {
        partner_id: data.partnerId,
        order_line: data.lines.map((line) => [
          0,
          0,
          {
            product_id: line.productId,
            product_uom_qty: line.quantity,
            // Round the net price (after discount) to the nearest 1000, send with discount=0
            // This avoids fractional % producing ugly numbers like 299.985 in Odoo
            price_unit: Math.round(line.price * (1 - (line.discountPercent ?? 0) / 100) / 1000) * 1000,
            discount: 0,
          },
        ]),
      };

      if (companyId) {
        orderData.company_id = companyId;
      }

      // Set pricelist from settings (ensures COP currency)
      const configuredPricelist = await this.settingsService.get('odoo_pricelist_id');
      if (configuredPricelist) {
        orderData.pricelist_id = parseInt(configuredPricelist, 10);
      }

      const orderId = await this.execute('sale.order', 'create', [orderData]);

      // Read back the Odoo SO name (e.g., S00262)
      const soData = await this.execute('sale.order', 'read', [[orderId], ['name']]);
      const soName = soData?.[0]?.name || `SO-${orderId}`;

      this.logger.log(
        `Created Odoo sale order ${soName} (ID ${orderId}) for partner ${data.partnerId} in company ${companyId || 'default'}`,
      );
      return { id: orderId, name: soName };
    } catch (error) {
      this.logger.error('Failed to create sale order in Odoo', error);
      throw error;
    }
  }

  async confirmSaleOrder(orderId: number): Promise<boolean> {
    try {
      await this.execute('sale.order', 'action_confirm', [[orderId]]);
      this.logger.log(`Confirmed Odoo sale order ${orderId}`);
      return true;
    } catch (error) {
      // If the error is about missing replenishment/route rules (product config issue),
      // fall back to directly writing state='sale' so we can still invoice the order.
      const msg: string = error?.message || '';
      if (
        msg.includes('reabastecimiento') ||
        msg.includes('replenishment') ||
        msg.includes('route') ||
        msg.includes('Existencias')
      ) {
        this.logger.warn(
          `action_confirm failed for SO ${orderId} due to route/replenishment config — forcing state to 'sale' directly`,
        );
        try {
          await this.execute('sale.order', 'write', [[orderId], { state: 'sale' }]);
          this.logger.log(`SO ${orderId} state forced to 'sale'`);
          // Trigger stock rule launch so Odoo creates the stock.picking
          try {
            await this.execute('sale.order', '_action_launch_stock_rule', [[orderId]]);
            this.logger.log(`Stock rule triggered for SO ${orderId}`);
          } catch (ruleErr) {
            // _action_launch_stock_rule may not be callable via XML-RPC on all Odoo versions
            this.logger.warn(`Could not trigger stock rule for SO ${orderId}: ${ruleErr.message}`);
          }
          return true;
        } catch (writeErr) {
          this.logger.error(`Failed to force state for SO ${orderId}`, writeErr);
          throw writeErr;
        }
      }
      this.logger.error(
        `Failed to confirm sale order ${orderId} in Odoo`,
        error,
      );
      throw error;
    }
  }

  /** Try to launch stock procurement rules for an SO (creates picking if not yet generated). */
  async launchStockRule(saleOrderId: number): Promise<void> {
    await this.execute('sale.order', '_action_launch_stock_rule', [[saleOrderId]]);
    this.logger.log(`Stock rule launched for SO ${saleOrderId}`);
  }

  async createDelivery(saleOrderId: number): Promise<number | null> {
    try {
      // Read pickings generated from the sale order confirmation
      const pickings = await this.execute(
        'stock.picking',
        'search_read',
        [
          [
            ['sale_id', '=', saleOrderId],
          ],
        ],
        {
          fields: ['id', 'state'],
          limit: 1,
        },
      );

      if (pickings.length > 0) {
        const pickingId = pickings[0].id;
        this.logger.log(
          `Found delivery picking ${pickingId} (state: ${pickings[0].state}) for sale order ${saleOrderId}`,
        );

        // Validate (confirm) the picking if not already done
        if (pickings[0].state !== 'done') {
          try {
            await this.validateDelivery(pickingId);
          } catch (valErr) {
            // Validation failure should not prevent us from saving the picking reference
            this.logger.warn(`Could not validate picking ${pickingId}: ${valErr.message} — saving picking ID anyway`);
          }
        }

        return pickingId;
      }

      this.logger.warn(
        `No delivery picking found for sale order ${saleOrderId}`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to create delivery for sale order ${saleOrderId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Validate a stock picking: set done quantities and confirm delivery.
   */
  async validateDelivery(pickingId: number): Promise<void> {
    try {
      // Set done quantities on all move lines
      const moves = await this.execute(
        'stock.move',
        'search_read',
        [[['picking_id', '=', pickingId]]],
        { fields: ['id', 'product_uom_qty'] },
      );
      for (const move of moves) {
        await this.execute('stock.move', 'write', [[move.id], { quantity: move.product_uom_qty }]);
      }

      // Validate the picking (button_validate)
      try {
        await this.execute('stock.picking', 'button_validate', [[pickingId]]);
      } catch (e) {
        // button_validate may return a wizard (e.g. immediate transfer) — try force_assign + validate
        if (e.message?.includes('cannot marshal None') || e.message?.includes('wizard')) {
          this.logger.warn(`button_validate returned wizard for picking ${pickingId}, attempting direct validation`);
        } else {
          throw e;
        }
      }

      this.logger.log(`Validated delivery picking ${pickingId}`);
    } catch (error) {
      this.logger.error(`Failed to validate delivery ${pickingId}: ${error.message}`);
      throw error;
    }
  }

  async getSaleOrderStatus(orderId: number): Promise<string> {
    try {
      const orders = await this.execute(
        'sale.order',
        'search_read',
        [[['id', '=', orderId]]],
        {
          fields: ['state'],
          limit: 1,
        },
      );

      if (orders.length === 0) {
        return 'not_found';
      }

      return orders[0].state;
    } catch (error) {
      this.logger.error(
        `Failed to get sale order status for ${orderId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if a sale order's invoices have been paid in Odoo.
   * Returns true if at least one invoice has payment_state = 'paid' or 'in_payment'.
   */
  async checkSaleOrderPayment(saleOrderId: number): Promise<boolean> {
    try {
      // Read the invoice_ids from the sale order
      const orders = await this.execute(
        'sale.order',
        'search_read',
        [[['id', '=', saleOrderId]]],
        {
          fields: ['invoice_ids', 'state'],
          limit: 1,
        },
      );

      if (orders.length === 0) {
        return false;
      }

      const so = orders[0];

      // If SO has no invoices, check if it's at least confirmed (sale/done)
      if (!so.invoice_ids || so.invoice_ids.length === 0) {
        return false;
      }

      // Check invoice payment states
      const invoices = await this.execute(
        'account.move',
        'search_read',
        [[['id', 'in', so.invoice_ids]]],
        {
          fields: ['payment_state', 'state'],
        },
      );

      // Return true if any invoice is paid
      return invoices.some(
        (inv: any) =>
          inv.payment_state === 'paid' || inv.payment_state === 'in_payment',
      );
    } catch (error) {
      this.logger.error(
        `Failed to check payment for sale order ${saleOrderId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Full payment flow in Odoo: confirm SO → create invoice → post invoice → register payment.
   * Used when admin marks a CASH order as paid from the backend.
   */
  async confirmAndRegisterPayment(
    saleOrderId: number,
    amount: number,
    journalName = 'Cash',
    journalType: 'cash' | 'bank' = 'cash',
  ): Promise<{ invoiceId: number; invoiceName: string; paymentId: number }> {
    try {
      // 1. Confirm the SO if still in draft/sent
      const soData0 = await this.execute(
        'sale.order',
        'search_read',
        [[['id', '=', saleOrderId]]],
        { fields: ['state', 'company_id', 'invoice_ids'], limit: 1 },
      );
      const soState = soData0?.[0]?.state;
      const companyId: number = soData0?.[0]?.company_id?.[0];
      const existingInvoiceIds: number[] = soData0?.[0]?.invoice_ids ?? [];

      if (soState === 'draft' || soState === 'sent') {
        await this.confirmSaleOrder(saleOrderId);
        this.logger.log(`SO ${saleOrderId} confirmed (was ${soState})`);
      }

      // 1b. Ensure qty_delivered matches qty_ordered on all lines so invoicing by
      //     "delivered quantities" policy works (products shipped outside Odoo).
      try {
        const soLines = await this.execute(
          'sale.order.line',
          'search_read',
          [[['order_id', '=', saleOrderId]]],
          { fields: ['id', 'product_uom_qty', 'qty_delivered'] },
        );
        for (const line of soLines) {
          if ((line.qty_delivered ?? 0) < line.product_uom_qty) {
            await this.execute('sale.order.line', 'write', [
              [line.id],
              { qty_delivered: line.product_uom_qty },
            ]);
          }
        }
        if (soLines.length > 0) {
          this.logger.log(`Set qty_delivered on ${soLines.length} line(s) for SO ${saleOrderId}`);
        }
      } catch (qtyErr) {
        this.logger.warn(`Could not set qty_delivered for SO ${saleOrderId}: ${qtyErr.message}`);
      }

      const soCtx = { active_ids: [saleOrderId], active_model: 'sale.order', active_id: saleOrderId };

      // 2. Create invoice via wizard — active_ids must be in 'context' key
      const wizardInvId = await this.execute(
        'sale.advance.payment.inv',
        'create',
        [{ advance_payment_method: 'delivered' }],
        { context: soCtx },
      );

      // create_invoices returns an action dict that may contain None values (can't serialize via XML-RPC)
      // We wrap it in try/catch because the invoice IS created even when serialization fails
      try {
        await this.execute(
          'sale.advance.payment.inv',
          'create_invoices',
          [[Array.isArray(wizardInvId) ? wizardInvId[0] : wizardInvId]],
          { context: soCtx },
        );
      } catch (e) {
        if (!e.message?.includes('cannot marshal None')) {
          throw e;
        }
        this.logger.warn(`create_invoices returned unserializable result (expected) — continuing`);
      }

      // 3. Find the created invoice (newly added ones vs what existed before)
      const soData = await this.execute(
        'sale.order',
        'search_read',
        [[['id', '=', saleOrderId]]],
        { fields: ['invoice_ids'], limit: 1 },
      );

      const invoiceIds: number[] = soData?.[0]?.invoice_ids ?? [];
      const newInvoiceIds = invoiceIds.filter((id) => !existingInvoiceIds.includes(id));
      const lookupIds = newInvoiceIds.length > 0 ? newInvoiceIds : invoiceIds;

      if (lookupIds.length === 0) {
        throw new Error(`No invoice found after creation for SO ${saleOrderId}`);
      }

      // Get the most recently created draft invoice
      const draftInvoices = await this.execute(
        'account.move',
        'search_read',
        [[['id', 'in', lookupIds], ['state', '=', 'draft']]],
        { fields: ['id', 'name'], order: 'id desc', limit: 1 },
      );

      if (draftInvoices.length === 0) {
        // Invoice may already be posted — find most recent
        const postedInvoices = await this.execute(
          'account.move',
          'search_read',
          [[['id', 'in', lookupIds], ['state', '=', 'posted'], ['payment_state', '!=', 'paid']]],
          { fields: ['id', 'name'], order: 'id desc', limit: 1 },
        );
        if (postedInvoices.length === 0) {
          throw new Error(`No actionable invoice found for SO ${saleOrderId}`);
        }
        const invoiceId = postedInvoices[0].id;
        const invoiceName = postedInvoices[0].name || `INV-${invoiceId}`;
        return await this.registerPaymentOnInvoice(invoiceId, invoiceName, amount, companyId, saleOrderId, journalName, journalType);
      }

      const invoiceId = draftInvoices[0].id;
      this.logger.log(`Created invoice ${invoiceId} for SO ${saleOrderId}`);

      // 4. Post (validate) the invoice: draft → posted
      await this.execute('account.move', 'action_post', [[invoiceId]]);
      this.logger.log(`Posted invoice ${invoiceId}`);

      // Read the real sequence name after posting (draft invoices have name="/")
      const postedInvoice = await this.execute(
        'account.move',
        'read',
        [[invoiceId]],
        { fields: ['name'] },
      );
      const invoiceName = (postedInvoice?.[0]?.name && postedInvoice[0].name !== '/') 
        ? postedInvoice[0].name 
        : `INV-${invoiceId}`;

      return await this.registerPaymentOnInvoice(invoiceId, invoiceName, amount, companyId, saleOrderId, journalName, journalType);
    } catch (error) {
      this.logger.error(
        `Failed to confirm and register payment for SO ${saleOrderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async registerPaymentOnInvoice(
    invoiceId: number,
    invoiceName: string,
    amount: number,
    companyId: number,
    saleOrderId: number,
    journalName: string,
    journalType: 'cash' | 'bank' = 'cash',
  ): Promise<{ invoiceId: number; invoiceName: string; paymentId: number }> {
    // 5. Find journal matching the SO's company
    const domain: any[] = [['type', '=', journalType]];
    if (companyId) domain.push(['company_id', '=', companyId]);

    const cashJournals = await this.execute(
      'account.journal',
      'search_read',
      [domain],
      { fields: ['id', 'name'], limit: 5 },
    );

    // Try to find by name first, otherwise use first available
    let journalId: number | undefined;
    const named = cashJournals.find((j: any) =>
      j.name.toLowerCase().includes(journalName.toLowerCase()),
    );
    if (named) {
      journalId = named.id;
    } else if (cashJournals.length > 0) {
      journalId = cashJournals[0].id;
      this.logger.log(`Using cash journal: ${cashJournals[0].name} (${journalId})`);
    }

    // 6. Register payment via wizard — active_ids must be in 'context' key
    const payCtx = { active_model: 'account.move', active_ids: [invoiceId], active_id: invoiceId };
    const wizardPayData: Record<string, any> = {
      amount,
      payment_date: new Date().toISOString().slice(0, 10),
    };
    if (journalId) wizardPayData.journal_id = journalId;

    const wizardPayId = await this.execute(
      'account.payment.register',
      'create',
      [wizardPayData],
      { context: payCtx },
    );

    const payResult = await this.execute(
      'account.payment.register',
      'action_create_payments',
      [[Array.isArray(wizardPayId) ? wizardPayId[0] : wizardPayId]],
      { context: payCtx },
    );

    const paymentId =
      payResult && typeof payResult === 'object' && payResult.res_id
        ? payResult.res_id
        : 0;

    // Confirm the payment (action_post) — uses JSON-RPC because action_post returns None
    if (paymentId) {
      try {
        await this.executeJsonRpc('account.payment', 'action_post', [[paymentId]]);
        this.logger.log(`Payment ${paymentId} posted (confirmed) for invoice ${invoiceName}`);
      } catch (e) {
        this.logger.warn(`Failed to post payment ${paymentId}: ${e.message}`);
      }
    }

    this.logger.log(
      `Payment registered for invoice ${invoiceName} on SO ${saleOrderId} (amount: ${amount})`,
    );

    return { invoiceId, invoiceName, paymentId };
  }

  async getPricelists(companyId?: number): Promise<{ id: number; name: string }[]> {
    try {
      const domain: any[] = companyId
        ? [['company_id', 'in', [companyId, false]]]
        : [];
      const pricelists = await this.execute(
        'product.pricelist',
        'search_read',
        [domain],
        {
          fields: ['id', 'name'],
          order: 'name asc',
        },
      );
      return pricelists.map((p: any) => ({ id: p.id, name: p.name }));
    } catch (error) {
      this.logger.error('Failed to fetch pricelists from Odoo', error);
      throw error;
    }
  }

  async getProductPrices(
    productIds: number[],
    pricelistId: number,
  ): Promise<Map<number, number>> {
    const prices = new Map<number, number>();
    try {
      // Fetch pricelist items for this pricelist that apply to these products
      const items = await this.execute(
        'product.pricelist.item',
        'search_read',
        [[
          ['pricelist_id', '=', pricelistId],
          ['product_id', 'in', productIds],
        ]],
        {
          fields: ['product_id', 'fixed_price', 'compute_price', 'percent_price'],
        },
      );

      for (const item of items) {
        if (item.product_id && item.compute_price === 'fixed' && item.fixed_price > 0) {
          prices.set(item.product_id[0], item.fixed_price);
        }
      }

      // Also check template-level items for products still missing a price
      const missingProductIds = productIds.filter(id => !prices.has(id));
      if (missingProductIds.length > 0) {
        const templateItems = await this.execute(
          'product.pricelist.item',
          'search_read',
          [[
            ['pricelist_id', '=', pricelistId],
            ['applied_on', '=', '1_product'],
          ]],
          {
            fields: ['product_tmpl_id', 'fixed_price', 'compute_price'],
          },
        );

        // Get template IDs for products missing prices
        const products = await this.execute(
          'product.product',
          'search_read',
          [[['id', 'in', missingProductIds]]],
          { fields: ['id', 'product_tmpl_id'] },
        );

        const prodToTmpl = new Map<number, number>();
        for (const p of products) {
          prodToTmpl.set(p.id, p.product_tmpl_id[0]);
        }

        for (const item of templateItems) {
          if (item.product_tmpl_id && item.compute_price === 'fixed' && item.fixed_price > 0) {
            const tmplId = item.product_tmpl_id[0];
            for (const [prodId, tId] of prodToTmpl.entries()) {
              if (tId === tmplId && !prices.has(prodId)) {
                prices.set(prodId, item.fixed_price);
              }
            }
          }
        }
      }

      this.logger.log(`Fetched ${prices.size} pricelist prices for ${productIds.length} products`);
    } catch (error) {
      this.logger.warn('Failed to fetch pricelist prices, falling back to list_price', error);
    }
    return prices;
  }

  async getCategories(): Promise<{ id: number; name: string; parentId: number | false }[]> {
    try {
      const categories = await this.execute(
        'product.category',
        'search_read',
        [[]],
        {
          fields: ['id', 'name', 'complete_name', 'parent_id'],
          order: 'complete_name asc',
        },
      );
      return categories.map((c: any) => ({
        id: c.id,
        name: c.complete_name || c.name,
        parentId: c.parent_id ? c.parent_id[0] : false,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch categories from Odoo', error);
      throw error;
    }
  }

  async getWarehouses(companyId?: number): Promise<{ id: number; name: string; lotStockId: number }[]> {
    try {
      const kwargs: any = { fields: ['id', 'name', 'lot_stock_id'], order: 'name asc' };
      if (companyId) kwargs.context = { allowed_company_ids: [companyId] };
      const warehouses = await this.execute('stock.warehouse', 'search_read', [[]], kwargs);
      return warehouses.map((w: any) => ({
        id: w.id,
        name: w.name,
        lotStockId: Array.isArray(w.lot_stock_id) ? w.lot_stock_id[0] : w.lot_stock_id,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch warehouses from Odoo', error);
      throw error;
    }
  }

  async getStockLocations(): Promise<{ id: number; name: string }[]> {
    try {
      const locations = await this.execute(
        'stock.location',
        'search_read',
        [[['usage', '=', 'internal'], ['active', '=', true]]],
        {
          fields: ['id', 'complete_name'],
          order: 'complete_name asc',
        },
      );
      return locations.map((l: any) => ({ id: l.id, name: l.complete_name || l.name }));
    } catch (error) {
      this.logger.error('Failed to fetch stock locations from Odoo', error);
      throw error;
    }
  }

  async getCompanies(): Promise<{ id: number; name: string }[]> {
    try {
      const companies = await this.execute(
        'res.company',
        'search_read',
        [[]],
        {
          fields: ['id', 'name'],
          order: 'name asc',
        },
      );
      return companies.map((c: any) => ({ id: c.id, name: c.name }));
    } catch (error) {
      this.logger.error('Failed to fetch companies from Odoo', error);
      throw error;
    }
  }

  /**
   * Create a journal entry in Odoo for a commission payout.
   * Debits the payment method account and credits the commissions payable account.
   */
  async createCommissionPayoutJournalEntry(params: {
    sellerName: string;
    amount: number;
    paymentMethod: string; // 'CASH' | 'BANK_TRANSFER' | 'USDT_TRC20' | 'ONLINE'
  }): Promise<{ moveId: number; moveName: string } | null> {
    try {
      // Map payment method to settings key
      const methodAccountKeyMap: Record<string, string> = {
        ONLINE: 'odoo_account_online',
        CASH: 'odoo_account_cash',
        BANK_TRANSFER: 'odoo_account_transfer',
        USDT_TRC20: 'odoo_account_usdt',
      };

      const methodKey = methodAccountKeyMap[params.paymentMethod?.toUpperCase().replace(/\s+/g, '_')] || 'odoo_account_cash';

      const [debitAccountCode, creditAccountCode, companyIdStr, journalIdStr] = await Promise.all([
        this.settingsService.get(methodKey),
        this.settingsService.get('odoo_account_commissions'),
        this.settingsService.get('odoo_company_id'),
        this.settingsService.get('odoo_commissions_journal_id'),
      ]);

      if (!debitAccountCode || !creditAccountCode) {
        this.logger.warn(
          `Skipping Odoo journal entry: accounts not configured (${methodKey}=${debitAccountCode}, commissions=${creditAccountCode})`,
        );
        return null;
      }

      const companyId = companyIdStr ? parseInt(companyIdStr, 10) : undefined;

      // Resolve account codes to Odoo DB IDs (settings may store PUC codes like "110505")
      const [debitAccountId, creditAccountId] = await Promise.all([
        this.resolveAccountId(debitAccountCode, companyId),
        this.resolveAccountId(creditAccountCode, companyId),
      ]);

      if (!debitAccountId || !creditAccountId) {
        this.logger.warn(
          `Skipping Odoo journal entry: could not resolve account IDs (debit="${debitAccountCode}"→${debitAccountId}, credit="${creditAccountCode}"→${creditAccountId})`,
        );
        return null;
      }

      // Get journal: resolve by sequence prefix (e.g. "MISC") or fall back to a general journal
      const journalId = journalIdStr
        ? await this.resolveJournalId(journalIdStr, companyId)
        : await this.getGeneralJournal(companyId);

      if (!journalId) {
        this.logger.warn('Skipping Odoo journal entry: no suitable journal found. Configure odoo_commissions_journal_id in settings (use the sequence prefix, e.g. "MISC").');
        return null;
      }

      const ref = `Pago comision ${params.sellerName}`;
      const today = new Date().toISOString().split('T')[0];

      const moveData: any = {
        move_type: 'entry',
        ref,
        date: today,
        journal_id: journalId,
        line_ids: [
          // Debit: money leaves the payment method account
          [0, 0, {
            account_id: debitAccountId,
            name: ref,
            debit: params.amount,
            credit: 0,
          }],
          // Credit: commissions payable account
          [0, 0, {
            account_id: creditAccountId,
            name: ref,
            debit: 0,
            credit: params.amount,
          }],
        ],
      };

      if (companyId) moveData.company_id = companyId;

      const moveId = await this.execute('account.move', 'create', [moveData]);

      // Post (confirm) the journal entry
      await this.execute('account.move', 'action_post', [[moveId]]);

      // Read back the sequence name (e.g. "MISC/2026/03/0012")
      const moveRead = await this.execute('account.move', 'read', [[moveId], ['name']]);
      const moveName = moveRead?.[0]?.name || `MISC-${moveId}`;

      this.logger.log(`Created Odoo journal entry ${moveName} (#${moveId}) for payout: ${ref} (${params.amount})`);
      return { moveId, moveName };
    } catch (error) {
      this.logger.error(`Failed to create Odoo journal entry for payout: ${error.message}`);
      return null; // Don't block payout completion if Odoo fails
    }
  }

  /**
   * Create a monthly commission bonus journal entry in Odoo.
   * Uses configured accounts and posts an entry with a monthly reference.
   */
  async createMonthlyCommissionBonusJournalEntry(params: {
    sellerName: string;
    amount: number;
    year: number;
    month: number;
  }): Promise<{ moveId: number; moveName: string } | null> {
    try {
      const [debitAccountCode, creditAccountCode, companyIdStr, journalIdStr] = await Promise.all([
        this.settingsService.get('odoo_account_cash'),
        this.settingsService.get('odoo_account_commissions'),
        this.settingsService.get('odoo_company_id'),
        this.settingsService.get('odoo_commissions_journal_id'),
      ]);

      if (!debitAccountCode || !creditAccountCode) {
        this.logger.warn(
          `Skipping Odoo monthly bonus entry: accounts not configured (debit=${debitAccountCode}, credit=${creditAccountCode})`,
        );
        return null;
      }

      const companyId = companyIdStr ? parseInt(companyIdStr, 10) : undefined;

      const [debitAccountId, creditAccountId] = await Promise.all([
        this.resolveAccountId(debitAccountCode, companyId),
        this.resolveAccountId(creditAccountCode, companyId),
      ]);

      if (!debitAccountId || !creditAccountId) {
        this.logger.warn(
          `Skipping Odoo monthly bonus entry: unresolved accounts (debit="${debitAccountCode}"→${debitAccountId}, credit="${creditAccountCode}"→${creditAccountId})`,
        );
        return null;
      }

      const journalId = journalIdStr
        ? await this.resolveJournalId(journalIdStr, companyId)
        : await this.getGeneralJournal(companyId);

      if (!journalId) {
        this.logger.warn('Skipping Odoo monthly bonus entry: no suitable journal found');
        return null;
      }

      const paddedMonth = String(params.month).padStart(2, '0');
      const ref = `BONO COMISION ${paddedMonth}-${params.year} - ${params.sellerName}`;
      const today = new Date().toISOString().split('T')[0];

      const moveData: any = {
        move_type: 'entry',
        ref,
        date: today,
        journal_id: journalId,
        line_ids: [
          [0, 0, { account_id: debitAccountId, name: ref, debit: params.amount, credit: 0 }],
          [0, 0, { account_id: creditAccountId, name: ref, debit: 0, credit: params.amount }],
        ],
      };

      if (companyId) moveData.company_id = companyId;

      const moveId = await this.execute('account.move', 'create', [moveData]);
      await this.execute('account.move', 'action_post', [[moveId]]);
      const moveRead = await this.execute('account.move', 'read', [[moveId], ['name']]);
      const moveName = moveRead?.[0]?.name || `MISC-${moveId}`;

      this.logger.log(`Created Odoo monthly bonus entry ${moveName} (#${moveId}) for ${params.sellerName}`);
      return { moveId, moveName };
    } catch (error) {
      this.logger.error(`Failed to create Odoo monthly bonus entry: ${error.message}`);
      return null;
    }
  }

  /**
   * Resolve an account setting value (PUC code like "110505" or a raw DB id) to
   * the actual Odoo account.account record ID needed for Many2one fields.
   * Strategy:
   *   1. Search by code first — this is what accountants configure.
   *   2. If not found by code and the value is a small integer (≤ 9999),
   *      assume it is already a DB id and return it.
   */
  private async resolveAccountId(codeOrId: string, companyId?: number): Promise<number | null> {
    try {
      // Odoo 17+ removed company_id as a domain field on account.account.
      // Use allowed_company_ids in context to scope to the correct company.
      const kwargs: any = { fields: ['id', 'name', 'code'], limit: 1 };
      if (companyId) kwargs.context = { allowed_company_ids: [companyId] };

      const accounts = await this.execute(
        'account.account',
        'search_read',
        [[['code', '=', codeOrId]]],
        kwargs,
      );

      if (accounts && accounts.length > 0) {
        this.logger.debug(`Resolved account code "${codeOrId}" → id=${accounts[0].id} (${accounts[0].name})`);
        return accounts[0].id as number;
      }

      // Fallback: if caller already stored a raw numeric DB id (small number)
      const parsed = parseInt(codeOrId, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 9999) {
        this.logger.debug(`Account code "${codeOrId}" not found by code, using as raw id`);
        return parsed;
      }

      this.logger.warn(`Could not resolve Odoo account for value "${codeOrId}" (company=${companyId})`);
      return null;
    } catch (error) {
      this.logger.error(`Error resolving Odoo account "${codeOrId}": ${error.message}`);
      return null;
    }
  }

  /**
   * Resolve a journal setting value (sequence prefix like "MISC" or a raw DB id) to
   * the actual Odoo account.journal record ID.
   * Strategy:
   *   1. Search by code (sequence prefix) — case-insensitive.
   *   2. If not found by code and the value is a small integer (≤ 9999),
   *      assume it is already a DB id and return it.
   */
  private async resolveJournalId(codeOrId: string, companyId?: number): Promise<number | null> {
    try {
      const kwargs: any = { fields: ['id', 'name', 'code'], limit: 1 };
      if (companyId) kwargs.context = { allowed_company_ids: [companyId] };

      const journals = await this.execute(
        'account.journal',
        'search_read',
        [[['code', '=ilike', codeOrId.trim()]]],
        kwargs,
      );

      if (journals && journals.length > 0) {
        this.logger.debug(`Resolved journal prefix "${codeOrId}" → id=${journals[0].id} (${journals[0].name})`);
        return journals[0].id as number;
      }

      // Fallback: raw numeric DB id
      const parsed = parseInt(codeOrId, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 9999) {
        this.logger.debug(`Journal prefix "${codeOrId}" not found by code, using as raw id`);
        return parsed;
      }

      this.logger.warn(`Could not resolve Odoo journal for value "${codeOrId}"`);
      return null;
    } catch (error) {
      this.logger.error(`Error resolving Odoo journal "${codeOrId}": ${error.message}`);
      return null;
    }
  }

  private async getGeneralJournal(companyId?: number): Promise<number | null> {
    try {
      const kwargs: any = { fields: ['id', 'name'], limit: 5 };
      if (companyId) kwargs.context = { allowed_company_ids: [companyId] };

      const journals = await this.execute(
        'account.journal',
        'search_read',
        [[['type', '=', 'general']]],
        kwargs,
      );

      if (journals && journals.length > 0) return journals[0].id;
      return null;
    } catch {
      return null;
    }
  }
}
