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
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED';

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
  paymentLink?: { url: string; status: string } | null;
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
  totalOrders: number;
  periodRevenue: number;
  totalCustomers: number;
  pendingBalance: number;
  totalCommissions: number;
  totalCommissionsCount: number;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  commissionsByDay: Array<{
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
  phoneCode?: string;
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
}

// Cart item for local state
export interface CartItem {
  variant: ProductVariant & { product?: Product };
  quantity: number;
}

// ── Leads & Questionnaire ──

export type LeadStatus = 'SENT' | 'RESPONDED' | 'APPOINTMENT' | 'VISITED' | 'CONVERTED';
export type LeadMode = 'PERSONAL' | 'PUBLIC';

export interface Lead {
  id: string;
  sellerId: string;
  customerId?: string;
  customer?: { id: string; name: string };
  sellerCode: string;
  mode: LeadMode;
  status: LeadStatus;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCity?: string;
  answers?: Record<string, any>;
  aiAnalysis?: any;
  recommendations?: any[];
  sellerScript?: any;
  budgetRange?: string;
  isForGift: boolean;
  giftRecipient?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentLocation?: string;
  appointmentNotes?: string;
  convertedOrderId?: string;
  convertedOrder?: { id: string; orderNumber: string; total: number };
  questionnaireUrl?: string;
  respondedAt?: string;
  appointmentAt?: string;
  visitedAt?: string;
  convertedAt?: string;
  emailSentAt?: string;
  seller?: { id: string; name: string; phone?: string; gender?: string };
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  byStatus: Record<string, number>;
  newLeads: number;
}

export interface QuestionnaireResults {
  id: string;
  clientName?: string;
  clientProfile: any;
  recommendations: Array<{
    productVariantId: string;
    name: string;
    compatibility: number;
    mainArgument: string;
    objectionHandling: string;
    presentationOrder: number;
    product?: {
      id: string;
      name: string;
      price: number;
      images: Array<{ url: string; thumbnailUrl?: string }>;
    };
  }>;
  isForGift: boolean;
  giftRecipient?: string;
  seller: { name: string; phone?: string };
}
