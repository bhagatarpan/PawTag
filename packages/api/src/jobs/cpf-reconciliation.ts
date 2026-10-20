/**
 * @module CPF Reconciliation Job
 * @description Backfills Stripe's ACTUAL processing fee (balance_transaction
 * fee) onto recent card payment transactions so the finance dashboard can
 * compare "CPF charged to customer" vs "Stripe actually cost us" and flag
 * variance (docs/COMMERCE-FINANCE-PLAN-GST-CPF.md §6/§10).
 *
 * - Idempotent: only touches payment transactions without providerFee.
 * - Claimed/locked via the shared job-claim mechanism (no overlaps).
 * - Runs on the existing background-job scheduler; safe to trigger manually.
 * - Failures are logged loudly and never block other jobs.
 */

import { PaymentTransaction } from '@pawtag/db';
import { getStripeClient } from '../lib/stripe-client';
import { isFakeMode } from '../commerce/payment-mode';
import logger from '../lib/logger';
import { createClaimedJob, generateWorkerId } from '../lib/job-claim';

const workerId = generateWorkerId();

/** How far back to look for unreconciled payments per run. */
const LOOKBACK_DAYS = 30;
/** Max payments processed per run (bounded work). */
const BATCH_SIZE = 100;

export async function runCpfReconciliation(): Promise<{ processed: number; feesRecorded: number; failures: number }> {
  if (isFakeMode()) {
    logger.info('CPF reconciliation skipped — fake payment mode');
    return { processed: 0, feesRecorded: 0, failures: 0 };
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const payments = await PaymentTransaction.find({
    type: 'payment',
    status: 'succeeded',
    provider: 'stripe',
    createdAt: { $gte: since },
    $or: [{ providerFee: { $exists: false } }, { providerFee: null }],
  })
    .sort({ createdAt: -1 })
    .limit(BATCH_SIZE)
    .lean();

  if (!payments.length) return { processed: 0, feesRecorded: 0, failures: 0 };

  const stripe = getStripeClient();
  let feesRecorded = 0;
  let failures = 0;

  for (const payment of payments as any[]) {
    const paymentIntentId = payment.providerTransactionId;
    if (!paymentIntentId || String(paymentIntentId).startsWith('pi_zero_') || String(paymentIntentId).startsWith('pi_demo_')) {
      continue;
    }
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge.balance_transaction'] });
      const charge: any = (intent as any).latest_charge;
      const balanceTx: any = charge?.balance_transaction;
      const fee = typeof balanceTx?.fee === 'number' ? balanceTx.fee / 100 : null;
      if (fee === null) continue;

      await PaymentTransaction.updateOne(
        { _id: payment._id },
        { $set: { providerFee: fee } },
      );
      feesRecorded += 1;

      // Variance signal for the dashboard/ops: what we charged vs what
      // Stripe cost. Logged (not alerted) — informational reconciliation.
      const orderTx = await PaymentTransaction.findOne({ orderId: payment.orderId, type: 'refund' }).lean();
      logger.debug(
        {
          orderId: String(payment.orderId),
          orderNumber: payment.orderNumber,
          stripeFee: fee,
          paymentAmount: payment.amount,
          hasRefund: Boolean(orderTx),
        },
        'CPF reconciliation: Stripe fee recorded',
      );
    } catch (err) {
      failures += 1;
      logger.error({ err, orderId: String(payment.orderId), paymentIntentId }, 'CPF reconciliation: fee fetch failed');
    }
  }

  logger.info(
    { processed: payments.length, feesRecorded, failures },
    'CPF reconciliation run complete',
  );
  return { processed: payments.length, feesRecorded, failures };
}

const claimedRunCpfReconciliation = createClaimedJob('cpf-reconciliation', workerId, async () => {
  await runCpfReconciliation();
});

/** Background entry point for the job scheduler. */
export async function runCpfReconciliationJob(): Promise<import('../services/job-scheduler.service').JobResult> {
  try {
    const result = await claimedRunCpfReconciliation();
    return { success: true, itemsProcessed: (result as any)?.processed ?? 0 };
  } catch (error: any) {
    logger.error({ err: error }, '[CpfReconciliationJob] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}
