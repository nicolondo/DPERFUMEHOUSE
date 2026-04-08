import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { randomBytes } from 'crypto';
import { GenerateLinkDto, PurchaseDto } from './dto';

@Injectable()
export class SellerProductLinksService {
  private readonly logger = new Logger(SellerProductLinksService.name);
  private readonly sellerAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
  ) {
    this.sellerAppUrl = this.configService.get<string>(
      'SELLER_APP_URL',
      'https://pos.dperfumehouse.com',
    );
  }

  private generateCode(): string {
    return randomBytes(4).toString('hex'); // 8-char hex code
  }

  async generate(sellerId: string, dto: GenerateLinkDto) {
    // Verify variant exists and is active
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, isActive: true, isBlocked: false },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
      },
    });

    if (!variant) {
      throw new NotFoundException('Producto no encontrado o no disponible');
    }

    // Upsert: return existing or create new
    const existing = await this.prisma.sellerProductLink.findUnique({
      where: {
        sellerId_variantId: { sellerId, variantId: dto.variantId },
      },
      include: {
        variant: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    if (existing) {
      // Reactivate if was deactivated
      if (!existing.isActive) {
        await this.prisma.sellerProductLink.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return {
        ...existing,
        isActive: true,
        url: `${this.sellerAppUrl}/buy/${existing.code}`,
      };
    }

    const link = await this.prisma.sellerProductLink.create({
      data: {
        code: this.generateCode(),
        sellerId,
        variantId: dto.variantId,
      },
      include: {
        variant: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    this.logger.log(
      `Seller ${sellerId} generated link ${link.code} for variant ${variant.name}`,
    );

    return {
      ...link,
      url: `${this.sellerAppUrl}/buy/${link.code}`,
    };
  }

  async findAll(sellerId: string) {
    const links = await this.prisma.sellerProductLink.findMany({
      where: { sellerId, isActive: true },
      include: {
        variant: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            categoryName: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => ({
      ...link,
      url: `${this.sellerAppUrl}/buy/${link.code}`,
    }));
  }

  async deactivate(id: string, sellerId: string) {
    const link = await this.prisma.sellerProductLink.findFirst({
      where: { id, sellerId },
    });

    if (!link) {
      throw new NotFoundException('Link no encontrado');
    }

    await this.prisma.sellerProductLink.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Link desactivado' };
  }

  async getPublic(code: string) {
    const link = await this.prisma.sellerProductLink.findUnique({
      where: { code },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            phoneCode: true,
            sellerCode: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            categoryName: true,
            attributes: true,
            images: { orderBy: { sortOrder: 'asc' } },
            fragranceProfile: {
              select: {
                familiaOlfativa: true,
                intensidad: true,
                duracionEstimada: true,
                contextoIdeal: true,
                descripcionDetallada: true,
                genero: true,
                frasePositionamiento: true,
              },
            },
          },
        },
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Link no encontrado o inactivo');
    }

    // Increment views
    await this.prisma.sellerProductLink.update({
      where: { id: link.id },
      data: { views: { increment: 1 } },
    });

    return link;
  }

  async purchase(code: string, dto: PurchaseDto) {
    const link = await this.prisma.sellerProductLink.findUnique({
      where: { code },
      include: {
        seller: { select: { id: true, name: true } },
        variant: true,
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Link no encontrado o inactivo');
    }

    const variant = link.variant;

    // Validate stock
    if (variant.stock < dto.quantity) {
      throw new BadRequestException(
        `Stock insuficiente: disponible ${variant.stock}, solicitado ${dto.quantity}`,
      );
    }

    const sellerId = link.sellerId;

    // Find or create customer under this seller
    let customer = await this.prisma.customer.findFirst({
      where: {
        sellerId,
        OR: [
          ...(dto.phone ? [{ phone: dto.phone, sellerId }] : []),
          ...(dto.email ? [{ email: dto.email, sellerId }] : []),
        ],
      },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email || null,
          sellerId,
          ...(dto.legalIdType ? { documentType: dto.legalIdType } : {}),
          ...(dto.legalId ? { documentNumber: dto.legalId } : {}),
        },
      });
    } else if (dto.legalId && dto.legalIdType) {
      // Update document info if not already set
      if (!customer.documentNumber) {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { documentType: dto.legalIdType, documentNumber: dto.legalId },
        });
      }
    }

    // Create address
    const address = await this.prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        street: dto.street,
        city: dto.city,
        state: dto.state || null,
        detail: dto.detail || null,
        phone: dto.addressPhone || dto.phone,
        label: 'Dirección de envío',
      },
    });

    // Create order via the orders service
    const order = await this.ordersService.createOrder(
      {
        customerId: customer.id,
        addressId: address.id,
        items: [{ variantId: variant.id, quantity: dto.quantity }],
        paymentMethod: 'ONLINE',
      },
      sellerId,
    );

    if (!order) {
      throw new BadRequestException('No se pudo crear el pedido');
    }

    // Increment conversions
    await this.prisma.sellerProductLink.update({
      where: { id: link.id },
      data: { conversions: { increment: 1 } },
    });

    // Fetch payment link URL
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { orderId: order.id },
      select: { url: true },
    });

    this.logger.log(
      `Purchase via link ${code}: order ${order.orderNumber} for seller ${sellerId}`,
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentUrl: paymentLink?.url || null,
    };
  }
}
