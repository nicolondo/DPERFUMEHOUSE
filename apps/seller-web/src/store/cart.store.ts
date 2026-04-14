import { create } from 'zustand';
import type { Customer, Address, CartItem, ProductVariant, Product } from '@/lib/types';

interface OrderConfig {
  taxRate: number;
  shippingCost: number;
  freeShippingThreshold: number;
  cashPaymentEnabled?: boolean;
}

interface CartState {
  selectedCustomer: Customer | null;
  selectedAddress: Address | null;
  items: Map<string, CartItem>;
  notes: string;
  orderConfig: OrderConfig;

  // Customer & Address
  setCustomer: (customer: Customer | null) => void;
  setAddress: (address: Address | null) => void;

  // Items
  addItem: (variant: ProductVariant & { product?: Product }) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  getItemQuantity: (variantId: string) => number;

  // Notes
  setNotes: (notes: string) => void;

  // Config
  setOrderConfig: (config: OrderConfig) => void;

  // Computed
  itemCount: () => number;
  subtotal: () => number;
  tax: () => number;
  shipping: () => number;
  total: () => number;
  itemsArray: () => CartItem[];

  // Reset
  clearCart: () => void;
  resetFlow: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  selectedCustomer: null,
  selectedAddress: null,
  items: new Map(),
  notes: '',
  orderConfig: {
    taxRate: 0,
    shippingCost: 0,
    freeShippingThreshold: 200000,
    cashPaymentEnabled: true,
  },

  setCustomer: (customer) => set({ selectedCustomer: customer }),
  setAddress: (address) => set({ selectedAddress: address }),

  addItem: (variant) => {
    const items = new Map(get().items);
    const existing = items.get(variant.id);
    if (existing) {
      items.set(variant.id, { ...existing, quantity: existing.quantity + 1 });
    } else {
      items.set(variant.id, { variant, quantity: 1 });
    }
    set({ items });
  },

  removeItem: (variantId) => {
    const items = new Map(get().items);
    items.delete(variantId);
    set({ items });
  },

  updateQuantity: (variantId, quantity) => {
    const items = new Map(get().items);
    const existing = items.get(variantId);
    if (existing) {
      if (quantity <= 0) {
        items.delete(variantId);
      } else {
        items.set(variantId, { ...existing, quantity });
      }
    }
    set({ items });
  },

  getItemQuantity: (variantId) => {
    return get().items.get(variantId)?.quantity ?? 0;
  },

  setNotes: (notes) => set({ notes }),

  setOrderConfig: (config) => set({ orderConfig: config }),

  itemCount: () => {
    let count = 0;
    get().items.forEach((item) => {
      count += item.quantity;
    });
    return count;
  },

  subtotal: () => {
    let total = 0;
    get().items.forEach((item) => {
      total += item.variant.price * item.quantity;
    });
    return total;
  },

  tax: () => {
    const { taxRate } = get().orderConfig;
    return Math.round(get().subtotal() * taxRate);
  },

  shipping: () => {
    const subtotal = get().subtotal();
    if (subtotal === 0) return 0;
    const { shippingCost, freeShippingThreshold } = get().orderConfig;
    return subtotal >= freeShippingThreshold && freeShippingThreshold > 0 ? 0 : shippingCost;
  },

  total: () => {
    return get().subtotal() + get().tax() + get().shipping();
  },

  itemsArray: () => {
    return Array.from(get().items.values());
  },

  clearCart: () => {
    set({ items: new Map(), notes: '' });
  },

  resetFlow: () => {
    set({
      selectedCustomer: null,
      selectedAddress: null,
      items: new Map(),
      notes: '',
    });
  },
}));
