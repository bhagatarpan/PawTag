/**
 * @module Admin Stripe Report Routes
 * @description Admin API for viewing Stripe data per customer.
 *
 * Supports multi-field search:
 * - GET /api/admin/stripe/search?q=term — search by name, email, phone, order #, invoice #
 * - GET /api/admin/stripe/report/:userId — get full Stripe data for a specific user
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
 * Resolve a userId from various search criteria.
 * Searches: order number → invoice number → email → name → phone
 */
async function findUserIdBySearch(term: string): Promise<string | null> {
  const trimmed = term.trim();

  // 1. Try exact match on order number
  const order = await Order.findOne({ orderNumber: trimmed }).select('userId').lean();
  if (order?.userId) return String(order.userId);

  // 2. Try exact match on invoice number
  const invoice = await Invoice.findOne({ invoiceNumber: trimmed }).select('userId').lean();
  if (invoice?.userId) return String(invoice.userId);

  // 3. Try exact match on email
  const userByEmail = await User.findOne({ email: trimmed.toLowerCase() }).select('_id').lean();
  if (userByEmail) return String(userByEmail._id);

  // 4. Try partial match on fullName (case-insensitive)
  const usersByName = await User.find({ fullName: { $regex: trimmed, $options: 'i' } })
    .select('_id fullName email')
    .limit(10)
    .lean();
  if (usersByName.length === 1) return String(usersByName[0]._id);
  if (usersByName.length > 1) return `MULTIPLE:${JSON.stringify(usersByName.map(u => ({ id: String(u._id), name: u.fullName, email: u.email })))}`;

  // 5. Try partial match on phoneNumber
  const usersByPhone = await User.find({ phoneNumber: { $regex: trimmed } })
    .select('_id fullName email')
    .limit(10)
    .lean();
  if (usersByPhone.length === 1) return String(usersByPhone[0]._id);
  if (usersByPhone.length > 1) return `MULTIPLE:${JSON.stringify(usersByPhone.map(u => ({ id: String(u._id), name: u.fullName, email: u.email })))}`;

  return null;
}

/**
 * Get full Stripe report data for a userId.
 */
async function getStripeReport(userId: string) {
  const user = await User.findById(userId).select('fullName email stripeCustomerId phoneNumber').lean();
  if (!user) return null;

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
      // Stripe not reachable — return null
    }
  }

  return {
    customer: {
      userId: user._id,
      email: user.email,
      name: user.fullName,
      phoneNumber: user.phoneNumber || null,
      stripeCustomerId: user.stripeCustomerId || null,
    },
    stripeCustomer,
    subscriptions,
    orders,
    invoices,
    transactions,
  };
}

/**
 * GET /api/admin/stripe/search?q=searchTerm
 * Search across name, email, phone, order #, invoice #.
 */
router.get('/search', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      res.json({ success: true, data: { matches: [], report: null } });
      return;
    }

    const result = await findUserIdBySearch(q);

    if (!result) {
      res.json({ success: true, data: { matches: [], report: null } });
      return;
    }

    // Multiple matches — return list for user to select
    if (result.startsWith('MULTIPLE:')) {
      const matches = JSON.parse(result.replace('MULTIPLE:', ''));
      res.json({ success: true, data: { matches, report: null } });
      return;
    }

    // Single match — return full report
    const report = await getStripeReport(result);
    if (!report) {
      res.json({ success: true, data: { matches: [], report: null } });
      return;
    }

    res.json({ success: true, data: { matches: [], report } });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * GET /api/admin/stripe/report/:userId
 * Returns comprehensive Stripe data for a specific user.
 */
router.get('/report/:userId', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const report = await getStripeReport(req.params.userId);
    if (!report) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

export default router;
