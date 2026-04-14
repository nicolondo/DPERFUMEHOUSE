// Local type definitions for the seller app
// These mirror the backend types for API communication

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  sellerId?: string;
  phone?: string;
  commissionRate?: number;
}

export interface Seller {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  commissionRate: number;
  bankName?: string;
  bankAccountType?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  bankCertificateUrl?: string;
  usdtWallet?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  sellerId: string;
  name: string;
  email?: string;
  phone: string;
  documentType?: string;
  documentNumber?: string;
  notes?: string;
  addresses: Address[];
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  customerId: string;
  label: string;
  street: string;
  detail?: string;
  phone?: string;
  city: string;
  state: string;
  zipCode?: string;
  country: string;
  isDefault: boolean;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  description?: string;
  categoryId: string;
  category?: Category;
  images: string[];
  variants: ProductVariant[];
  isActive: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  size: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  isActive: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'confirmed_odoo'
  | 'payment_pending'
  | 'paid'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  sellerId: string;
  customerId: string;
  customer?: Customer;
  addressId: string;
  address?: Address;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentLink?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  variant?: ProductVariant & { product?: Product };
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DashboardStats {
  period: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  periodRevenue?: number;
  totalOrders: number;
  totalCustomers: number;
  pendingBalance: number;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  commissionsByDay?: Array<{
    date: string;
    commission: number;
    count: number;
  }>;
  recentPayments: Array<{
    id: string;
    orderNumber: string;
    amount: number;
    status: PaymentStatus;
    date: string;
    customerName: string;
  }>;
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone: string;
  documentType?: string;
  documentNumber?: string;
  notes?: string;
  address?: Omit<Address, 'id' | 'customerId'>;
}

export interface CreateOrderInput {
  customerId: string;
  addressId: string;
  items: Array<{
    variantId: string;
    quantity: number;
  }>;
  notes?: string;
  paymentMethod?: 'ONLINE' | 'CASH';
  applyPromoDiscount?: boolean;
}

// Cart item for local state
export interface CartItem {
  variant: ProductVariant & { product?: Product };
  quantity: number;
}
