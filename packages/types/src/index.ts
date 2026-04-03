// ========================
// Enums
// ========================
export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER_L1 = 'SELLER_L1',
  SELLER_L2 = 'SELLER_L2',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
}

export enum CommissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REVERSED = 'REVERSED',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ProductRequestStatus {
  PENDING = 'PENDING',
  NOTIFIED = 'NOTIFIED',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
}

// ========================
// DTOs - Auth
// ========================
export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  odooCompanyId?: number;
}

// ========================
// DTOs - Users
// ========================
export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: UserRole;
  parentId?: string;
  commissionRate?: number;
  odooCompanyId?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  commissionRate: number;
  bankName?: string;
  bankAccountType?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  usdtWalletTrc20?: string;
  isActive: boolean;
}

// ========================
// DTOs - Customers
// ========================
export interface CreateCustomerDto {
  name: string;
  email: string;
  phone: string;
  documentId?: string;
}

export interface CreateAddressDto {
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault?: boolean;
}

export interface CustomerWithAddresses {
  id: string;
  name: string;
  email: string;
  phone: string;
  documentId?: string;
  odooPartnerId?: number;
  addresses: AddressDto[];
}

export interface AddressDto {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

// ========================
// DTOs - Products
// ========================
export interface ProductVariantDto {
  id: string;
  odooProductId: number;
  odooTemplateId: number;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  categoryName?: string;
  attributes: Record<string, string>;
  images: ProductImageDto[];
  isBlocked: boolean;
  isActive: boolean;
}

export interface ProductImageDto {
  id: string;
  url: string;
  thumbnailUrl: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductSyncResult {
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

// ========================
// DTOs - Orders
// ========================
export interface CreateOrderDto {
  customerId: string;
  addressId: string;
  items: CreateOrderItemDto[];
  notes?: string;
}

export interface CreateOrderItemDto {
  variantId: string;
  quantity: number;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerId: string;
  customer: { id: string; name: string; email: string; phone: string };
  addressId: string;
  address: AddressDto;
  items: OrderItemDto[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  paymentLinkUrl?: string;
  paymentStatus: PaymentStatus;
  odooSaleOrderId?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemDto {
  id: string;
  variantId: string;
  variant: { name: string; sku: string; price: number };
  quantity: number;
  unitPrice: number;
  total: number;
}

// ========================
// DTOs - Payments
// ========================
export interface CreatePaymentLinkDto {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName: string;
  metadata?: Record<string, string>;
}

export interface PaymentLinkResult {
  id: string;
  url: string;
  expiresAt: string;
}

export interface PaymentWebhookEvent {
  eventType: string;
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  signature: string;
  timestamp: string;
  rawBody: string;
}

// ========================
// DTOs - Commissions
// ========================
export interface CommissionDto {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  userName: string;
  level: number;
  rate: number;
  baseAmount: number;
  amount: number;
  status: CommissionStatus;
  createdAt: string;
}

// ========================
// DTOs - Dashboard
// ========================
export interface DashboardStats {
  totalRevenue: number;
  pendingBalance: number;
  periodData: PeriodDataPoint[];
  recentPayments: RecentPaymentDto[];
}

export interface PeriodDataPoint {
  label: string;
  value: number;
}

export interface RecentPaymentDto {
  id: string;
  amount: number;
  status: PaymentStatus;
  date: string;
  orderNumber: string;
}

// ========================
// DTOs - App Settings
// ========================
export interface AppSettingDto {
  key: string;
  value: string;
  isSecret: boolean;
  group: string;
  description?: string;
}

// ========================
// API Response
// ========================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ========================
// Odoo
// ========================
export interface OdooProduct {
  id: number;
  name: string;
  default_code: string;
  barcode?: string;
  list_price: number;
  qty_available: number;
  categ_id: [number, string];
  product_tmpl_id: [number, string];
  attribute_value_ids: number[];
  image_1920?: string;
}

export interface OdooPartner {
  id: number;
  name: string;
  email: string;
  phone: string;
  street?: string;
  city?: string;
  state_id?: [number, string];
  zip?: string;
  country_id?: [number, string];
}
