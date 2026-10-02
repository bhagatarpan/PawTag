/**
 * Backfill card brand and last 4 digits for existing orders.
 *
 * Calls Stripe API to retrieve payment method details for each order
 * that is missing cardBrand/cardLast4.
 *
 * Safe to re-run — only updates orders where cardBrand is missing/null.
 *
 * Usage:
 *   npx tsx scripts/backfill-card-details.ts           # real run
 *   npx tsx scripts/backfill-card-details.ts --dry-run # count only
 */
import mongoose from 'mongoose';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import '@pawtag/db';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), 'packages/api/.env'),
  path.resolve(process.cwd(), 'packages/api/.env.local'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../.env.local'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

async function backfill() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.DB_URL || process.env.MONGODB_URI;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!uri) throw new Error('DB_URL not set');
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-08-26.dahlia' as any });

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${dryRun ? ' (DRY RUN — no writes)' : ''}`);

  const Order = mongoose.model('Order');

  const orders = await Order.find({
    'payment.stripePaymentIntentId': { $exists: true, $ne: null },
    $or: [
      { 'payment.cardBrand': { $exists: false } },
      { 'payment.cardBrand': null },
    ],
  }).sort({ createdAt: 1 }).lean();

  console.log(`Found ${orders.length} orders missing card details\n`);

  if (orders.length === 0) {
    console.log('Nothing to backfill.');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let wouldUpdate = 0;

  for (const order of orders) {
    const piId = order.payment?.stripePaymentIntentId;
    if (!piId) {
      console.log(`${order.orderNumber}: no stripePaymentIntentId — skipped`);
      skipped++;
      continue;
    }

    if (piId.startsWith('pi_demo_')) {
      console.log(`${order.orderNumber}: demo payment (${piId}) — skipped`);
      skipped++;
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.retrieve(piId, {
        expand: ['payment_method'],
      });

      let cardBrand: string | undefined;
      let cardLast4: string | undefined;

      const pm = intent.payment_method as Stripe.PaymentMethod | string | null;
      if (pm && typeof pm === 'object' && pm.card) {
        cardBrand = pm.card.brand;
        cardLast4 = pm.card.last4;
      }

      // Fallback: latest charge payment method details
      if ((!cardBrand || !cardLast4) && intent.latest_charge) {
        try {
          const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id;
          const charge = await stripe.charges.retrieve(chargeId, { expand: ['payment_method_details'] });
          const card = (charge as any)?.payment_method_details?.card;
          if (card) {
            cardBrand = cardBrand || card.brand;
            cardLast4 = cardLast4 || card.last4;
          }
        } catch {
          // ignore charge lookup failures
        }
      }

      if (cardBrand && cardLast4) {
        if (dryRun) {
          console.log(`${order.orderNumber}: would set ${cardBrand} ••••${cardLast4}`);
          wouldUpdate++;
        } else {
          await Order.updateOne(
            { _id: order._id },
            { $set: { 'payment.cardBrand': cardBrand, 'payment.cardLast4': cardLast4 } },
          );
          console.log(`${order.orderNumber}: ${cardBrand} ••••${cardLast4}`);
          updated++;
        }
      } else {
        console.log(`${order.orderNumber}: no card details in Stripe response — skipped`);
        skipped++;
      }
    } catch (err: any) {
      console.log(`${order.orderNumber}: Stripe API error: ${err.message}`);
      failed++;
    }
  }

  if (dryRun) {
    console.log(`\nDry run complete: ${wouldUpdate} would update, ${skipped} skipped, ${failed} failed`);
  } else {
    console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${failed} failed`);
  }
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
