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
  canManageSellers?: boolean;
  canViewAllOrders?: boolean;
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
  identificationNumber?: string;
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
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'CONFIRMED_ODOO'
  | 'PAYMENT_PENDING'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'EXPIRED';

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
  paymentLink?: {
    url: string;
    status: string;
    provider?: string;
    providerUrl?: string | null;
    metadata?: Record<string, any>;
  };
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
  applyQuantityDiscount?: boolean;
}

export type LeadStatus = 'SENT' | 'RESPONDED' | 'APPOINTMENT' | 'VISITED' | 'CONVERTED' | 'PURCHASED';

export interface Lead {
  id: string;
  sellerId: string;
  customerId?: string;
  customer?: Customer;
  seller?: { id: string; name: string };
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCity?: string;
  status: LeadStatus;
  mode?: string;
  aiAnalysis?: any;
  recommendations?: any[];
  sellerScript?: any;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentLocation?: string;
  appointmentNotes?: string;
  appointmentAt?: string;
  respondedAt?: string;
  visitedAt?: string;
  convertedAt?: string;
  convertedOrder?: any;
  purchasedOrderId?: string;
  purchasedAt?: string;
  purchaseMatch?: {
    recommended: Array<{ variantId: string; name: string; compatibility: number }>;
    purchased: Array<{ variantId: string; name: string }>;
    matched: Array<{ variantId: string; name: string; compatibility: number }>;
    unmatched: Array<{ variantId: string; name: string; compatibility: number }>;
    extra: Array<{ variantId: string; name: string }>;
    matchRate: number;
    boughtRecommended: boolean;
  };
  orderId?: string;
  budgetRange?: string;
  isForGift?: boolean;
  giftRecipient?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  newLeads: number;
  byStatus: Record<string, number>;
  sent?: number;
  responded?: number;
  appointment?: number;
  visited?: number;
  converted?: number;
  conversionRate?: number;
}

// Cart item for local state
export interface CartItem {
  variant: ProductVariant & { product?: Product };
  quantity: number;
}
