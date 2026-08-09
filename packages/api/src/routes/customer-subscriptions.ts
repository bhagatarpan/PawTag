import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Subscription, Invoice, Tag, User, Pet } from '@pawtag/db';
import Stripe from 'stripe';
import { auditService, type AuditContext } from '../services/audit';
import {
  renewSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
} from '../services/subscription.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key', {
  apiVersion: '2024-06-20' as any,
});

async function auditSubscriptionEvent(
  req: AuthRequest,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  try {
    const ctx = req.auditContext as Partial<AuditContext> | undefined;
    const context: AuditContext = {
      requestId: ctx?.requestId || 'unknown',
      correlationId: ctx?.correlationId || 'unknown',
      traceId: ctx?.traceId || 'unknown',
      transactionId: ctx?.transactionId || 'unknown',
      sourceIp: ctx?.sourceIp || req.ip || 'unknown',
      forwardedIp: ctx?.forwardedIp,
      userAgent: ctx?.userAgent || 'unknown',
      deviceId: ctx?.deviceId,
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      tenantId: ctx?.tenantId,
      actorType: 'USER',
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      ...overrides,
    };
    await auditService.log(context, input);
  } catch (err) {
    console.error('[Audit] Failed to log subscription event:', err);
  }
}

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/customer/subscriptions:
 *   get:
 *     summary: List my subscriptions
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's subscriptions
 */
router.get('/', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await Subscription.find({
      userId: req.user!.id,
      deletedAt: null,
    })
      .populate('tagId', 'tagId tagType status petId')
      .populate('planId', 'name price images sku')
      .sort({ createdAt: -1 });

    // Populate pet names from tag.petId
    const petIds = subscriptions
      .map((s) => (s.tagId as any)?.petId)
      .filter(Boolean);
    const pets = await Pet.find({ _id: { $in: petIds } }).select('name petType breed');
    const petMap = new Map(pets.map((p) => [p._id.toString(), p]));

    const enriched = subscriptions.map((s) => {
      const tag = s.tagId as any;
      const pet = tag?.petId ? petMap.get(tag.petId.toString()) : null;
      return {
        ...s.toObject(),
        petName: pet?.name || null,
        petType: pet?.petType || null,
        productName: (s.planId as any)?.name || s.planName,
      };
    });

    res.json({ success: true, data: enriched });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}:
 *   get:
 *     summary: Get subscription detail
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    })
      .populate('tagId', 'tagId tagType status petId')
      .populate('planId', 'name price images description sku');

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    // Populate pet name
    const tag = subscription.tagId as any;
    let petName = null;
    let petType = null;
    if (tag?.petId) {
      const pet = await Pet.findById(tag.petId).select('name petType breed');
      if (pet) {
        petName = pet.name;
        petType = pet.petType;
      }
    }

    res.json({
      success: true,
      data: {
        ...subscription.toObject(),
        petName,
        petType,
        productName: (subscription.planId as any)?.name || subscription.planName,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/invoices:
 *   get:
 *     summary: List invoices for a subscription
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/invoices', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const invoices = await Invoice.find({
      subscriptionId: subscription._id,
      userId: req.user!.id,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: invoices });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/renew:
 *   put:
 *     summary: Manually renew subscription
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/renew', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    if (subscription.status === 'active' && subscription.autoRenew) {
      res.status(400).json({ success: false, error: 'Subscription is already active with auto-renew enabled' });
      return;
    }

    const renewed = await renewSubscription(subscription._id.toString(), 'card');

    res.json({ success: true, data: renewed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to renew subscription' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/cancel:
 *   put:
 *     summary: Cancel subscription (continues until end of billing period)
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/cancel', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    if (subscription.status !== 'active') {
      res.status(400).json({ success: false, error: 'Can only cancel active subscriptions' });
      return;
    }

    const cancelled = await cancelSubscription(subscription._id.toString(), req.body.reason);

    res.json({ success: true, data: cancelled });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to cancel subscription' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/auto-renew:
 *   put:
 *     summary: Toggle auto-renew on/off
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/auto-renew', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const { autoRenew } = req.body;
    if (typeof autoRenew !== 'boolean') {
      res.status(400).json({ success: false, error: 'autoRenew must be a boolean' });
      return;
    }

    const oldAutoRenew = subscription.autoRenew;
    subscription.autoRenew = autoRenew;
    await subscription.save();

    await auditSubscriptionEvent(req, {
      action: 'subscription_auto_renew_toggled',
      eventType: 'subscription.auto_renew_toggled',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: subscription._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      beforeState: { autoRenew: oldAutoRenew },
      afterState: { autoRenew: subscription.autoRenew },
    });

    res.json({ success: true, data: subscription });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update auto-renew' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/change-plan:
 *   post:
 *     summary: Change subscription plan (annual/monthly)
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/change-plan', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const { planType } = req.body;
    if (!planType || !['annual', 'monthly'].includes(planType)) {
      res.status(400).json({ success: false, error: 'planType must be "annual" or "monthly"' });
      return;
    }

    const updated = await changeSubscriptionPlan(subscription._id.toString(), planType);

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to change plan' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/portal-link:
 *   post:
 *     summary: Get Stripe billing portal session URL
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subscriptionId:
 *                 type: string
 *                 description: Optional specific subscription to manage
 *     responses:
 *       200:
 *         description: Portal session URL
 */
router.post('/portal-link', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.body || {};

    let stripeCustomerId: string | undefined;

    if (subscriptionId) {
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        userId: req.user!.id,
        deletedAt: null,
      });
      if (!subscription) {
        res.status(404).json({ success: false, error: 'Subscription not found' });
        return;
      }
      stripeCustomerId = subscription.stripeCustomerId;
    } else {
      // Find any subscription with a Stripe customer ID
      const subscription = await Subscription.findOne({
        userId: req.user!.id,
        stripeCustomerId: { $exists: true, $ne: null },
        deletedAt: null,
      });
      stripeCustomerId = subscription?.stripeCustomerId;
    }

    // Demo mode: if no real Stripe key, return a demo URL
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_demo_key') {
      const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions?demo=portal`;
      await auditSubscriptionEvent(req, {
        action: 'subscription_portal_link_created',
        eventType: 'subscription.portal_link_created',
        eventCategory: 'INTEGRATION',
        operationType: 'CREATE',
        resourceType: 'Subscription',
        resourceId: subscriptionId,
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: {
          userId: req.user?.id,
          subscriptionId,
          stripeCustomerId,
          demoMode: true,
        },
      });
      res.json({ success: true, data: { url } });
      return;
    }

    if (!stripeCustomerId) {
      // No Stripe customer yet — create a portal session anyway (Stripe will handle it)
      const user = await User.findById(req.user!.id).select('email fullName');
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: { userId: req.user!.id },
      });

      stripeCustomerId = customer.id;

      // Update any subscriptions without a Stripe customer ID
      await Subscription.updateMany(
        { userId: req.user!.id, stripeCustomerId: { $exists: false } },
        { stripeCustomerId: customer.id },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`,
    });

    await auditSubscriptionEvent(req, {
      action: 'subscription_portal_link_created',
      eventType: 'subscription.portal_link_created',
      eventCategory: 'INTEGRATION',
      operationType: 'CREATE',
      resourceType: 'Subscription',
      resourceId: subscriptionId,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        userId: req.user?.id,
        subscriptionId,
        stripeCustomerId,
        portalSessionId: session.id,
        demoMode: false,
      },
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (error: any) {
    console.error('[Subscriptions] Portal link error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create portal session' });
  }
});

export default router;
