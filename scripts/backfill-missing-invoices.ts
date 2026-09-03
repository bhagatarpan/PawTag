/**
 * Backfill missing invoices for existing orders.
 *
 * For every order with payment.status of 'completed' or 'refunded' that has no
 * Invoice document, creates one using data from the order:
 *   - invoiceNumber    via atomic counter (INV-XXXXXX)
 *   - orderId          from order._id
 *   - userId           from order.userId
 *   - amount           from order.payment.amount
 *   - currency         from order.payment.currency
 *   - status           'paid' or 'refunded' based on payment.status
 *   - paymentMethod    from order.payment.method
 *   - stripePaymentIntentId  from order.payment.stripePaymentIntentId
 *   - paidAt           from order.payment.paidAt (fallback: order.createdAt)
 *
 * Also creates an InvoiceAccessToken (expires 24h, verified immediately)
 * so the secure invoice URL works for customers straight away.
 *
 * Safe to re-run — only touches orders without an existing invoice.
 *
 * Usage: npx tsx scripts/backfill-missing-invoices.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import '@pawtag/db';

dotenv.config();

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function mapPaymentStatusToInvoiceStatus(paymentStatus: string): string {
  switch (paymentStatus) {
    case 'completed': return 'paid';
    case 'refunded': return 'refunded';
    case 'pending': return 'pending';
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

async function backfill() {
  const uri = process.env.DB_URL;
  if (!uri) throw new Error('DB_URL not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Order = mongoose.model('Order');
  const Invoice = mongoose.model('Invoice');
  const InvoiceAccessToken = mongoose.model('InvoiceAccessToken');

  const orders = await Order.find({
    'payment.status': { $in: ['completed', 'refunded'] },
  })
    .sort({ createdAt: 1 })
    .lean();

  console.log(`Found ${orders.length} paid/refunded orders. Checking for missing invoices...\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      const existing = await Invoice.findOne({ orderId: order._id });
      if (existing) {
        skipped++;
        continue;
      }

      const invCounter = await Invoice.db!.collection('counters').findOneAndUpdate(
        { _id: 'invoiceNumber' as any },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      const invoiceNumber = `INV-${String(invCounter?.value?.seq || 1).padStart(6, '0')}`;

      const invoiceStatus = mapPaymentStatusToInvoiceStatus(order.payment?.status);
      const isPaid = invoiceStatus === 'paid' || invoiceStatus === 'refunded';

      const invoice = await Invoice.create({
        orderId: order._id,
        userId: order.userId,
        invoiceNumber,
        amount: order.payment?.amount || 0,
        currency: order.payment?.currency || 'NZD',
        status: invoiceStatus,
        paymentMethod: order.payment?.method || 'card',
        stripePaymentIntentId: order.payment?.stripePaymentIntentId,
        paidAt: order.payment?.paidAt || order.createdAt,
      });

      const secureToken = generateSecureToken();
      const tokenHash = hashToken(secureToken);

      await InvoiceAccessToken.create({
        invoiceId: invoice._id,
        userId: order.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verifiedAt: isPaid ? new Date() : undefined,
      });

      console.log(`  [${order.orderNumber}] -> ${invoiceNumber} (${invoiceStatus}, $${order.payment?.amount?.toFixed(2)} ${order.payment?.currency || 'NZD'})`);
      created++;
    } catch (err: any) {
      console.error(`  [${order.orderNumber}] ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped (already had invoice): ${skipped}, Errors: ${errors}`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});