"use strict";
// Shared configuration constants
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_NAMES = exports.CURRENCY = exports.COMMISSION = exports.PAYMENT = exports.ODOO = exports.IMAGE = exports.AUTH = exports.PAGINATION = exports.APP_VERSION = exports.APP_NAME = void 0;
exports.APP_NAME = 'D Perfume House';
exports.APP_VERSION = '0.1.0';
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
};
exports.AUTH = {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    BCRYPT_ROUNDS: 12,
    MIN_PASSWORD_LENGTH: 8,
};
exports.IMAGE = {
    MAX_WIDTH: 1500,
    THUMBNAIL_WIDTH: 300,
    QUALITY: 80,
    THUMBNAIL_QUALITY: 70,
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    MAX_SIZE_MB: 10,
};
exports.ODOO = {
    SYNC_BATCH_SIZE: 100,
    STOCK_CHECK_TIMEOUT_MS: 5000,
};
exports.PAYMENT = {
    LINK_EXPIRY_HOURS: 48,
    WEBHOOK_TOLERANCE_SECONDS: 300,
};
exports.COMMISSION = {
    DEFAULT_L1_RATE: 0.10,
    DEFAULT_L2_RATE: 0.03,
};
exports.CURRENCY = {
    DEFAULT: 'COP',
    DECIMALS: 0,
};
exports.QUEUE_NAMES = {
    ODOO_SYNC: 'odoo-sync',
    PAYMENT_PROCESS: 'payment-process',
    EMAIL_SEND: 'email-send',
    IMAGE_PROCESS: 'image-process',
    COMMISSION_CALC: 'commission-calc',
};
