import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Subscription, Invoice, Tag, User, Pet } from '@pawtag/db';
import Stripe from 'stripe';
import { isFakeMode } from '../commerce/payment-mode';
import { auditService, type AuditContext } from '../services/audit';
import {
  renewSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  createGoldSubscription,
} from '../services/subscription.service';
import logger from '../lib/logger';

// Lazy-init Stripe client — only create when not in fake mode
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  _stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia' as any });
  return _stripe;
}

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
      actorUsername: (ctx as any)?.actorUsername || req.user?.email,
      actorEmail: req.user?.email,
      ...overrides,
    };
    await auditService.log(context, input);
  } catch (err) {
    logger.error({ err }, '[Audit] Failed to log subscription event');
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
    const pets = await Pet.find({ _id: { $in: petIds }, ownerId: req.user!.id, deletedAt: null }).select('name petType breed');
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
      const pet = await Pet.findOne({ _id: tag.petId, ownerId: req.user!.id, deletedAt: null }).select('name petType breed');
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

    // Business rule: expired subscriptions cannot be renewed — must buy new tag
    if (subscription.status === 'expired') {
      res.status(400).json({ success: false, error: 'This tag has expired. Please purchase a new PawTag.' });
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

    const ctx = req.auditContext as any;
    const cancelled = await cancelSubscription(subscription._id.toString(), req.body.reason, {
      sourceIp: ctx?.sourceIp || req.ip,
      userAgent: ctx?.userAgent,
      deviceId: ctx?.deviceId,
      actorId: req.user?.id,
      actorFullName: (req.user as any)?.fullName,
      actorRoleName: 'Customer',
      portal: 'customer-web',
    });

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

    const { autoRenew, reason, reasonDetails } = req.body;
    if (typeof autoRenew !== 'boolean') {
      res.status(400).json({ success: false, error: 'autoRenew must be a boolean' });
      return;
    }

    // When pausing (autoRenew=false), require a reason
    if (!autoRenew && !reason) {
      res.status(400).json({ success: false, error: 'Reason is required when pausing auto-renew' });
      return;
    }

    const oldAutoRenew = subscription.autoRenew;
    subscription.autoRenew = autoRenew;

    if (!autoRenew) {
      // Pausing — store pause metadata
      subscription.autoRenewPausedAt = new Date();
      subscription.autoRenewPausedBy = req.user!.id;
      subscription.autoRenewPausedByType = 'Customer';
      subscription.autoRenewPausedByPortal = 'customer-web';
      subscription.autoRenewPauseReason = reason;
      subscription.autoRenewPauseReasonDetails = reasonDetails || undefined;
    } else {
      // Resuming — clear pause metadata
      subscription.autoRenewPausedAt = undefined;
      subscription.autoRenewPausedBy = undefined;
      subscription.autoRenewPausedByType = undefined;
      subscription.autoRenewPausedByPortal = undefined;
      subscription.autoRenewPauseReason = undefined;
      subscription.autoRenewPauseReasonDetails = undefined;
    }

    await subscription.save();

    // Send admin notification for ALL pause reasons
    if (!autoRenew && reason) {
      try {
        const user = await User.findById(req.user!.id).select('fullName email').lean();
        const { createAndDeliverNotification } = await import('../services/notification-delivery.service');
        const { renderSubscriptionPausedAdminEmail, renderSubscriptionPausedEmail } = await import('../services/email/templates');
        const { sendMail } = await import('../services/email.service');

        const reasonLabels: Record<string, string> = {
          no_longer_own_pet: 'No longer own the Pet',
          no_longer_using: 'No longer using or need the service',
          too_expensive: 'Too expensive',
          found_alternative: 'Found an alternative',
          poor_experience: 'Poor experience',
          temporary_pause: 'Temporary Pause Requested',
          circumstances_changed: 'Customer Circumstances Changed',
          billing_payment_issue: 'Billing / Payment Issue',
          other: 'Other',
        };
        const reasonLabel = reasonLabels[reason] || reason;
        const isHighPriority = reason === 'poor_experience';

        // Get admin recipients
        const adminEmailsSetting = await (await import('@pawtag/db')).Setting.findOne({ key: 'notifications.tagExpiryAdminEmails' }).lean();
        const adminEmails = adminEmailsSetting?.value
          ? adminEmailsSetting.value.split(',').map((e: string) => e.trim()).filter(Boolean)
          : [];
        const admins = adminEmails.length > 0
          ? await User.find({ email: { $in: adminEmails } }).select('_id email fullName')
          : await User.find({ role: { $in: ['admin', 'super_admin'] } }).select('_id email fullName');

        for (const admin of admins) {
          // In-app notification (isolated — push failure must not block email)
          try {
            await createAndDeliverNotification({
              userId: (admin as any)._id.toString(),
              type: 'subscription_auto_renew_paused',
              title: `Subscription Auto-Renew Paused — ${reasonLabel}`,
              message: `${user?.fullName || 'Customer'} (${user?.email}) paused auto-renew for ${subscription.planName}. Reason: ${reasonLabel}`,
              priority: isHighPriority ? 'high' : 'normal',
              channel: 'alert',
              actionUrl: `/customer-subscriptions/${subscription._id}`,
            });
          } catch (notifErr) {
            logger.error({ err: notifErr, adminId: (admin as any)._id }, 'Failed to deliver in-app notification to admin');
          }

          // Admin email notification (isolated — must not be blocked by in-app/push failure)
          try {
            const adminHtml = renderSubscriptionPausedAdminEmail({
              customerName: user?.fullName || 'Customer',
              customerEmail: user?.email || '',
              planName: subscription.planName,
              reason: reasonLabel,
              reasonDetails,
              subscriptionUrl: `${process.env.ADMIN_URL || 'http://localhost:3001'}/customer-subscriptions/${subscription._id}`,
            });
            const adminEmailResult = await sendMail((admin as any).email, `Subscription Auto-Renew Paused: ${subscription.planName}`, adminHtml, undefined, {
              templateSlug: 'subscription-paused-admin',
              businessFlow: 'subscription',
              relatedEntityType: 'subscription',
              relatedEntityId: subscription._id.toString(),
              relatedEntityDisplay: subscription.planName,
            });
            logger.info({ adminEmail: (admin as any).email, result: adminEmailResult }, 'Admin pause notification email sent');
          } catch (emailErr) {
            logger.error({ err: emailErr, adminEmail: (admin as any).email }, 'Failed to send admin pause notification email');
          }
        }

        // Send customer confirmation email (isolated — must not be blocked by admin notifications)
        if (user?.email) {
          try {
            const customerHtml = renderSubscriptionPausedEmail({
              name: user?.fullName || 'Customer',
              planName: subscription.planName,
              reason: reasonLabel,
              reasonDetails,
              pausedAt: new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }),
              activeUntil: subscription.currentPeriodEnd?.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }),
              resumeUrl: `${process.env.CUSTOMER_URL || 'http://localhost:3000'}/account/subscriptions`,
            });
            const customerEmailResult = await sendMail(user.email, `Auto-Renew Paused: ${subscription.planName}`, customerHtml, undefined, {
              templateSlug: 'subscription-paused',
              businessFlow: 'subscription',
              relatedEntityType: 'subscription',
              relatedEntityId: subscription._id.toString(),
              relatedEntityDisplay: subscription.planName,
            });
            logger.info({ customerEmail: user.email, result: customerEmailResult }, 'Customer pause confirmation email sent');
          } catch (emailErr) {
            logger.error({ err: emailErr, customerEmail: user.email }, 'Failed to send customer pause confirmation email');
          }
        }
      } catch (notifyErr) {
        logger.error({ err: notifyErr, subscriptionId: subscription._id, userId: req.user!.id }, 'Failed to send pause notifications');
      }
    }

    await auditSubscriptionEvent(req, {
      action: 'subscription_auto_renew_toggled',
      eventType: 'subscription.auto_renew_toggled',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: subscription._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      businessOperation: `${autoRenew ? 'Enabled' : 'Disabled'} auto-renew for subscription '${subscription._id}'`,
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

    // Fake mode: if no real Stripe key, return a demo URL
    if (isFakeMode()) {
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
        businessOperation: 'Generated Stripe billing portal link (demo mode)',
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

      const customer = await getStripeClient().customers.create({
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

    const session = await getStripeClient().billingPortal.sessions.create({
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
      businessOperation: 'Generated Stripe billing portal link',
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
    logger.error({ err: error, userId: req.user?.id }, '[Subscriptions] Portal link error');
    res.status(500).json({ success: false, error: error.message || 'Failed to create portal session' });
  }
});

/**
 * POST /gold/subscribe
 *
 * Subscribe to Gold membership. Creates a Gold subscription for the user.
 * No physical Tag required — Gold is a standalone digital membership.
 *
 * Body: { price?: number } (optional, defaults to $1.99)
 */
router.post('/gold/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check if user already has an active Gold subscription
    const existingGold = await Subscription.findOne({
      userId,
      planName: 'Gold Membership',
      status: { $in: ['active', 'grace_period'] },
      deletedAt: null,
    });

    if (existingGold) {
      res.status(409).json({ success: false, error: 'You already have an active Gold membership' });
      return;
    }

    const { price } = req.body || {};
    const subscription = await createGoldSubscription(userId, price);

    res.json({
      success: true,
      data: {
        subscription,
        message: 'Gold membership activated! You are now earning 2× points on every purchase.',
      },
    });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Subscriptions] Gold subscribe error');
    res.status(500).json({ success: false, error: error.message || 'Failed to create Gold subscription' });
  }
});

export default router;
