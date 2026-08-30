/**
 * Backfill card brand and last 4 digits for existing orders.
 *
 * Calls Stripe API to retrieve payment method details for each order
 * that is missing cardBrand/cardLast4.
 *
 * Safe to re-run — only updates orders where cardBrand is null.
 *
 * Usage: npx tsx scripts/backfill-card-details.ts
 */
import mongoose from 'mongoose';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import '@pawtag/db';

dotenv.config();

async function backfill() {
  const uri = process.env.DB_URL;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!uri) throw new Error('DB_URL not set');
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' } as any);

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Order = mongoose.model('Order');

  const orders = await Order.find({
    'payment.stripePaymentIntentId': { $exists: true, $ne: null },
    $or: [
      { 'payment.cardBrand': { $exists: false } },
      { 'payment.cardBrand': null },
    ],
  }).sort({ createdAt: 1 }).lean();

  console.log(`Found ${orders.length} orders to backfill card details\n`);

  if (orders.length === 0) {
    console.log('Nothing to backfill.');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    const piId = order.payment?.stripePaymentIntentId;
    if (!piId) {
      console.log(`${order.orderNumber}: no stripePaymentIntentId — skipped`);
      skipped++;
      continue;
    }

    // Skip demo/test payment intents
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

      // Card details are on the expanded payment_method object
      const pm = intent.payment_method as Stripe.PaymentMethod;
      if (pm && typeof pm === 'object' && pm.card) {
        cardBrand = pm.card.brand;
        cardLast4 = pm.card.last4;
      }

      if (cardBrand && cardLast4) {
        await Order.updateOne(
          { _id: order._id },
          { $set: { 'payment.cardBrand': cardBrand, 'payment.cardLast4': cardLast4 } },
        );
        console.log(`${order.orderNumber}: ${cardBrand} •••• ${cardLast4}`);
        updated++;
      } else {
        console.log(`${order.orderNumber}: no card details in Stripe response — skipped`);
        skipped++;
      }
    } catch (err: any) {
      console.log(`${order.orderNumber}: Stripe API error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${failed} failed`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
