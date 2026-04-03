// Shared configuration constants

export const APP_NAME = 'D Perfume House';
export const APP_VERSION = '0.1.0';

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const AUTH = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  BCRYPT_ROUNDS: 12,
  MIN_PASSWORD_LENGTH: 8,
} as const;

export const IMAGE = {
  MAX_WIDTH: 1500,
  THUMBNAIL_WIDTH: 300,
  QUALITY: 80,
  THUMBNAIL_QUALITY: 70,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_SIZE_MB: 10,
} as const;

export const ODOO = {
  SYNC_BATCH_SIZE: 100,
  STOCK_CHECK_TIMEOUT_MS: 5000,
} as const;

export const PAYMENT = {
  LINK_EXPIRY_HOURS: 48,
  WEBHOOK_TOLERANCE_SECONDS: 300,
} as const;

export const COMMISSION = {
  DEFAULT_L1_RATE: 10,
  DEFAULT_L2_RATE: 3,
} as const;

export const CURRENCY = {
  DEFAULT: 'COP',
  DECIMALS: 0,
} as const;

export const QUEUE_NAMES = {
  ODOO_SYNC: 'odoo-sync',
  PAYMENT_PROCESS: 'payment-process',
  EMAIL_SEND: 'email-send',
  IMAGE_PROCESS: 'image-process',
  COMMISSION_CALC: 'commission-calc',
} as const;
