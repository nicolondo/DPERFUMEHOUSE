export declare const APP_NAME = "D Perfume House";
export declare const APP_VERSION = "0.1.0";
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_PAGE_SIZE: 20;
    readonly MAX_PAGE_SIZE: 100;
};
export declare const AUTH: {
    readonly ACCESS_TOKEN_EXPIRY: "15m";
    readonly REFRESH_TOKEN_EXPIRY: "7d";
    readonly BCRYPT_ROUNDS: 12;
    readonly MIN_PASSWORD_LENGTH: 8;
};
export declare const IMAGE: {
    readonly MAX_WIDTH: 1500;
    readonly THUMBNAIL_WIDTH: 300;
    readonly QUALITY: 80;
    readonly THUMBNAIL_QUALITY: 70;
    readonly ALLOWED_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/webp"];
    readonly MAX_SIZE_MB: 10;
};
export declare const ODOO: {
    readonly SYNC_BATCH_SIZE: 100;
    readonly STOCK_CHECK_TIMEOUT_MS: 5000;
};
export declare const PAYMENT: {
    readonly LINK_EXPIRY_HOURS: 48;
    readonly WEBHOOK_TOLERANCE_SECONDS: 300;
};
export declare const COMMISSION: {
    readonly DEFAULT_L1_RATE: 0.1;
    readonly DEFAULT_L2_RATE: 0.03;
};
export declare const CURRENCY: {
    readonly DEFAULT: "COP";
    readonly DECIMALS: 0;
};
export declare const QUEUE_NAMES: {
    readonly ODOO_SYNC: "odoo-sync";
    readonly PAYMENT_PROCESS: "payment-process";
    readonly EMAIL_SEND: "email-send";
    readonly IMAGE_PROCESS: "image-process";
    readonly COMMISSION_CALC: "commission-calc";
};
