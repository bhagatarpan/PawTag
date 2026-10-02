/**
 * One-time operational repair for order WO-000484.
 *
 * Context: customer cancel returned 500 after Stripe already refunded
 * re_3ULjQUPUTjuiDAu41PINdXlW because PaymentTransaction.initiatedBy used
 * 'Customer' (invalid enum). Order remained paid.
 *
 * This script uses the fixed cancellation service in reconcile mode:
 * - Does NOT create a second Stripe refund
 * - Marks order cancelled/refunded from the existing Stripe refund
 * - Writes PaymentTransaction with initiatedBy='customer'
 * - Releases inventory reservation
 * - Writes activity + audit
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ORDER_ID = '6abe56eabebdec65922225a8';
const EXISTING_REFUND_ID = 're_3ULjQUPUTjuiDAu41PINdXlW';
const REFUND_AMOUNT = 8.49;

async function main() {
  const uri = process.env.DB_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error('DB_URL not configured');

  const { Order, User } = await import('@pawtag/db');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const before = await Order.findById(ORDER_ID).lean();
  if (!before) throw new Error('Order not found');
  if (before.status === 'cancelled' && before.refundId === EXISTING_REFUND_ID) {
    console.log('Order already repaired. Nothing to do.');
    await mongoose.disconnect();
    return;
  }
  if (before.status !== 'paid') {
    throw new Error(`Unexpected order status before repair: ${before.status}`);
  }
  if (before.payment?.stripePaymentIntentId !== 'pi_3ULjQUPUTjuiDAu41WCPF2u2') {
    throw new Error(`Unexpected payment intent: ${before.payment?.stripePaymentIntentId}`);
  }

  const user = await User.findById(before.userId).select('fullName').lean();
  const actorName = user?.fullName || 'John Smith';

  const { stripePaymentProvider } = await import('../src/commerce/providers/stripe');
  const { cancelOrder } = await import('../src/commerce/services/cancellation.service');
  const { notifyCustomerOfStatusChange } = await import('../src/services/orderNotification.service');

  // Force reconcile path against the known succeeded Stripe refund.
  (stripePaymentProvider as any).listRefundsByPaymentIntent = async () => [{
    success: true,
    refundId: EXISTING_REFUND_ID,
    status: 'succeeded',
    amount: REFUND_AMOUNT,
  }];
  (stripePaymentProvider as any).retrieveRefund = async () => ({
    success: true,
    refundId: EXISTING_REFUND_ID,
    status: 'succeeded',
    amount: REFUND_AMOUNT,
  });
  (stripePaymentProvider as any).createRefund = async () => {
    throw new Error('createRefund blocked during repair — existing Stripe refund must be reused');
  };

  const result = await cancelOrder({
    orderId: ORDER_ID,
    reason: 'Customer cancellation — refund already processed in Stripe',
    notes: `Operational repair after initiatedBy enum defect. Existing Stripe refund ${EXISTING_REFUND_ID}.`,
    actor: {
      name: actorName,
      type: 'customer',
      portal: 'customer-web',
    },
    requireRefundSuccess: true,
  });

  console.log('cancelOrder result:', JSON.stringify({
    success: result.success,
    error: result.error,
    errorCode: result.errorCode,
    refundCreated: result.refundCreated,
    refundId: result.refundId,
    bookkeepingFailed: result.bookkeepingFailed,
    status: result.order?.status,
    paymentStatus: result.order?.payment?.status,
  }, null, 2));

  if (!result.success) {
    throw new Error(`Repair cancelOrder failed: ${result.error}`);
  }

  try {
    await notifyCustomerOfStatusChange(result.order, 'cancelled', {
      reason: 'Customer cancellation — refund already processed in Stripe',
    });
    console.log('Customer notification attempted.');
  } catch (err: any) {
    console.log('Customer notification failed (non-fatal):', err?.message || err);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('REPAIR FAILED:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
