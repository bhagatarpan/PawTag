/**
 * @module Commerce Settings Seed
 * @description Seeds all PawTag Commerce settings into the database.
 *
 * These settings are read by the commerce config service and allow
 * administrators to change business rules without code changes.
 *
 * Run: `cd packages/api && pnpm seed-commerce`
 *
 * Idempotent: Uses upsert so safe to run multiple times.
 */

import { Setting } from '@pawtag/db';

/**
 * All commerce settings with their default values.
 * Organized by category for clarity.
 */
const COMMERCE_SEED_SETTINGS = [
  // ─── Payment ──────────────────────────────────────────────
  { key: 'commerce.payment.provider', value: 'stripe', description: 'Payment provider identifier' },
  { key: 'commerce.payment.currency', value: 'NZD', description: 'Default currency code' },
  { key: 'commerce.payment.testMode', value: 'true', description: 'Enable demo/test payment mode' },

  // ─── Shipping ─────────────────────────────────────────────
  { key: 'commerce.shipping.enabled', value: 'true', description: 'Enable shipping calculation' },
  { key: 'commerce.shipping.provider', value: 'nz-shipping', description: 'Shipping provider identifier' },
  { key: 'commerce.shipping.freeEnabled', value: 'true', description: 'Enable free shipping' },
  { key: 'commerce.shipping.freeThreshold', value: '0', description: 'Minimum order for free shipping (0=always free)' },
  { key: 'commerce.shipping.flatRate', value: '0', description: 'Flat rate shipping cost (0=free)' },
  { key: 'commerce.shipping.taxEnabled', value: 'false', description: 'Apply tax to shipping' },

  // ─── Tax ──────────────────────────────────────────────────
  { key: 'commerce.tax.enabled', value: 'true', description: 'Enable tax calculation' },
  { key: 'commerce.tax.provider', value: 'nz-gst', description: 'Tax provider identifier' },
  { key: 'commerce.tax.rate', value: '0.15', description: 'Tax rate (0.15 = 15% GST)' },
  { key: 'commerce.tax.label', value: 'GST', description: 'Tax label for display' },
  { key: 'commerce.tax.inclusive', value: 'true', description: 'Prices include tax' },

  // ─── Inventory ────────────────────────────────────────────
  { key: 'commerce.inventory.enabled', value: 'true', description: 'Enable inventory tracking' },
  { key: 'commerce.inventory.lowStockThreshold', value: '10', description: 'Low stock alert threshold' },
  { key: 'commerce.inventory.outOfStockThreshold', value: '0', description: 'Out of stock threshold' },
  { key: 'commerce.inventory.defaultPolicy', value: 'deny', description: 'Default stock policy (deny or allow)' },
  { key: 'commerce.inventory.reservationTtlMinutes', value: '30', description: 'How long to hold stock during checkout' },

  // ─── Checkout ─────────────────────────────────────────────
  { key: 'commerce.checkout.guestEnabled', value: 'false', description: 'Allow guest checkout' },
  { key: 'commerce.checkout.verificationRequired', value: 'true', description: 'Require email+phone verification' },
  { key: 'commerce.checkout.termsRequired', value: 'true', description: 'Require terms acceptance' },
  { key: 'commerce.checkout.pendingOrderTtlMinutes', value: '30', description: 'How long a pending order is held' },

  // ─── Orders ───────────────────────────────────────────────
  { key: 'commerce.orders.autoCancelMinutes', value: '60', description: 'Auto-cancel unpaid orders after minutes' },
  { key: 'commerce.orders.numberPrefix', value: 'PT', description: 'Order number prefix' },
  { key: 'commerce.orders.numberLength', value: '6', description: 'Order number length after prefix' },

  // ─── Subscriptions ────────────────────────────────────────
  { key: 'commerce.subscriptions.annualPrice', value: '0.99', description: 'Annual subscription price (NZD)' },
  { key: 'commerce.subscriptions.monthlyPrice', value: '1.99', description: 'Monthly subscription price (NZD)' },
  { key: 'commerce.subscriptions.freePeriodMonths', value: '12', description: 'Free period in months' },
  { key: 'commerce.subscriptions.gracePeriodWeeks', value: '4', description: 'Grace period in weeks' },

  // ─── Refunds ──────────────────────────────────────────────
  { key: 'commerce.refunds.enabled', value: 'true', description: 'Allow refunds' },
  { key: 'commerce.refunds.maxDaysAfterPurchase', value: '60', description: 'Maximum days after purchase for refund' },
  { key: 'commerce.refunds.partialEnabled', value: 'true', description: 'Allow partial refunds' },

  // ─── Promotions ───────────────────────────────────────────
  { key: 'commerce.promotions.enabled', value: 'true', description: 'Enable discount codes' },
  { key: 'commerce.promotions.maxUsesPerCode', value: '1000', description: 'Maximum uses per discount code' },

  // ─── Notifications ────────────────────────────────────────
  { key: 'commerce.notifications.orderConfirmation', value: 'true', description: 'Send order confirmation email' },
  { key: 'commerce.notifications.invoiceEmail', value: 'true', description: 'Send invoice email' },
  { key: 'commerce.notifications.adminAlert', value: 'true', description: 'Send admin alert for new orders' },
  { key: 'commerce.notifications.shippingUpdate', value: 'true', description: 'Send shipping update email' },

  // ─── Feature Flags ────────────────────────────────────────
  { key: 'commerce.feature.stripeSignatureVerification', value: 'true', description: 'Verify Stripe webhook signatures' },
  { key: 'commerce.feature.orphanPaymentDetection', value: 'true', description: 'Detect orphaned payments' },
  { key: 'commerce.feature.priceValidation', value: 'true', description: 'Server-side price validation' },
];

/**
 * Seed all commerce settings.
 * Uses upsert to be idempotent — safe to run multiple times.
 */
export async function seedCommerceSettings(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const setting of COMMERCE_SEED_SETTINGS) {
    const result = await Setting.findOneAndUpdate(
      { key: setting.key },
      {
        $setOnInsert: {
          key: setting.key,
          value: setting.value,
          description: setting.description,
          createdAt: new Date(),
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true },
    );

    if (result) {
      updated++;
    } else {
      created++;
    }
  }

  console.log(`Commerce settings seeded: ${created} created, ${updated} already existed`);
}

// Run directly
if (require.main === module) {
  import('@pawtag/db').then(async ({ connectDatabase }) => {
    const dbUrl = process.env.DB_URL || process.env.MONGODB_URI;
    if (!dbUrl) {
      console.error('DB_URL environment variable is required');
      process.exit(1);
    }
    await connectDatabase(dbUrl);
    await seedCommerceSettings();
    process.exit(0);
  });
}
