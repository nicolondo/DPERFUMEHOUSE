import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService, OdooProduct } from './odoo.service';
import { ImageService } from '../image/image.service';
import { SettingsService } from '../settings/settings.service';

export interface SyncResult {
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

@Injectable()
export class OdooSyncService {
  private readonly logger = new Logger(OdooSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooService: OdooService,
    private readonly imageService: ImageService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getCompanyId(): Promise<number | undefined> {
    try {
      const val = await this.settingsService.get('odoo_company_id');
      return val ? parseInt(val, 10) : undefined;
    } catch {
      return undefined;
    }
  }

  private async getPricelistId(): Promise<number | undefined> {
    try {
      const val = await this.settingsService.get('odoo_pricelist_id');
      return val ? parseInt(val, 10) : undefined;
    } catch {
      return undefined;
    }
  }

  async syncAllProducts(): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deactivated: 0,
      errors: [],
    };

    this.logger.log('Starting full product sync from Odoo...');

    try {
      const companyId = await this.getCompanyId();
      if (companyId) {
        this.logger.log(`Syncing with company ID: ${companyId}`);
      }

      // Build category filter
      const categoryDomain: any[] = [];
      try {
        const categSetting = await this.settingsService.get('odoo_sync_categories');
        if (categSetting) {
          const categIds = JSON.parse(categSetting);
          if (Array.isArray(categIds) && categIds.length > 0) {
            categoryDomain.push(['categ_id', 'in', categIds]);
            this.logger.log(`Filtering by category IDs: ${categIds.join(', ')}`);
          }
        }
      } catch { /* no category filter */ }

      // Fetch all products from Odoo in batches
      const allOdooProducts: OdooProduct[] = [];
      let offset = 0;
      const batchSize = 200;

      while (true) {
        const batch = await this.odooService.getProducts(batchSize, offset, categoryDomain, companyId);
        if (batch.length === 0) break;
        allOdooProducts.push(...batch);
        offset += batchSize;

        if (batch.length < batchSize) break;
      }

      this.logger.log(
        `Fetched ${allOdooProducts.length} products from Odoo`,
      );

      // Apply pricelist prices if configured
      const pricelistId = await this.getPricelistId();
      if (pricelistId) {
        this.logger.log(`Applying pricelist ID: ${pricelistId}`);
        const productIds = allOdooProducts.map(p => p.id);
        // Fetch prices in batches of 100
        for (let i = 0; i < productIds.length; i += 100) {
          const batch = productIds.slice(i, i + 100);
          try {
            const prices = await this.odooService.getProductPrices(batch, pricelistId);
            for (const [prodId, price] of prices.entries()) {
              const product = allOdooProducts.find(p => p.id === prodId);
              if (product && price > 0) {
                product.list_price = price;
              }
            }
          } catch (err) {
            this.logger.warn(`Failed to get pricelist prices for batch ${i}: ${err}`);
          }
        }
      }

      const odooProductIds = new Set<number>();

      // Create or update each product
      for (const odooProduct of allOdooProducts) {
        try {
          odooProductIds.add(odooProduct.id);

          const existingVariant =
            await this.prisma.productVariant.findUnique({
              where: { odooProductId: odooProduct.id },
            });

          const categName =
            odooProduct.categ_id && Array.isArray(odooProduct.categ_id)
              ? odooProduct.categ_id[1]
              : null;

          const templateId =
            odooProduct.product_tmpl_id &&
            Array.isArray(odooProduct.product_tmpl_id)
              ? odooProduct.product_tmpl_id[0]
              : null;

          // Resolve variant attributes
          let attributes: Record<string, string> = {};
          if (
            odooProduct.product_template_attribute_value_ids &&
            odooProduct.product_template_attribute_value_ids.length > 0
          ) {
            attributes = await this.odooService.resolveAttributeValues(
              odooProduct.product_template_attribute_value_ids,
            );
          }

          const productData = {
            name: odooProduct.name,
            sku: odooProduct.default_code || null,
            barcode: odooProduct.barcode || null,
            price: odooProduct.list_price,
            stock: Math.max(0, Math.floor(odooProduct.virtual_available || 0)),
            categoryName: categName,
            odooTemplateId: templateId,
            attributes: attributes as any,
            isActive: true,
          };

          if (existingVariant) {
            await this.prisma.productVariant.update({
              where: { id: existingVariant.id },
              data: productData,
            });
            result.updated++;
          } else {
            await this.prisma.productVariant.create({
              data: {
                ...productData,
                odooProductId: odooProduct.id,
              },
            });
            result.created++;
          }

          // Sync product image if available
          if (odooProduct.image_1920) {
            await this.syncProductImage(
              odooProduct.id,
              odooProduct.image_1920,
            );
          }
        } catch (error) {
          const message = `Error syncing product ${odooProduct.id} (${odooProduct.name}): ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(message);
          result.errors.push(message);
        }
      }

      // Deactivate products that no longer exist in Odoo
      const deactivated = await this.prisma.productVariant.updateMany({
        where: {
          isActive: true,
          odooProductId: {
            notIn: Array.from(odooProductIds),
          },
        },
        data: { isActive: false },
      });
      result.deactivated = deactivated.count;

      this.logger.log(
        `Product sync completed: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated, ${result.errors.length} errors`,
      );
    } catch (error) {
      this.logger.error('Fatal error during product sync', error);
      result.errors.push(
        `Fatal sync error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  async syncStock(): Promise<{ updated: number; errors: string[] }> {
    const result = { updated: 0, errors: [] as string[] };

    this.logger.log('Starting stock sync from Odoo...');

    try {
      // Get all active variants with Odoo product IDs
      const activeVariants = await this.prisma.productVariant.findMany({
        where: { isActive: true },
        select: { id: true, odooProductId: true },
      });

      if (activeVariants.length === 0) {
        this.logger.log('No active variants to sync stock for');
        return result;
      }

      // Fetch stock in batches
      const warehouseLocationId = await this.settingsService.get('odoo_warehouse_location_id');
      const locationId = warehouseLocationId ? parseInt(warehouseLocationId, 10) : undefined;
      if (locationId) {
        this.logger.log(`Syncing stock from location ${locationId}`);
      }
      const batchSize = 100;
      for (let i = 0; i < activeVariants.length; i += batchSize) {
        const batch = activeVariants.slice(i, i + batchSize);
        const odooIds = batch.map((v) => v.odooProductId);

        try {
          const stockMap = await this.odooService.getStock(odooIds, locationId);

          for (const variant of batch) {
            const stock = stockMap.get(variant.odooProductId);
            if (stock !== undefined) {
              await this.prisma.productVariant.update({
                where: { id: variant.id },
                data: { stock: Math.max(0, Math.floor(stock)) },
              });
              result.updated++;
            }
          }
        } catch (error) {
          const message = `Error syncing stock batch starting at index ${i}: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(message);
          result.errors.push(message);
        }
      }

      this.logger.log(
        `Stock sync completed: ${result.updated} updated, ${result.errors.length} errors`,
      );
    } catch (error) {
      this.logger.error('Fatal error during stock sync', error);
      result.errors.push(
        `Fatal stock sync error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  private async syncProductImage(
    odooProductId: number,
    base64Image: string,
  ): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { odooProductId },
      include: { images: true },
    });

    if (!variant) return;

    // Skip if the variant already has images (avoid re-processing every sync)
    if (variant.images.length > 0) return;

    // Process through sharp to generate optimized files
    const { url, thumbnailUrl } =
      await this.imageService.processOdooImage(base64Image, variant.id);

    await this.prisma.productImage.create({
      data: {
        variantId: variant.id,
        url,
        thumbnailUrl,
        isPrimary: true,
        sortOrder: 0,
      },
    });
  }
}
