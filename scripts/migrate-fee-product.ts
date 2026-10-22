/**
 * One-off additive seed for the dev/production database: insert the
 * Tag Activation Fee product if missing (docs/TAG-ACTIVATION-LIMIT.md).
 * Insert-if-missing by slug — never updates existing rows. Fresh databases
 * get this product from scripts/seed-products.ts.
 *
 * Usage: npx tsx scripts/migrate-fee-product.ts
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const FEE_PRODUCT = {
  name: 'Tag Activation Fee',
  slug: 'tag-activation-fee',
  description: "One-time fee that activates one tag above your plan's activation limit. GST-inclusive; charged with the card processing fee where configured (docs/TAG-ACTIVATION-LIMIT.md).",
  shortDescription: 'One-time fee to activate a tag above your plan limit',
  price: 19.99,
  currency: 'NZD',
  images: [],
  category: 'PawTag',
  tags: ['activation', 'fee'],
  isActive: true,
  // stockPolicy 'allow' + ample stock: the standard unlimited pattern —
  // the shared confirm pipeline requires stock >= qty and a reservation.
  stock: 1000000,
  reserved: 0,
  sku: 'TAG-ACT-FEE',
  variants: [],
  customizable: false,
  customizationLabel: '',
  customizationPrice: 0,
  shippingCost: 0,
  warrantyMonths: 0,
  activePeriodMonths: 0,
  productType: 'digital',
  isTagProduct: false,
  isSubscription: false,
  stockPolicy: 'allow',
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function main() {
  const envPath = path.resolve(__dirname, '../packages/api/.env');
  let uri = '';
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^DB_URL=(.*)$/);
    if (m) uri = m[1].trim();
  }
  await mongoose.connect(uri);
  const productsCol = mongoose.connection.db!.collection('products');
  const existing = await productsCol.findOne({ slug: 'tag-activation-fee' });
  if (existing) {
    console.log('no-op: tag-activation-fee already exists');
  } else {
    await productsCol.insertOne(FEE_PRODUCT);
    console.log('inserted: tag-activation-fee (digital, stockPolicy=allow)');
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
