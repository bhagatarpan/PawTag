/**
 * Donation routes (Phase 15) — one-time NZD donations.
 * Public settings + create + status. No pet required.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
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

/** POST /api/donations — create one-time donation + Stripe PaymentIntent */
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

    const result = await donationService.createOneTimeDonation({
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

export default router;
