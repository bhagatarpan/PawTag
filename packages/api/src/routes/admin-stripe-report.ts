/**
 * @module Admin Stripe Report Routes
 * @description Admin API route for viewing comprehensive Stripe data for a customer.
 *
 * Provides a single endpoint that aggregates:
 * - User profile (email, name, Stripe customer ID)
 * - All subscriptions for the user
 * - All orders for the user
 * - All invoices for the user
 * - All payment transactions for the user
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { User, Subscription, Order, Invoice, PaymentTransaction } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { toAppError } from '../lib/app-errors';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/stripe/report/:userId
 * Returns comprehensive Stripe data for a customer.
 */
router.get('/:userId', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('fullName email stripeCustomerId').lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const [subscriptions, orders, invoices] = await Promise.all([
      Subscription.find({ userId }).sort({ createdAt: -1 }).lean(),
      Order.find({ userId }).sort({ createdAt: -1 }).lean(),
      Invoice.find({ userId }).sort({ createdAt: -1 }).lean(),
    ]);

    const transactions = await PaymentTransaction.find({ orderId: { $in: orders.map((o) => o._id) } })
      .sort({ createdAt: -1 })
      .lean();

    let stripeCustomer: Record<string, unknown> | null = null;
    if (user.stripeCustomerId && stripePaymentProvider.isConfigured()) {
      try {
        const stripe = (stripePaymentProvider as any).getClient();
        const customer = await stripe.customers.retrieve(user.stripeCustomerId, {
          expand: ['sources', 'invoice_settings'],
        });
        stripeCustomer = {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          created: customer.created,
          invoicePrefix: customer.invoice_settings?.invoice_prefix,
          defaultPaymentMethod: customer.invoice_settings?.default_payment_method,
          balance: customer.balance,
          delinquent: customer.delinquent,
        };
      } catch {
        // Stripe not reachable or customer not found — return null
      }
    }

    res.json({
      success: true,
      data: {
        customer: {
          userId: user._id,
          email: user.email,
          name: user.fullName,
          stripeCustomerId: user.stripeCustomerId || null,
        },
        stripeCustomer,
        subscriptions,
        orders,
        invoices,
        transactions,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

export default router;
