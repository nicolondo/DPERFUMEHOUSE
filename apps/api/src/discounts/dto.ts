export class CreateQuantityDiscountDto {
  name: string;
  minQuantity: number;
  discountPercent: number;
  categoryName?: string;
  variantId?: string;
  isActive?: boolean;
  priority?: number;
}

export class UpdateQuantityDiscountDto {
  name?: string;
  minQuantity?: number;
  discountPercent?: number;
  categoryName?: string;
  variantId?: string | null;
  isActive?: boolean;
  priority?: number;
}
