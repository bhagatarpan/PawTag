import { connectDatabase, Product, Setting } from '@pawtag/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const products = [
  {
    name: 'PawTag Scan',
    description: 'Our essential QR code pet tag. Simply scan with any smartphone camera to view your pet\'s profile, medical info, and owner contact details. Made from durable plastic with a printed QR code. Includes 12 months free subscription — after that just $0.99/month billed annually.',
    shortDescription: 'QR code tag — scan with phone camera',
    price: 9.99,
    currency: 'NZD',
    images: [],
    category: 'PawTag',
    tags: ['qr', 'plastic', 'essential', 'subscription'],
    isActive: true,
    stock: 500,
    sku: 'PT-SCAN-001',
    variants: [],
    customizable: false,
    customizationPrice: 0,
    shippingCost: 0,
    warrantyMonths: 12,
    isSubscription: true,
    subscriptionConfig: {
      type: 'annual',
      freePeriodMonths: 12,
      gracePeriodWeeks: 4,
      monthlyPrice: 0.99,
      features: ['qr_scan', 'lost_pet_alerts', 'finder_notifications'],
    },
  },
  {
    name: 'PawTag Classic',
    description: 'Our most popular NFC pet tag. Simply tap with any NFC-enabled smartphone to instantly view your pet\'s profile, medical info, and owner contact details. Made from durable plastic with a built-in NFC chip. Includes 12 months free subscription — after that just $1.99/month billed annually.',
    shortDescription: 'NFC tag — tap with phone (Most Ordered)',
    price: 19.99,
    currency: 'NZD',
    images: [],
    category: 'PawTag',
    tags: ['nfc', 'plastic', 'popular', 'subscription'],
    isActive: true,
    stock: 500,
    sku: 'PT-CLASSIC-001',
    variants: [],
    customizable: false,
    customizationPrice: 0,
    shippingCost: 0,
    warrantyMonths: 12,
    isSubscription: true,
    subscriptionConfig: {
      type: 'annual',
      freePeriodMonths: 12,
      gracePeriodWeeks: 4,
      monthlyPrice: 1.99,
      features: ['nfc_scan', 'qr_scan', 'lost_pet_alerts', 'finder_notifications'],
    },
  },
  {
    name: 'PawTag Plus',
    description: 'Our premium NFC pet tag with metal edges and epoxy resin coating for ultimate durability. Simply tap with any NFC-enabled smartphone to instantly view your pet\'s profile, medical info, and owner contact details. Built to withstand the most active pets. Includes 12 months free subscription — after that just $1.99/month billed annually.',
    shortDescription: 'NFC tag — metal edges + epoxy resin',
    price: 39.99,
    currency: 'NZD',
    images: [],
    category: 'PawTag',
    tags: ['nfc', 'metal', 'premium', 'epoxy', 'subscription'],
    isActive: true,
    stock: 300,
    sku: 'PT-PLUS-001',
    variants: [],
    customizable: false,
    customizationPrice: 0,
    shippingCost: 0,
    warrantyMonths: 12,
    isSubscription: true,
    subscriptionConfig: {
      type: 'annual',
      freePeriodMonths: 12,
      gracePeriodWeeks: 4,
      monthlyPrice: 1.99,
      features: ['nfc_scan', 'qr_scan', 'lost_pet_alerts', 'finder_notifications'],
    },
  },
];

async function seedProducts() {
  try {
    await connectDatabase();
    console.log('Connected to MongoDB');

    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');

    // Insert new products
    const result = await Product.insertMany(products);
    console.log(`Seeded ${result.length} products`);

    for (const p of result) {
      console.log(`  - ${p.name} (${p.sku}) — $${p.price} NZD + subscription`);
    }

    // Seed company settings
    const companySettings = [
      { key: 'company.name', value: 'PawTag Ltd', category: 'company', description: 'Company name for invoices and emails' },
      { key: 'company.address', value: '123 Street, Auckland 1010, New Zealand', category: 'company', description: 'Company address for invoices' },
      { key: 'company.phone', value: '+64 21 123 4567', category: 'company', description: 'Company phone number' },
      { key: 'company.email', value: 'billing@pawtag.co.nz', category: 'company', description: 'Billing email address' },
      { key: 'company.gst', value: 'GST123456789', category: 'company', description: 'GST/Tax registration number' },
      { key: 'company.website', value: 'pawtag.co.nz', category: 'company', description: 'Company website' },
      { key: 'company.logo', value: '', category: 'company', description: 'Company logo URL for invoices' },
    ];
    for (const s of companySettings) {
      await Setting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
    }
    console.log(`Seeded ${companySettings.length} company settings`);

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedProducts();
