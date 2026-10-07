/**
 * Donation reconciliation job (Phase 17).
 * Finds pending/failed donations that may need repair after webhook/provider issues.
 * Never mutates money state blindly — logs repair candidates.
 */
import { Donation, DonationPayment } from '@pawtag/db';
import logger from '../lib/logger';
import { createClaimedJob, generateWorkerId } from '../lib/job-claim';

const workerId = generateWorkerId();

const claimed = createClaimedJob('donation-reconciliation', workerId, async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
    const pending = await Donation.find({
      status: { $in: ['pending', 'failed'] },
      createdAt: { $lt: cutoff },
      frequency: 'one_time',
    }).limit(50);

    let candidates = 0;
    for (const donation of pending) {
      // If Stripe PI succeeded but local still pending — flag for repair
      if (donation.stripePaymentIntentId && donation.status === 'pending') {
        logger.warn(
          {
            donationId: String(donation._id),
            paymentIntentId: donation.stripePaymentIntentId,
            email: donation.emailSnapshot,
          },
          'Donation reconciliation: pending donation older than 30m — verify Stripe state',
        );
        candidates++;
      }
    }

    // Payments succeeded but receipt missing
    const succeededNoReceipt = await DonationPayment.find({
      status: 'succeeded',
      receiptId: { $in: [null, undefined] },
    })
      .populate('donationId')
      .limit(20);

    for (const payment of succeededNoReceipt) {
      logger.warn(
        { paymentId: String(payment._id), donationId: String(payment.donationId) },
        'Donation reconciliation: succeeded payment missing receipt',
      );
      candidates++;
    }

    if (candidates > 0) {
      logger.info({ candidates }, 'Donation reconciliation completed with repair candidates');
    } else {
      logger.info('Donation reconciliation completed — no repair candidates');
    }
  } catch (err) {
    logger.error({ err }, 'Donation reconciliation job error');
  }
});

export async function runDonationReconciliationJob(): Promise<{ success: boolean; error?: string }> {
  try {
    await claimed();
    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, '[DonationReconciliation] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export function startDonationReconciliationJob(): void {
  setInterval(() => {
    claimed().catch((err) => logger.error({ err }, 'Donation reconciliation tick error'));
  }, 5 * 60 * 1000);
  logger.info('[DonationReconciliationJob] Started — every 5 minutes');
}
