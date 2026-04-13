export class CreateQuantityDiscountDto {
  name: string;
  minQuantity: number;
  discountPercent: number;
  categories?: string[];
  variantId?: string;
  isActive?: boolean;
  priority?: number;
}

export class UpdateQuantityDiscountDto {
  name?: string;
  minQuantity?: number;
  discountPercent?: number;
  categories?: string[];
  variantId?: string | null;
  isActive?: boolean;
  priority?: number;
}
