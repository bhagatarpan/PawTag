/**
 * Migration: Fix subscription annual pricing
 *
 * This script:
 * 1. Updates Products with annualPrice values
 * 2. Updates active annual subscriptions with correct price
 * 3. Updates Gold product with new monthly/annual prices
 * 4. Updates Gold subscriptions
 *
 * Run: node scripts/migrate-subscription-annual-pricing.js
 * From: packages/api directory (needs mongoose + stripe dependencies)
 */

const mongoose = require('mongoose');
const Stripe = require('stripe');

const DB_URL = process.env.DB_URL;
if (!DB_URL) { console.error('DB_URL environment variable is required'); process.exit(1); }
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('STRIPE_SECRET_KEY environment variable is required'); process.exit(1); }

const stripe = new Stripe(STRIPE_KEY);

// Annual price definitions (incentivized)
const ANNUAL_PRICES = {
  'PT-SCAN-001': { monthly: 0.99, annual: 9.99 },
  'PT-CLASSIC-001': { monthly: 1.99, annual: 19.99 },
  'PT-PLUS-001': { monthly: 2.99, annual: 29.99 },
  'PT-GOLD-001': { monthly: 3.99, annual: 39.99 },
};

async function main() {
  await mongoose.connect(DB_URL);
  const db = mongoose.connection.db;
  const productsCol = db.collection('products');
  const subsCol = db.collection('subscriptions');

  console.log('=== SUBSCRIPTION ANNUAL PRICING MIGRATION ===\n');

  // ── Step 1: Update Products ──
  console.log('STEP 1: Updating Products with annualPrice...');
  for (const [sku, prices] of Object.entries(ANNUAL_PRICES)) {
    const result = await productsCol.updateOne(
      { sku },
      { $set: {
        'subscriptionConfig.monthlyPrice': prices.monthly,
        'subscriptionConfig.annualPrice': prices.annual,
        price: prices.monthly, // Gold product price
      }}
    );
    console.log(`  ${sku}: modified=${result.modifiedCount}`);
  }

  // ── Step 2: Update annual subscriptions ──
  console.log('\nSTEP 2: Updating annual subscriptions...');
  const annualSubs = await subsCol.find({
    renewalMethod: 'annual',
    status: 'active',
  }).toArray();

  let updatedCount = 0;
  for (const sub of annualSubs) {
    // Find the product to get the correct annual price
    const product = await productsCol.findOne({ _id: sub.planId });
    if (!product) {
      console.log(`  SKIP: subscription ${sub._id} - no linked product`);
      continue;
    }

    const sku = product.sku;
    const prices = ANNUAL_PRICES[sku];
    if (!prices) {
      console.log(`  SKIP: subscription ${sub._id} - unknown SKU ${sku}`);
      continue;
    }

    const newPrice = prices.annual;
    if (sub.price === newPrice) {
      console.log(`  OK: ${sub.planName} (${sub._id}) - price already correct: $${newPrice}`);
      continue;
    }

    await subsCol.updateOne(
      { _id: sub._id },
      { $set: { price: newPrice } }
    );
    console.log(`  UPDATED: ${sub.planName} (${sub._id}) - $${sub.price} → $${newPrice}`);
    updatedCount++;
  }

  // ── Step 3: Update Gold subscriptions ──
  console.log('\nSTEP 3: Updating Gold subscriptions...');
  const goldSubs = await subsCol.find({
    planType: 'gold',
    status: 'active',
  }).toArray();

  for (const sub of goldSubs) {
    const isAnnual = sub.renewalMethod === 'annual';
    const newPrice = isAnnual ? 39.99 : 3.99;
    if (sub.price === newPrice) {
      console.log(`  OK: Gold (${sub._id}) - price already correct: $${newPrice}`);
      continue;
    }
    await subsCol.updateOne(
      { _id: sub._id },
      { $set: { price: newPrice } }
    );
    console.log(`  UPDATED: Gold (${sub._id}) - $${sub.price} → $${newPrice}`);
    updatedCount++;
  }

  // ── Step 4: Update Stripe subscriptions ──
  console.log('\nSTEP 4: Updating Stripe subscriptions...');
  const stripeSubs = await subsCol.find({
    stripeSubscriptionId: { $exists: true, $ne: null },
    status: 'active',
  }).toArray();

  for (const sub of stripeSubs) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const stripeItem = stripeSub.items.data[0];
      if (!stripeItem) {
        console.log(`  SKIP: ${sub._id} - no Stripe items`);
        continue;
      }

      const currentPrice = await stripe.prices.retrieve(stripeItem.price.id);
      const expectedAmount = Math.round(sub.price * 100);

      if (currentPrice.unit_amount === expectedAmount) {
        console.log(`  OK: ${sub.planName} (${sub._id}) - Stripe price correct: $${sub.price}`);
        continue;
      }

      // Create new Stripe Price
      const newStripePrice = await stripe.prices.create({
        product: stripeItem.price.product,
        unit_amount: expectedAmount,
        currency: 'nzd',
        recurring: { interval: sub.renewalMethod === 'annual' ? 'year' : 'month' },
        metadata: { plan: sub.planType, migrated: 'true' },
      });

      // Update Stripe subscription to use new price
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: stripeItem.id, price: newStripePrice.id }],
        proration_behavior: 'none',
      });

      console.log(`  UPDATED: ${sub.planName} (${sub._id}) - Stripe $${currentPrice.unit_amount / 100} → $${sub.price}`);
      updatedCount++;
    } catch (err) {
      console.log(`  ERROR: ${sub._id} - ${err.message}`);
    }
  }

  // ── Summary ──
  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Products updated: ${Object.keys(ANNUAL_PRICES).length}`);
  console.log(`Subscriptions updated: ${updatedCount}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
