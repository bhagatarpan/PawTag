import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import Stripe from 'stripe';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// POST /api/customer/demo-payment/confirm — Confirm payment intent with test card (demo mode only)
router.post('/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, error: 'paymentIntentId required' });
    }

    if (!STRIPE_SECRET_KEY) {
      return res.status(400).json({ success: false, error: 'Stripe not configured' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });

    // Confirm the payment intent with a test card
    // Using confirm with payment_method_data which is the v14 API
    const paymentIntent = await stripe.paymentIntents.confirm(
      paymentIntentId,
      {
        payment_method_data: {
          type: 'card',
          card: {
            number: '4242424242424242',
            exp_month: 12,
            exp_year: 2030,
            cvc: '123',
          },
          billing_details: {
            name: (req.user as any)?.fullName || 'Test User',
            email: req.user?.email || 'test@example.com',
          },
        },
      } as any,
    );

    logger.info({ paymentIntentId, status: paymentIntent.status }, 'Demo payment confirmed');

    res.json({
      success: true,
      data: {
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Demo payment confirmation failed');
    res.status(500).json({ success: false, error: error.message || 'Payment confirmation failed' });
  }
});

export default router;
