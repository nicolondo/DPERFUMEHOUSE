import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Seeding database...');

  // ── Admin User ──
  const adminPassword = await bcrypt.hash('Admin123!', BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dperfumehouse.com' },
    update: {},
    create: {
      email: 'admin@dperfumehouse.com',
      passwordHash: adminPassword,
      name: 'Administrador',
      phone: '+573001234567',
      role: UserRole.ADMIN,
      commissionRate: 0,
      isActive: true,
    },
  });
  console.log(`Admin: ${admin.email} (${admin.id})`);

  // ── Level 1 Seller ──
  const sellerPassword = await bcrypt.hash('Seller123!', BCRYPT_ROUNDS);
  const sellerL1 = await prisma.user.upsert({
    where: { email: 'seller@dperfumehouse.com' },
    update: {},
    create: {
      email: 'seller@dperfumehouse.com',
      passwordHash: sellerPassword,
      name: 'Maria Garcia',
      phone: '+573009876543',
      role: UserRole.SELLER_L1,
      commissionRate: 0.10,
      bankName: 'Bancolombia',
      bankAccountType: 'savings',
      bankAccountNumber: '12345678901',
      bankAccountHolder: 'Maria Garcia',
      isActive: true,
    },
  });
  console.log(`Seller L1: ${sellerL1.email} (${sellerL1.id})`);

  // ── Level 2 Seller (under L1) ──
  const sellerL2 = await prisma.user.upsert({
    where: { email: 'seller2@dperfumehouse.com' },
    update: {},
    create: {
      email: 'seller2@dperfumehouse.com',
      passwordHash: sellerPassword,
      name: 'Carlos Rodriguez',
      phone: '+573005551234',
      role: UserRole.SELLER_L2,
      parentId: sellerL1.id,
      commissionRate: 0.08,
      bankName: 'Davivienda',
      bankAccountType: 'checking',
      bankAccountNumber: '98765432109',
      bankAccountHolder: 'Carlos Rodriguez',
      isActive: true,
    },
  });
  console.log(`Seller L2: ${sellerL2.email} (${sellerL2.id}) -> parent: ${sellerL1.name}`);

  // ── App Settings ──
  const settings = [
    // Odoo
    { key: 'odoo_url', value: 'https://alleensa.odoo.com', group: 'odoo', description: 'Odoo instance URL' },
    { key: 'odoo_db', value: 'alleensa-prod-16232407', group: 'odoo', description: 'Odoo database name' },
    { key: 'odoo_uid', value: '2', group: 'odoo', description: 'Odoo user ID' },
    { key: 'odoo_api_key', value: '', isSecret: true, group: 'odoo', description: 'Odoo API key' },
    // Payments
    { key: 'myxspend_email', value: '', isSecret: true, group: 'payments', description: 'MyxSpend login email' },
    { key: 'myxspend_password', value: '', isSecret: true, group: 'payments', description: 'MyxSpend login password' },
    { key: 'myxspend_base_url', value: 'https://api.myxspend.com/v1', group: 'payments', description: 'MyxSpend API base URL' },
    { key: 'myxspend_postback_url', value: '', group: 'payments', description: 'MyxSpend webhook postback URL' },
    // Wompi
    { key: 'wompi_public_key', value: '', group: 'payments', description: 'Wompi public key' },
    { key: 'wompi_private_key', value: '', isSecret: true, group: 'payments', description: 'Wompi private key' },
    { key: 'wompi_events_secret', value: '', isSecret: true, group: 'payments', description: 'Wompi events secret for webhook verification' },
    { key: 'wompi_integrity_secret', value: '', isSecret: true, group: 'payments', description: 'Wompi integrity secret for payment signatures' },
    { key: 'wompi_environment', value: 'sandbox', group: 'payments', description: 'Wompi environment (sandbox or production)' },
    // Monabit
    { key: 'monabit_merchant_id', value: '8wzLX98jV6843094Z7gtwu', group: 'payments', description: 'Monabit Merchant ID' },
    { key: 'monabit_api_key_test', value: '', isSecret: true, group: 'payments', description: 'Monabit testing API key' },
    { key: 'monabit_api_key_prod', value: '', isSecret: true, group: 'payments', description: 'Monabit production API key' },
    { key: 'monabit_environment', value: 'sandbox', group: 'payments', description: 'Monabit environment (sandbox or production)' },
    // Payment provider
    { key: 'active_payment_provider', value: 'myxspend', group: 'payments', description: 'Active payment provider (myxspend, wompi or monabit)' },
    { key: 'cash_payment_enabled', value: 'true', group: 'payments', description: 'Enable cash payments (non-Wompi)' },
    // Commissions
    { key: 'commission_l1_rate', value: '10', group: 'commissions', description: 'Default L1 seller commission rate (%)' },
    { key: 'commission_l2_rate', value: '3', group: 'commissions', description: 'Default L2 seller commission rate (%)' },
    // General
    { key: 'tax_rate', value: '19', group: 'general', description: 'Default tax rate (IVA %)' },
    { key: 'default_shipping', value: '15000', group: 'general', description: 'Default shipping cost (COP)' },
    { key: 'default_currency', value: 'USD', group: 'general', description: 'Default currency for payments' },
    // Storage
    { key: 'storage_type', value: 'local', group: 'storage', description: 'Image storage type (local or s3)' },
    // Shipping (Envia)
    { key: 'shipping_origin_name', value: 'D Perfume House', group: 'shipping', description: 'Shipping origin contact name' },
    { key: 'shipping_origin_phone', value: '+573001234567', group: 'shipping', description: 'Shipping origin phone' },
    { key: 'shipping_origin_street', value: 'Calle 100 #15-20', group: 'shipping', description: 'Shipping origin street' },
    { key: 'shipping_origin_city', value: 'Bogota', group: 'shipping', description: 'Shipping origin city' },
    { key: 'shipping_origin_state', value: 'CUN', group: 'shipping', description: 'Shipping origin state code' },
    { key: 'shipping_origin_country', value: 'CO', group: 'shipping', description: 'Shipping origin country code' },
    { key: 'shipping_origin_zip', value: '110111', group: 'shipping', description: 'Shipping origin postal code' },
    { key: 'shipping_default_weight', value: '1', group: 'shipping', description: 'Default package weight in KG' },
    { key: 'shipping_default_dimensions', value: '{"length":25,"width":20,"height":10}', group: 'shipping', description: 'Default package dimensions in CM (JSON)' },
    { key: 'envia_api_key', value: '', group: 'shipping', description: 'Envia.com API key', isSecret: true },
    { key: 'envia_base_url', value: 'https://api.envia.com', group: 'shipping', description: 'Envia API base URL' },
    { key: 'envia_queries_url', value: 'https://queries.envia.com', group: 'shipping', description: 'Envia Queries API URL' },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: {
        key: setting.key,
        value: setting.value,
        isSecret: setting.isSecret || false,
        group: setting.group,
        description: setting.description,
      },
    });
  }
  console.log(`${settings.length} app settings created`);

  // ── Sample Customer ──
  const customer = await prisma.customer.upsert({
    where: {
      email_sellerId: { email: 'cliente@example.com', sellerId: sellerL1.id },
    },
    update: {},
    create: {
      name: 'Ana Lopez',
      email: 'cliente@example.com',
      phone: '+573001112233',
      documentId: '1234567890',
      sellerId: sellerL1.id,
    },
  });

  await prisma.customerAddress.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      customerId: customer.id,
      label: 'Casa',
      street: 'Calle 100 #15-20 Apto 301',
      city: 'Bogota',
      state: 'Cundinamarca',
      zip: '110111',
      country: 'CO',
      isDefault: true,
    },
  });
  console.log(`Sample customer: ${customer.name} (${customer.id})`);

  // ── Sample Products ──
  const products = [
    {
      odooProductId: 1001,
      odooTemplateId: 101,
      name: 'Acqua di Gio - EDT 100ml',
      sku: 'ADG-EDT-100',
      price: 350000,
      stock: 25,
      categoryName: 'Masculino',
      attributes: { size: '100ml', type: 'EDT' },
    },
    {
      odooProductId: 1002,
      odooTemplateId: 101,
      name: 'Acqua di Gio - EDT 50ml',
      sku: 'ADG-EDT-50',
      price: 250000,
      stock: 15,
      categoryName: 'Masculino',
      attributes: { size: '50ml', type: 'EDT' },
    },
    {
      odooProductId: 1003,
      odooTemplateId: 102,
      name: 'Chanel No.5 - EDP 100ml',
      sku: 'CH5-EDP-100',
      price: 520000,
      stock: 10,
      categoryName: 'Femenino',
      attributes: { size: '100ml', type: 'EDP' },
    },
    {
      odooProductId: 1004,
      odooTemplateId: 103,
      name: 'Dior Sauvage - EDT 100ml',
      sku: 'DS-EDT-100',
      price: 420000,
      stock: 0,
      categoryName: 'Masculino',
      attributes: { size: '100ml', type: 'EDT' },
    },
    {
      odooProductId: 1005,
      odooTemplateId: 104,
      name: 'La Vie Est Belle - EDP 75ml',
      sku: 'LVEB-EDP-75',
      price: 380000,
      stock: 18,
      categoryName: 'Femenino',
      attributes: { size: '75ml', type: 'EDP' },
    },
    {
      odooProductId: 1006,
      odooTemplateId: 105,
      name: 'Bleu de Chanel - EDP 100ml',
      sku: 'BDC-EDP-100',
      price: 490000,
      stock: 8,
      categoryName: 'Masculino',
      attributes: { size: '100ml', type: 'EDP' },
    },
  ];

  for (const product of products) {
    await prisma.productVariant.upsert({
      where: { odooProductId: product.odooProductId },
      update: { stock: product.stock, price: product.price },
      create: product,
    });
  }
  console.log(`${products.length} sample products created`);

  console.log('\nSeed completed successfully!');
  console.log('\nTest accounts:');
  console.log('  Admin:     admin@dperfumehouse.com / Admin123!');
  console.log('  Seller L1: seller@dperfumehouse.com / Seller123!');
  console.log('  Seller L2: seller2@dperfumehouse.com / Seller123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
