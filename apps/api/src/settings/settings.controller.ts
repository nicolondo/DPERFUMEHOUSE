import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SettingsService } from './settings.service';
import { CreateSettingDto, UpdateSettingDto } from './dto/setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OdooService } from '../odoo/odoo.service';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly odooService: OdooService,
  ) {}

  @Get('public/order-config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get public order configuration (tax, shipping)' })
  async getOrderConfig() {
    const taxRate = await this.settingsService.get('tax_rate');
    const shippingCost = await this.settingsService.get('default_shipping_cost');
    const freeShippingThreshold = await this.settingsService.get('free_shipping_threshold');
    const activePaymentProvider = await this.settingsService.get('active_payment_provider');

    const rawTax = parseFloat(taxRate || '19');
    // If stored as percentage (e.g. 19), convert to decimal (0.19)
    const normalizedTax = rawTax > 1 ? rawTax / 100 : rawTax;

    return {
      taxRate: normalizedTax,
      shippingCost: parseFloat(shippingCost || '0'),
      freeShippingThreshold: parseFloat(freeShippingThreshold || '200000'),
      activePaymentProvider: activePaymentProvider || 'myxspend',
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all settings (admin only)' })
  @ApiQuery({ name: 'group', required: false, description: 'Filter by group' })
  @ApiQuery({
    name: 'includeSecrets',
    type: Boolean,
    required: false,
    description: 'Include secret values (default: false)',
  })
  @ApiResponse({ status: 200, description: 'List of settings' })
  async findAll(
    @Query('group') group?: string,
    @Query('includeSecrets') includeSecrets?: boolean,
  ) {
    if (group) {
      return this.settingsService.getByGroup(group, includeSecrets);
    }
    return this.settingsService.getAll(includeSecrets);
  }

  @Get('odoo-companies')
  @ApiOperation({ summary: 'Get companies from Odoo' })
  async getOdooCompanies() {
    try {
      const companies = await this.odooService.getCompanies();
      return { success: true, data: companies };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        message: `Error al obtener compañias: ${error.message || 'Error desconocido'}`,
      };
    }
  }

  @Get('odoo-pricelists')
  @ApiOperation({ summary: 'Fetch pricelists from Odoo' })
  async getOdooPricelists() {
    try {
      const companyIdStr = await this.settingsService.get('odoo_company_id');
      const companyId = companyIdStr ? parseInt(companyIdStr, 10) : undefined;
      const pricelists = await this.odooService.getPricelists(companyId);
      return { success: true, data: pricelists };
    } catch (error: any) {
      return { success: false, data: [], message: error.message };
    }
  }

  @Get('odoo-categories')
  @ApiOperation({ summary: 'Fetch product categories from Odoo' })
  async getOdooCategories() {
    try {
      const categories = await this.odooService.getCategories();
      return { success: true, data: categories };
    } catch (error: any) {
      return { success: false, data: [], message: error.message };
    }
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a setting by key (admin only)' })
  @ApiResponse({ status: 200, description: 'Setting value' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  async findOne(@Param('key') key: string) {
    const value = await this.settingsService.getOrThrow(key);
    return { key, value };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new setting (admin only)' })
  @ApiResponse({ status: 201, description: 'Setting created' })
  @ApiResponse({ status: 409, description: 'Setting already exists' })
  async create(@Body() dto: CreateSettingDto) {
    return this.settingsService.create(dto);
  }

  @Put()
  @ApiOperation({ summary: 'Bulk update settings (admin only)' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async bulkUpdate(@Body() body: { settings: { key: string; value: string }[] }) {
    const results: { key: string; status: string; message?: string }[] = [];
    for (const setting of body.settings) {
      try {
        // Skip masked secret values to avoid overwriting real secrets
        if (setting.value === '********') {
          results.push({ key: setting.key, status: 'skipped' });
          continue;
        }
        const existing = await this.settingsService.get(setting.key);
        if (existing !== null) {
          await this.settingsService.update(setting.key, { value: setting.value });
        } else {
          await this.settingsService.create({
            key: setting.key,
            value: setting.value,
                 group: setting.key.toLowerCase().startsWith('odoo') ? 'odoo' :
                   setting.key.toLowerCase().startsWith('myxspend') ? 'payment' :
                   setting.key.toLowerCase().startsWith('commission') ? 'commissions' : 'general',
            isSecret: setting.key.toLowerCase().includes('key') || setting.key.toLowerCase().includes('password') || setting.key.toLowerCase().includes('secret'),
          });
        }
        results.push({ key: setting.key, status: 'updated' });
      } catch (error: any) {
        results.push({ key: setting.key, status: 'error', message: error.message });
      }
    }
    return { success: true, results };
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update a setting by key (admin only)' })
  @ApiResponse({ status: 200, description: 'Setting updated' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  async update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.update(key, dto);
  }

  @Post('test-odoo')
  @ApiOperation({ summary: 'Test Odoo connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testOdoo() {
    try {
      const products = await this.odooService.getProducts(1, 0);
      return {
        success: true,
        message: `Conexion exitosa. Se encontraron productos en Odoo.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error al conectar: ${error.message || 'Error desconocido'}`,
      };
    }
  }

  @Post('test-payment')
  @ApiOperation({ summary: 'Test payment provider connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testPayment() {
    try {
      const baseUrl = await this.settingsService.get('MYXSPEND_BASE_URL');
      if (!baseUrl) {
        return { success: false, message: 'MyxSpend base URL no configurada' };
      }
      return {
        success: true,
        message: 'Configuracion de pagos verificada correctamente.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error: ${error.message || 'Error desconocido'}`,
      };
    }
  }

  @Post('test-wompi')
  @ApiOperation({ summary: 'Test Wompi connection' })
  @ApiResponse({ status: 200, description: 'Wompi connection test result' })
  async testWompi() {
    try {
      const publicKey = await this.settingsService.get('wompi_public_key');
      if (!publicKey) {
        return { success: false, message: 'Llave pública de Wompi no configurada' };
      }

      const environment = await this.settingsService.get('wompi_environment') || 'sandbox';
      const baseUrl = environment === 'production'
        ? 'https://production.wompi.co/v1'
        : 'https://sandbox.wompi.co/v1';

      const response = await fetch(`${baseUrl}/merchants/${publicKey}`);

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          message: `Error al conectar con Wompi: ${response.status} - ${body}`,
        };
      }

      const data = (await response.json()) as any;
      const merchant = data.data;

      return {
        success: true,
        message: `Conexion exitosa. Comercio: ${merchant?.name || 'N/A'} (${merchant?.legal_name || 'N/A'})`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error: ${error.message || 'Error desconocido'}`,
      };
    }
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a setting by key (admin only)' })
  @ApiResponse({ status: 200, description: 'Setting deleted' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  async remove(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }
}
