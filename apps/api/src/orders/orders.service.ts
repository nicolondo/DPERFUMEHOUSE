import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';
import { PaymentsService } from '../payments/payments.service';
import { CommissionsService } from '../commissions/commissions.service';
import { Prisma, OrderStatus, PaymentMethod, CommissionStatus } from '@prisma/client';
import { CreateOrderBodyDto } from './dto';

export interface FindAllOrdersParams {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odooService: OdooService,
    private readonly paymentsService: PaymentsService,
    private readonly commissionsService: CommissionsService,
    @InjectQueue('email-send') private readonly emailQueue: Queue,
  ) {}

  async isChildSeller(parentId: string, childId: string): Promise<boolean> {
    const child = await this.prisma.user.findFirst({
      where: { id: childId, parentId },
      select: { id: true },
    });
    return !!child;
  }

  async findAll(sellerId: string | undefined, params: FindAllOrdersParams) {
    const { page, pageSize, status, search, from, to } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrderWhereInput = {};
    if (sellerId) where.sellerId = sellerId;

    if (status) {
      const upper = status.toUpperCase() as OrderStatus;
      if (Object.values(OrderStatus).includes(upper)) {
        where.status = upper;
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          seller: {
            select: { id: true, name: true, email: true },
          },
          address: true,
          items: {
            include: {
              variant: {
                select: { name: true, sku: true, price: true },
              },
            },
          },
          paymentLink: {
            select: { url: true, status: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string, sellerId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        seller: {
          select: { id: true, name: true, email: true },
        },
        address: true,
        items: {
          include: {
            variant: {
              select: { name: true, sku: true, price: true },
            },
          },
        },
        paymentLink: {
          include: {
            events: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        commissions: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        shipment: {
          include: {
            events: { orderBy: { timestamp: 'desc' } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (sellerId && order.sellerId !== sellerId) {
      throw new ForbiddenException('You do not own this order');
    }

    return order;
  }

  async createOrder(data: CreateOrderBodyDto, sellerId: string) {
    // Validate customer belongs to seller
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, sellerId },
    });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found or does not belong to you',
      );
    }

    // Validate address belongs to customer
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: data.addressId, customerId: data.customerId },
    });

    if (!address) {
      throw new NotFoundException(
        'Address not found for this customer',
      );
    }

    // Validate variants and check stock
    const variantIds = data.items.map((item) => item.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
        isBlocked: false,
      },
    });

    if (variants.length !== variantIds.length) {
      const foundIds = new Set(variants.map((v) => v.id));
      const missing = variantIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Products not found or unavailable: ${missing.join(', ')}`,
      );
    }

    // Check local stock
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    for (const item of data.items) {
      const variant = variantMap.get(item.variantId)!;
      if (variant.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${variant.name}: available ${variant.stock}, requested ${item.quantity}`,
        );
      }
    }

    // Double-check with Odoo real-time stock
    const odooIds = variants.map((v) => v.odooProductId);
    try {
      const odooStock = await this.odooService.getStock(odooIds);
      for (const item of data.items) {
        const variant = variantMap.get(item.variantId)!;
        const liveStock = odooStock.get(variant.odooProductId);
        if (liveStock !== undefined && liveStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient real-time stock for ${variant.name}: available ${Math.floor(liveStock)}, requested ${item.quantity}`,
          );
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        'Could not verify stock with Odoo, proceeding with local stock',
      );
    }

    // Generate order number: PH-YYYYMMDD-XXXX
    const orderNumber = await this.generateOrderNumber();

    // Calculate totals
    let subtotal = 0;
    const orderItems: {
      variantId: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[] = [];

    for (const item of data.items) {
      const variant = variantMap.get(item.variantId)!;
      const unitPrice = Number(variant.price);
      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;
      orderItems.push({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal,
      });
    }

    const tax = 0;
    const shipping = 0;
    const total = subtotal + tax + shipping;

    // Create order in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          status: 'DRAFT',
          sellerId,
          customerId: data.customerId,
          addressId: data.addressId,
          subtotal,
          tax,
          shipping,
          total,
          notes: data.notes || null,
          paymentMethod: (data.paymentMethod as PaymentMethod) || 'ONLINE',
          paymentStatus: 'PENDING',
          items: {
            create: orderItems.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          address: true,
          items: {
            include: {
              variant: {
                select: { name: true, sku: true, price: true },
              },
            },
          },
        },
      });

      // Decrement local stock
      for (const item of data.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return createdOrder;
    });

    this.logger.log(
      `Order ${orderNumber} created by seller ${sellerId} for customer ${customer.name}`,
    );

    // ONLINE orders: auto-process (payment link + email)
    // CASH orders: stay as DRAFT until manually marked as paid
    if (data.paymentMethod === 'ONLINE') {
      try {
        const processed = await this.processOrder(order.id, sellerId);
        return processed;
      } catch (err) {
        this.logger.error(`Failed to auto-process ONLINE order ${orderNumber}: ${err.message}`);
      }
    }

    return order;
  }

  async processOrder(orderId: string, sellerId: string) {
    const order = await this.findOne(orderId, sellerId);

    if (order.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot process order in status ${order.status}`,
      );
    }

    // Cash orders: create draft sale order in Odoo, mark as paid locally
    if (order.paymentMethod === 'CASH') {
      // Re-fetch with Odoo-related fields needed for sale order creation
      const fullOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { variant: true } },
          customer: true,
          seller: true,
        },
      });

      if (!fullOrder) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Ensure Odoo partner exists
      let odooPartnerId = fullOrder.customer.odooPartnerId;
      if (!odooPartnerId) {
        odooPartnerId = await this.odooService.upsertPartner({
          name: fullOrder.customer.name,
          email: fullOrder.customer.email || '',
          phone: fullOrder.customer.phone || '',
        });

        await this.prisma.customer.update({
          where: { id: fullOrder.customer.id },
          data: { odooPartnerId },
        });
      }

      // Create sale order in Odoo as DRAFT (do NOT confirm)
      let odooSaleOrderId = fullOrder.odooSaleOrderId;
      let orderNumber = order.orderNumber;
      if (!odooSaleOrderId) {
        const odooSO = await this.odooService.createSaleOrder({
          partnerId: odooPartnerId,
          lines: fullOrder.items.map((item) => ({
            productId: item.variant.odooProductId,
            quantity: item.quantity,
            price: Number(item.unitPrice),
          })),
          companyId: fullOrder.seller?.odooCompanyId || undefined,
        });
        odooSaleOrderId = odooSO.id;
        orderNumber = odooSO.name;
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'DRAFT',
          paymentStatus: 'PENDING',
          odooSaleOrderId,
          orderNumber,
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          address: true,
          items: {
            include: {
              variant: {
                select: { name: true, sku: true, price: true },
              },
            },
          },
        },
      });

      // Create PENDING commission at order confirmation
      try {
        await this.commissionsService.calculateForOrder(orderId, CommissionStatus.PENDING);
      } catch (e) {
        this.logger.warn(`Could not create pending commission for order ${orderId}: ${e.message}`);
      }

      this.logger.log(
        `Order ${orderNumber} processed as CASH, Odoo SO ${odooSaleOrderId} created as draft. Awaiting payment confirmation.`,
      );

      return updatedOrder;
    }

    // Create payment link (online payment)
    const paymentResult = await this.paymentsService.createPaymentLink(
      orderId,
      sellerId,
    );

    // Queue email to customer with payment link
    if (order.customer.email) {
      await this.emailQueue.add(
        'send-payment-link',
        {
          customerEmail: order.customer.email,
          customerName: order.customer.name,
          orderNumber: order.orderNumber,
          paymentUrl: paymentResult.paymentUrl,
          total: Number(order.total),
        },
        {
          removeOnComplete: 10,
          removeOnFail: 20,
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
        },
      );
    }

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        address: true,
        items: {
          include: {
            variant: {
              select: { name: true, sku: true, price: true },
            },
          },
        },
        paymentLink: {
          select: { url: true, status: true },
        },
      },
    });

    this.logger.log(
      `Order ${order.orderNumber} processed, payment link sent`,
    );

    return updatedOrder;
  }

  async updateOrderAddress(orderId: string, addressId: string, sellerId?: string) {
    const order = await this.findOne(orderId, sellerId);

    const lockedStatuses: OrderStatus[] = [
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ];

    if (lockedStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        `No se puede cambiar la direccion para pedidos en estado ${order.status}`,
      );
    }

    const address = await this.prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId: order.customerId,
      },
      select: { id: true },
    });

    if (!address) {
      throw new NotFoundException('Direccion no encontrada para este cliente');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { addressId },
    });

    return this.findOne(orderId, sellerId);
  }

  async cancelOrder(orderId: string, sellerId: string) {
    const order = await this.findOne(orderId, sellerId);

    const cancellableStatuses: OrderStatus[] = [
      'DRAFT',
      'PENDING_PAYMENT',
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order in status ${order.status}`,
      );
    }

    // Restore stock
    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      // Cancel payment link if exists
      if (order.paymentLink) {
        await tx.paymentLink.update({
          where: { id: order.paymentLink.id },
          data: { status: 'CANCELLED' },
        });
      }
    });

    this.logger.log(`Order ${order.orderNumber} cancelled`);

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        items: true,
      },
    });
  }

  /**
   * Admin-only: manually mark an order as PAID.
   * For DRAFT CASH orders: creates Odoo partner + SO, confirms SO, registers payment.
   */
  async markAsPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { variant: true } },
        customer: true,
        seller: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status === 'PAID') {
      return order;
    }

    const allowedStatuses: OrderStatus[] = ['DRAFT', 'PENDING_PAYMENT'];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot mark order as paid in status ${order.status}`,
      );
    }

    let odooSaleOrderId = order.odooSaleOrderId;
    let orderNumber = order.orderNumber;

    // For DRAFT orders (typically CASH): create Odoo partner and SO first
    if (order.status === 'DRAFT') {
      // Ensure Odoo partner exists
      let odooPartnerId = order.customer.odooPartnerId;
      if (!odooPartnerId) {
        odooPartnerId = await this.odooService.upsertPartner({
          name: order.customer.name,
          email: order.customer.email || '',
          phone: order.customer.phone || '',
        });
        await this.prisma.customer.update({
          where: { id: order.customer.id },
          data: { odooPartnerId },
        });
      }

      // Create sale order in Odoo
      if (!odooSaleOrderId) {
        const odooSO = await this.odooService.createSaleOrder({
          partnerId: odooPartnerId,
          lines: order.items.map((item) => ({
            productId: item.variant.odooProductId,
            quantity: item.quantity,
            price: Number(item.unitPrice),
          })),
          companyId: order.seller?.odooCompanyId || undefined,
        });
        odooSaleOrderId = odooSO.id;
        orderNumber = odooSO.name;
        this.logger.log(
          `Created Odoo SO ${orderNumber} (${odooSaleOrderId}) for DRAFT order ${order.orderNumber}`,
        );
      }
    }

    // Confirm Odoo SO and register payment
    let odooInvoiceId: number | undefined;
    let odooInvoiceName: string | undefined;

    if (odooSaleOrderId) {
      try {
        // Use bank journal for ONLINE payments (Wompi → account 111001), cash for CASH payments (→ account 110505)
        const journalName = order.paymentMethod === 'ONLINE' ? 'Wompi' : 'Cash';
        const journalType = order.paymentMethod === 'ONLINE' ? 'bank' : 'cash';
        const result = await this.odooService.confirmAndRegisterPayment(
          odooSaleOrderId,
          Number(order.total),
          journalName,
          journalType,
        );
        odooInvoiceId = result.invoiceId;
        odooInvoiceName = result.invoiceName;
        this.logger.log(
          `Odoo SO ${odooSaleOrderId} confirmed, invoice ${odooInvoiceName} created and payment registered (journal: ${journalName}/${journalType})`,
        );
      } catch (err) {
        this.logger.warn(
          `Could not register Odoo payment for SO ${odooSaleOrderId}: ${err.message}`,
        );
      }
    }

    const updateData: any = {
      status: 'PAID',
      paymentStatus: 'COMPLETED',
    };
    if (odooSaleOrderId) updateData.odooSaleOrderId = odooSaleOrderId;
    if (orderNumber) updateData.orderNumber = orderNumber;
    if (odooInvoiceId) updateData.odooInvoiceId = odooInvoiceId;
    if (odooInvoiceName) updateData.odooInvoiceName = odooInvoiceName;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        items: true,
      },
    });

    this.logger.log(`Order ${orderNumber} manually marked as PAID`);

    // Approve pending commissions; if none exist, create new ones as APPROVED
    try {
      await this.commissionsService.approveCommissionsForOrder(orderId);
      await this.commissionsService.calculateForOrder(orderId, CommissionStatus.APPROVED);
    } catch (err) {
      this.logger.warn(
        `Failed to approve commissions for order ${orderId}: ${err.message}`,
      );
    }

    return updated;
  }

  /**
   * Admin-only: manually mark an order as SHIPPED (fallback without Envia).
   */
  async markAsShipped(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const allowedStatuses: OrderStatus[] = ['PAID'];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot mark order as shipped in status ${order.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        items: true,
      },
    });

    this.logger.log(`Order ${order.orderNumber} manually marked as SHIPPED`);
    return updated;
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PH-${dateStr}`;

    // Get the last order number for today
    const lastOrder = await this.prisma.order.findFirst({
      where: {
        orderNumber: { startsWith: prefix },
      },
      orderBy: { orderNumber: 'desc' },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(
        lastOrder.orderNumber.split('-').pop() || '0',
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }
}
