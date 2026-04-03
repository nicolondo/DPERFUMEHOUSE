import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';
import { Prisma } from '@prisma/client';
import {
  CreateCustomerBodyDto,
  UpdateCustomerBodyDto,
  CreateAddressBodyDto,
  UpdateAddressBodyDto,
} from './dto';

export interface FindAllCustomersParams {
  page: number;
  pageSize: number;
  search?: string;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooService: OdooService,
  ) {}

  async findAll(sellerId: string | null, params: FindAllCustomersParams) {
    const { page, pageSize, search } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = {};
    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          },
          seller: {
            select: { id: true, name: true, email: true },
          },
          orders: {
            select: { total: true, status: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const paidStatuses = ['PAID', 'SHIPPED', 'DELIVERED'];

    return {
      data: items.map((c) => ({
        ...c,
        totalPurchases: c.orders
          .filter((o) => paidStatuses.includes(o.status))
          .reduce((sum, o) => sum + o.total.toNumber(), 0),
        totalOrders: c.orders.length,
      })),
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string, sellerId: string | null) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        seller: {
          select: { id: true, name: true, email: true, phone: true },
        },
        orders: {
          include: {
            items: {
              include: {
                variant: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    if (sellerId && customer.sellerId !== sellerId) {
      throw new ForbiddenException('You do not have access to this customer');
    }

    const paidStatuses = ['PAID', 'SHIPPED', 'DELIVERED'];
    const c = customer as any;
    return {
      ...customer,
      totalPurchases: c.orders
        .filter((o: any) => paidStatuses.includes(o.status))
        .reduce((sum: number, o: any) => sum + o.total.toNumber(), 0),
      totalOrders: c.orders.length,
    };
  }

  async create(data: CreateCustomerBodyDto, sellerId: string) {
    // Validate unique email per seller
    if (data.email) {
      const existingByEmail = await this.prisma.customer.findUnique({
        where: {
          email_sellerId: { email: data.email, sellerId },
        },
      });
      if (existingByEmail) {
        throw new ConflictException(
          `A customer with email ${data.email} already exists`,
        );
      }
    }

    // Validate unique phone per seller
    if (data.phone) {
      const existingByPhone = await this.prisma.customer.findUnique({
        where: {
          phone_sellerId: { phone: data.phone, sellerId },
        },
      });
      if (existingByPhone) {
        throw new ConflictException(
          `A customer with phone ${data.phone} already exists`,
        );
      }
    }

    // Create customer with optional address
    const customer = await this.prisma.customer.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        phoneCode: data.phoneCode || '+57',
        documentId: data.documentId || (data.documentNumber ? `${data.documentType || 'CC'}-${data.documentNumber}` : null),
        sellerId,
        ...(data.address
          ? {
              addresses: {
                create: {
                  label: data.address.label || 'Principal',
                  street: data.address.street,
                  detail: data.address.detail || null,
                  phone: data.address.phone || null,
                  phoneCode: data.address.phoneCode || data.phoneCode || '+57',
                  city: data.address.city,
                  state: data.address.state || null,
                  zip: data.address.zip || null,
                  country: data.address.country || 'CO',
                  isDefault: data.address.isDefault ?? true,
                  notes: data.address.notes || null,
                },
              },
            }
          : {}),
      },
      include: { addresses: true },
    });

    // Sync to Odoo asynchronously (best effort)
    this.syncCustomerToOdoo(customer.id).catch((error) => {
      this.logger.error(
        `Failed to sync customer ${customer.id} to Odoo: ${error.message}`,
      );
    });

    this.logger.log(
      `Customer ${customer.id} created by seller ${sellerId}`,
    );

    return customer;
  }

  async update(
    id: string,
    data: UpdateCustomerBodyDto,
    sellerId: string | null,
  ) {
    const customer = await this.findOne(id, sellerId);
    const ownerSellerId = customer.sellerId;

    // Validate unique email per seller if changing email
    if (data.email && data.email !== customer.email) {
      const existingByEmail = await this.prisma.customer.findUnique({
        where: {
          email_sellerId: { email: data.email, sellerId: ownerSellerId },
        },
      });
      if (existingByEmail && existingByEmail.id !== id) {
        throw new ConflictException(
          `A customer with email ${data.email} already exists`,
        );
      }
    }

    // Validate unique phone per seller if changing phone
    if (data.phone && data.phone !== customer.phone) {
      const existingByPhone = await this.prisma.customer.findUnique({
        where: {
          phone_sellerId: { phone: data.phone, sellerId: ownerSellerId },
        },
      });
      if (existingByPhone && existingByPhone.id !== id) {
        throw new ConflictException(
          `A customer with phone ${data.phone} already exists`,
        );
      }
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.phoneCode !== undefined && { phoneCode: data.phoneCode }),
        ...(data.documentId !== undefined && { documentId: data.documentId }),
        ...(data.documentType !== undefined && { documentType: data.documentType }),
        ...(data.documentNumber !== undefined && { documentNumber: data.documentNumber?.replace(/[^0-9]/g, '') || data.documentNumber }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: { addresses: true },
    });

    // Sync to Odoo — await for document type changes to validate NIT
    if (data.documentType !== undefined || data.documentNumber !== undefined) {
      try {
        await this.syncCustomerToOdoo(updated.id);
      } catch (error) {
        // Rollback document fields on Odoo validation failure
        await this.prisma.customer.update({
          where: { id },
          data: {
            documentType: customer.documentType,
            documentNumber: customer.documentNumber,
          },
        });
        throw new BadRequestException(error.message);
      }
    } else {
      // Non-document changes: sync asynchronously (best effort)
      this.syncCustomerToOdoo(updated.id).catch((error) => {
        this.logger.error(
          `Failed to sync customer ${updated.id} to Odoo: ${error.message}`,
        );
      });
    }

    return updated;
  }

  async createAddress(
    customerId: string,
    data: CreateAddressBodyDto,
    sellerId: string | null,
  ) {
    // Verify ownership
    await this.findOne(customerId, sellerId);

    // If this address is default, unset other defaults
    if (data.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.customerAddress.create({
      data: {
        customerId,
        label: data.label || null,
        street: data.street,
        detail: data.detail || null,
        phone: data.phone || null,
        phoneCode: data.phoneCode || '+57',
        city: data.city,
        state: data.state || null,
        zip: data.zip || null,
        country: data.country || 'CO',
        isDefault: data.isDefault || false,
        notes: data.notes || null,
      },
    });

    // Re-sync to Odoo so partner gets updated address data
    if (data.isDefault) {
      this.syncCustomerToOdoo(customerId).catch((error) => {
        this.logger.error(
          `Failed to sync customer ${customerId} to Odoo after address creation: ${error.message}`,
        );
      });
    }

    return address;
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    data: UpdateAddressBodyDto,
    sellerId: string | null,
  ) {
    await this.findOne(customerId, sellerId);

    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!address) {
      throw new NotFoundException(
        `Address ${addressId} not found for customer ${customerId}`,
      );
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.detail !== undefined && { detail: data.detail }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.phoneCode !== undefined && { phoneCode: data.phoneCode }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.zip !== undefined && { zip: data.zip }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  async deleteAddress(
    customerId: string,
    addressId: string,
    sellerId: string | null,
  ) {
    await this.findOne(customerId, sellerId);

    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!address) {
      throw new NotFoundException(
        `Address ${addressId} not found for customer ${customerId}`,
      );
    }

    await this.prisma.customerAddress.delete({
      where: { id: addressId },
    });

    // If deleted address was default, set the most recent one as default
    if (address.isDefault) {
      const remaining = await this.prisma.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });

      if (remaining) {
        await this.prisma.customerAddress.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }

    return { deleted: true };
  }

  async delete(customerId: string, userId: string, userRole: string) {
    // Admin can delete any customer, seller can only delete their own
    if (userRole === 'ADMIN') {
      const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    } else {
      await this.findOne(customerId, userId);
    }

    // Check for orders
    const orderCount = await this.prisma.order.count({ where: { customerId } });
    if (orderCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el cliente porque tiene ${orderCount} pedido(s) asociado(s)`,
      );
    }

    await this.prisma.customer.delete({ where: { id: customerId } });
    return { deleted: true };
  }

  private async syncCustomerToOdoo(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        addresses: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });

    if (!customer) return;

    const defaultAddress = customer.addresses[0];

    const odooPartnerId = await this.odooService.upsertPartner({
      name: customer.name,
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      street: defaultAddress?.street || undefined,
      street2: defaultAddress?.detail || undefined,
      city: defaultAddress?.city || undefined,
      state: defaultAddress?.state || undefined,
      zip: defaultAddress?.zip || undefined,
      country: defaultAddress?.country || 'CO',
      documentType: customer.documentType || undefined,
      documentNumber: customer.documentNumber || undefined,
    });

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { odooPartnerId },
    });

    this.logger.log(
      `Customer ${customerId} synced to Odoo as partner ${odooPartnerId}`,
    );
  }
}
