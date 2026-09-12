import { connectDatabase, Product, Setting } from '@pawtag/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:5000';

const products = [
   {
     name: 'PawTag Scan',
     slug: 'pawtag-scan',
     description: 'Our essential QR code pet tag. Simply scan with any smartphone camera to view your pet\'s profile, medical info, and owner contact details. Made from durable plastic with a printed QR code. Includes 12 months free subscription — after that just $0.99/month billed annually.',
     shortDescription: 'QR code tag — scan with phone camera',
    price: 9.99,
    currency: 'NZD',
    images: [`${API_URL}/api/uploads/products/pawtag-scan.svg`],
    category: 'PawTag',
    tags: ['qr', 'plastic', 'essential', 'subscription'],
    isActive: true,
    stock: 500,
    sku: 'PT-SCAN-001',
    variants: [],
      customizable: false,
      customizationLabel: '',
      customizationPrice: 0,
    shippingCost: 0,
    warrantyMonths: 12,
    isSubscription: true,
    subscriptionConfig: {
      type: 'annual',
      freePeriodMonths: 12,
      gracePeriodWeeks: 4,
features: ['qr_scan', 'lost_pet_alerts', 'finder_notifications'],
     },
     featureHighlights: [
       { icon: 'Shield', description: '12 month warranty' },
       { icon: 'Truck', description: 'Free NZ-wide shipping' },
       { icon: 'Check', description: '12 months free subscription included' }
     ],
   },
{
     name: 'PawTag Classic',
     slug: 'pawtag-classic',
     description: 'Our most popular NFC pet tag. Simply tap with any NFC-enabled smartphone to instantly view your pet\'s profile, medical info, and owner contact details. Made from durable plastic with a built-in NFC chip. Includes 12 months free subscription — after that just $1.99/month billed annually.',
     shortDescription: 'NFC tag — tap with phone (Most Ordered)',
    price: 19.99,
    currency: 'NZD',
    images: [`${API_URL}/api/uploads/products/pawtag-classic.svg`],
    category: 'PawTag',
    tags: ['nfc', 'plastic', 'popular', 'subscription'],
    isActive: true,
    stock: 500,
      sku: 'PT-CLASSIC-001',
      variants: [],
      customizable: true,
      customizationLabel: 'Pet name',
      customizationPrice: 5.00,
      shippingCost: 0,
      warrantyMonths: 12,
      isSubscription: true,
      subscriptionConfig: {
        type: 'annual',
        freePeriodMonths: 12,
        gracePeriodWeeks: 4,
features: ['nfc_scan', 'qr_scan', 'lost_pet_alerts', 'finder_notifications'],
     },
     featureHighlights: [
       { icon: 'Shield', description: '12 month warranty' },
       { icon: 'Truck', description: 'Free NZ-wide shipping' },
       { icon: 'Check', description: '12 months free subscription included' }
     ],
   },
 {
      name: 'PawTag Plus',
     slug: 'pawtag-plus',
     description: 'Our premium NFC pet tag with metal edges and epoxy resin coating for ultimate durability. Simply tap with any NFC-enabled smartphone to instantly view your pet\'s profile, medical info, and owner contact details. Built to withstand the most active pets. Includes 12 months free subscription — after that just $1.99/month billed annually.',
     shortDescription: 'NFC tag — metal edges + epoxy resin',
    price: 39.99,
    currency: 'NZD',
    images: [`${API_URL}/api/uploads/products/pawtag-plus.svg`],
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
features: ['nfc_scan', 'qr_scan', 'lost_pet_alerts', 'finder_notifications'],
     },
      featureHighlights: [
        { icon: 'Shield', description: '12 month warranty' },
        { icon: 'Truck', description: 'Free NZ-wide shipping' },
        { icon: 'Check', description: '12 months free subscription included' }
      ],
    },
    // ─── Guardian Loyalty: Gold Membership ──────────────────────
    {
      name: 'Gold Membership',
      slug: 'gold-membership',
      description: 'Upgrade to Gold and earn 2× Guardian Points on every purchase. Priority support, early access to new products, and free shipping on orders over $50.',
      shortDescription: 'Earn 2× Guardian Points on every purchase',
      price: 1.99,
      currency: 'NZD',
      images: [],
      category: 'Guardian',
      tags: ['gold', 'membership', 'loyalty', 'guardian'],
      isActive: true,
      isPublished: true,
      stock: 99999,
      reserved: 0,
      lowStockThreshold: 0,
      stockPolicy: 'allow',
      weight: 0,
      sku: 'PT-GOLD-001',
      variants: [],
      customizable: false,
      customizationPrice: 0,
      shippingCost: 0,
      shippingDescription: 'Digital membership — no shipping required',
      warrantyMonths: 0,
      isSubscription: true,
      isTagProduct: false,
      subscriptionConfig: {
        type: 'monthly',
        freePeriodMonths: 0,
        gracePeriodWeeks: 1,
        monthlyPrice: 1.99,
        features: [
          '2× Guardian Points on all purchases',
          'Free shipping on orders over $50',
          'Early access to new products',
          'Priority support',
          '$3/month PawRewards',
        ],
      },
      featureHighlights: [
        { icon: 'Sparkles', description: '2× Points on every purchase' },
        { icon: 'Truck', description: 'Free shipping on orders over $50' },
        { icon: 'Clock', description: 'Early access to new products' },
        { icon: 'Headphones', description: 'Priority support' },
        { icon: 'Gift', description: '$3/month PawRewards' },
      ],
      sortOrder: 100,
      badge: 'Gold',
    },
];

async function seedProducts() {
  try {
    await connectDatabase();
    console.log('Connected to MongoDB');

    // Idempotent: only add missing products (don't clear existing ones)
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const productData of products) {
      const existing = await Product.findOne({ sku: productData.sku });
      if (existing) {
      // Update fields on existing products if they differ
      const updates: Record<string, any> = {};
      if (existing.customizable !== productData.customizable) updates.customizable = productData.customizable;
      if (existing.customizationLabel !== productData.customizationLabel) updates.customizationLabel = productData.customizationLabel;
      if (existing.customizationPrice !== productData.customizationPrice) updates.customizationPrice = productData.customizationPrice;
      if (existing.isActive !== productData.isActive) updates.isActive = productData.isActive;
      if (existing.isSubscription !== productData.isSubscription) updates.isSubscription = productData.isSubscription;
      if (Object.keys(updates).length > 0) {
          await Product.updateOne({ _id: existing._id }, { $set: updates });
          updated++;
          console.log(`  ~ ${productData.name} (${productData.sku}) — updated fields`);
        } else {
          skipped++;
        }
        continue;
      }
      await Product.create(productData);
      added++;
      console.log(`  + ${productData.name} (${productData.sku})`);
    }
    console.log(`Products: ${added} added, ${updated} updated, ${skipped} unchanged`);

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

    // OTP settings moved to seed-cms.ts

    // Seed bundle pricing settings
    const pricingSettings = [
      { key: 'pricing.bundle2Discount', value: '10', category: 'pricing', description: 'Discount percentage for buying 2 tags (default 10%)' },
      { key: 'pricing.bundle3Discount', value: '15', category: 'pricing', description: 'Discount percentage for buying 3+ tags (default 15%)' },
    ];
    for (const s of pricingSettings) {
      await Setting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
    }
    console.log(`Seeded ${pricingSettings.length} pricing settings`);

    // Seed notification settings
    const notificationSettings = [
      { key: 'notifications.tagExpiryDaysBefore', value: '30', category: 'notifications', description: 'Days before subscription expiry to start notifying admins' },
      { key: 'notifications.tagExpiryAdminEmails', value: '', category: 'notifications', description: 'Comma-separated admin emails for expiry alerts (empty = all admins)' },
    ];
    for (const s of notificationSettings) {
      await Setting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
    }
    console.log(`Seeded ${notificationSettings.length} notification settings`);

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedProducts();
