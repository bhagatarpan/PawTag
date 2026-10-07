/**
 * Donation routes — one-time + monthly (Phase 15–16).
 * Public settings/create/status; authenticated portal; admin under /api/admin/donations.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { createDbRateLimiter } from '../lib/rate-limiter';
import { getDonationSettings, isDonationModuleEnabled } from '../services/donation/donation-config';
import { donationService } from '../services/donation/donation.service';
import logger from '../lib/logger';

const router = Router();

const createDonationSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional(),
  frequency: z.enum(['one_time', 'monthly']).optional(),
  email: z.string().email('Valid email required'),
  name: z.string().max(120).optional(),
  marketingConsent: z.boolean().optional(),
  idempotencyKey: z.string().max(120).optional(),
});

const createLimiter = createDbRateLimiter({
  settingKey: 'donation.rateLimit.createPerHour',
  defaultValue: 20,
  windowMs: 60 * 60 * 1000,
  message: 'Too many donation attempts. Please try again later.',
  keySuffix: 'donation:create',
});

/** GET /api/donations/settings — public, configurable product settings */
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    if (!(await isDonationModuleEnabled())) {
      res.status(404).json({ success: false, error: 'Donations are not available' });
      return;
    }
    const settings = await getDonationSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    logger.error({ err }, 'Failed to load donation settings');
    res.status(500).json({ success: false, error: 'Failed to load donation settings' });
  }
});

/** POST /api/donations — create one-time or monthly donation */
router.post('/', createLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = createDonationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid donation request',
      });
      return;
    }

    const result = await donationService.createDonation({
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      frequency: parsed.data.frequency,
      email: parsed.data.email,
      name: parsed.data.name,
      marketingConsent: parsed.data.marketingConsent,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    logger.error({ err }, 'Failed to create donation');
    res.status(400).json({ success: false, error: err.message || 'Failed to create donation' });
  }
});

/** GET /api/donations/me — authenticated supporter history */
router.get('/me', authenticate, async (req: any, res: Response) => {
  try {
    const data = await donationService.listForUser(req.user.id);
    res.json({ success: true, data });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list donations');
    res.status(400).json({ success: false, error: err.message || 'Failed to list donations' });
  }
});

/** POST /api/donations/:id/cancel — cancel monthly recurring */
router.post('/:id/cancel', authenticate, async (req: any, res: Response) => {
  try {
    const result = await donationService.cancelRecurring(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    const msg = err.message || 'Failed to cancel donation';
    res.status(msg.includes('not found') ? 404 : 400).json({ success: false, error: msg });
  }
});

/** GET /api/donations/receipt/:receiptId/html — receipt document (auth ownership) */
router.get('/receipt/:receiptId/html', authenticate, async (req: any, res: Response) => {
  try {
    const html = await donationService.getReceiptHtml(req.params.receiptId, req.user.id);
    res.type('html').send(html);
  } catch (err: any) {
    const msg = err.message || 'Receipt not found';
    res.status(msg.includes('not found') ? 404 : 400).json({ success: false, error: msg });
  }
});

/** POST /api/donations/:id/confirm — verify Stripe payment server-side after card success */
router.post('/:id/confirm', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const data = await donationService.confirmPaymentIntent(req.params.id, userId);
    res.json({ success: true, data });
  } catch (err: any) {
    const msg = err.message || 'Failed to confirm donation payment';
    const status = msg.includes('not found') ? 404 : msg.includes('Unable to verify') ? 502 : 400;
    res.status(status).json({ success: false, error: msg });
  }
});

/** GET /api/donations/:id — status; optional auth ownership when logged in */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const data = await donationService.getStatus(req.params.id, userId);
    res.json({ success: true, data });
  } catch (err: any) {
    const msg = err.message || 'Donation not found';
    res.status(msg.includes('not found') ? 404 : 400).json({ success: false, error: msg });
  }
});

// ---------------------------------------------------------------------------
// Admin — mounted separately under /api/admin/donations
// ---------------------------------------------------------------------------
export const adminDonationRouter = Router();

adminDonationRouter.get('/', requirePermission('donation.read'), async (req: any, res: Response) => {
  try {
    const data = await donationService.listAdmin({
      status: req.query.status as string | undefined,
      frequency: req.query.frequency as string | undefined,
      q: req.query.q as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err: any) {
    logger.error({ err }, 'Admin donation list failed');
    res.status(500).json({ success: false, error: 'Failed to list donations' });
  }
});

adminDonationRouter.post('/:id/refund', requirePermission('donation.refund'), async (req: any, res: Response) => {
  try {
    const { reason } = req.body || {};
    const { Donation, DonationPayment, DonationReceipt } = await import('@pawtag/db');
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      res.status(404).json({ success: false, error: 'Donation not found' });
      return;
    }
    if (donation.status === 'refunded' || donation.status === 'cancelled') {
      res.status(409).json({ success: false, error: `Donation already ${donation.status}` });
      return;
    }

    // Stripe refund if PI exists (non-fake)
    // createRefund expects amount in major units (provider multiplies by 100)
    if (donation.stripePaymentIntentId && !donation.stripePaymentIntentId.startsWith('pi_demo_')) {
      try {
        const { stripePaymentProvider } = await import('../commerce/providers/stripe');
        await stripePaymentProvider.createRefund({
          paymentIntentId: donation.stripePaymentIntentId,
          amount: donation.amountCents / 100,
          reason: 'requested_by_customer',
        });
      } catch (err: any) {
        logger.error({ err, donationId: String(donation._id) }, 'Stripe donation refund failed');
        res.status(400).json({ success: false, error: err.message || 'Stripe refund failed' });
        return;
      }
    }

    donation.status = 'refunded';
    await donation.save();
    await DonationPayment.updateMany(
      { donationId: donation._id, status: { $in: ['succeeded', 'pending'] } },
      { $set: { status: 'refunded' } },
    );

    // Preserve receipt history — mark refunded-related note via void only if issued
    // Phase 16: original receipt remains; refund status lives on donation/payment.

    logger.info({ donationId: String(donation._id), reason, actor: req.user?.id }, 'Donation refunded by admin');
    res.json({ success: true, data: { id: String(donation._id), status: donation.status } });
  } catch (err: any) {
    logger.error({ err }, 'Donation refund failed');
    res.status(500).json({ success: false, error: 'Refund failed' });
  }
});

adminDonationRouter.post('/receipts/:receiptId/resend', requirePermission('donation.receipts'), async (req: any, res: Response) => {
  try {
    await donationService.resendReceiptEmail(req.params.receiptId, req.user?.id);
    res.json({ success: true, data: { message: 'Receipt email resent' } });
  } catch (err: any) {
    const msg = err.message || 'Failed to resend receipt';
    res.status(msg.includes('not found') ? 404 : 400).json({ success: false, error: msg });
  }
});

adminDonationRouter.get('/receipts/:receiptId/html', requirePermission('donation.receipts'), async (req: any, res: Response) => {
  try {
    const html = await donationService.getReceiptHtml(req.params.receiptId);
    res.type('html').send(html);
  } catch (err: any) {
    const msg = err.message || 'Receipt not found';
    res.status(msg.includes('not found') ? 404 : 400).json({ success: false, error: msg });
  }
});

export default router;
