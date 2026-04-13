import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuantityDiscountDto, UpdateQuantityDiscountDto } from './dto';

@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.quantityDiscount.findMany({
      orderBy: [{ priority: 'desc' }, { minQuantity: 'asc' }],
      include: {
        variant: { select: { id: true, name: true, sku: true, categoryName: true } },
      },
    });
  }

  async findOne(id: string) {
    const discount = await this.prisma.quantityDiscount.findUnique({
      where: { id },
      include: {
        variant: { select: { id: true, name: true, sku: true, categoryName: true } },
      },
    });
    if (!discount) throw new NotFoundException('Descuento no encontrado');
    return discount;
  }

  async create(dto: CreateQuantityDiscountDto) {
    return this.prisma.quantityDiscount.create({
      data: {
        name: dto.name,
        minQuantity: dto.minQuantity,
        discountPercent: dto.discountPercent,
        categories: dto.categories && dto.categories.length > 0 ? dto.categories : [],
        variantId: dto.variantId || null,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0,
      },
      include: {
        variant: { select: { id: true, name: true, sku: true, categoryName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateQuantityDiscountDto) {
    await this.findOne(id);
    return this.prisma.quantityDiscount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.minQuantity !== undefined && { minQuantity: dto.minQuantity }),
        ...(dto.discountPercent !== undefined && { discountPercent: dto.discountPercent }),
        ...(dto.categories !== undefined && { categories: dto.categories || [] }),
        ...(dto.variantId !== undefined && { variantId: dto.variantId || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
      },
      include: {
        variant: { select: { id: true, name: true, sku: true, categoryName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.quantityDiscount.delete({ where: { id } });
  }

  /**
   * Find the best applicable discount for a given variant + quantity.
   * Priority: variant-specific > category-specific > global.
   * Within the same scope, the highest minQuantity that the qty satisfies wins.
   */
  async findBestDiscount(variantId: string, categoryName: string | null, quantity: number) {
    const discounts = await this.prisma.quantityDiscount.findMany({
      where: {
        isActive: true,
        minQuantity: { lte: quantity },
      },
      orderBy: [{ priority: 'desc' }, { minQuantity: 'desc' }],
    });

    if (discounts.length === 0) return null;

    // Prefer variant-specific, then category, then global
    const variantDiscount = discounts.find((d) => d.variantId === variantId);
    if (variantDiscount) return variantDiscount;

    if (categoryName) {
      const categoryDiscount = discounts.find((d) => {
        if (d.variantId) return false;
        const cats = (d.categories as string[]) || [];
        return cats.length > 0 && cats.includes(categoryName);
      });
      if (categoryDiscount) return categoryDiscount;
    }

    return discounts.find((d) => {
      const cats = (d.categories as string[]) || [];
      return !d.variantId && cats.length === 0;
    }) || null;
  }

  /**
   * Preview discounts for a list of items (used in order summary).
   */
  async previewDiscounts(items: { variantId: string; quantity: number }[]) {
    const variantIds = items.map((i) => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, name: true, price: true, categoryName: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotal = 0;
    let totalDiscount = 0;
    const lineItems: {
      variantId: string;
      variantName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      discountPercent: number;
      discountAmount: number;
      finalTotal: number;
    }[] = [];

    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) continue;
      const unitPrice = Number(variant.price);
      const lineTotal = unitPrice * item.quantity;

      const discount = await this.findBestDiscount(item.variantId, variant.categoryName, item.quantity);
      const discountPercent = discount ? Number(discount.discountPercent) : 0;
      const discountAmount = Math.round(lineTotal * discountPercent / 100);
      const finalTotal = lineTotal - discountAmount;

      subtotal += lineTotal;
      totalDiscount += discountAmount;

      lineItems.push({
        variantId: item.variantId,
        variantName: variant.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        discountPercent,
        discountAmount,
        finalTotal,
      });
    }

    return {
      items: lineItems,
      subtotal,
      totalDiscount,
      total: subtotal - totalDiscount,
    };
  }
}
