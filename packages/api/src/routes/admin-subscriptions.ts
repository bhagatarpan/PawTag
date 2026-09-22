import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Subscription, Invoice, Tag, User } from '@pawtag/db';
import {
  renewSubscription,
  cancelSubscription,
  createGoldSubscription,
} from '../services/subscription.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: List all subscriptions (admin)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, planType, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { deletedAt: null };
    if (status) filter.status = status;
    if (planType) filter.planType = planType;

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('userId', 'fullName email')
        .populate('tagId', 'tagId tagType status')
        .populate('planId', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Subscription.countDocuments(filter),
    ]);

    // If search by user email or tag ID, do post-filter
    let filtered = subscriptions;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = subscriptions.filter((sub) => {
        const user = sub.userId as any;
        const tag = sub.tagId as any;
        return (
          (user?.email?.toLowerCase().includes(searchLower)) ||
          (user?.fullName?.toLowerCase().includes(searchLower)) ||
          (tag?.tagId?.toLowerCase().includes(searchLower))
        );
      });
    }

    res.json({
      success: true,
      data: {
        items: filtered,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/stats:
 *   get:
 *     summary: Get subscription statistics
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', requirePermission('subscription.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalActive,
      totalExpired,
      totalGracePeriod,
      totalCancelled,
      totalPendingPayment,
      totalSubscriptions,
      recentSubscriptions,
    ] = await Promise.all([
      Subscription.countDocuments({ status: 'active', deletedAt: null }),
      Subscription.countDocuments({ status: 'expired', deletedAt: null }),
      Subscription.countDocuments({ status: 'grace_period', deletedAt: null }),
      Subscription.countDocuments({ status: 'cancelled', deletedAt: null }),
      Subscription.countDocuments({ status: 'pending_payment', deletedAt: null }),
      Subscription.countDocuments({ deletedAt: null }),
      Subscription.find({ deletedAt: null })
        .populate('userId', 'fullName email')
        .populate('tagId', 'tagId')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    // Monthly recurring revenue (annual plans: $0.99/mo, monthly: $1.99/mo)
    const activeSubs = await Subscription.find({ status: 'active', deletedAt: null });
    const mrr = activeSubs.reduce((sum, sub) => sum + (sub.price || 0), 0);

    res.json({
      success: true,
      data: {
        totalActive,
        totalExpired,
        totalGracePeriod,
        totalCancelled,
        totalPendingPayment,
        totalSubscriptions,
        mrr: Math.round(mrr * 100) / 100,
        recentSubscriptions,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription stats' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/{id}:
 *   get:
 *     summary: Get subscription detail (admin)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('userId', 'fullName email phoneNumber')
      .populate('tagId', 'tagId tagType status petId')
      .populate('planId', 'name price images');

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const invoices = await Invoice.find({ subscriptionId: subscription._id })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { subscription, invoices } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/{id}/status:
 *   put:
 *     summary: Override subscription status (admin)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/status', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!status || !['active', 'expired', 'grace_period', 'cancelled', 'pending_payment'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const oldStatus = subscription.status;

    // Use service layer for cancellation (handles Stripe, email, audit, metadata)
    if (status === 'cancelled') {
      const adminUser = await User.findById(req.user!.id).select('fullName roles').lean();
      const roleName = (adminUser?.roles as any[])?.[0] || 'Admin';

      const cancelled = await cancelSubscription(subscription._id.toString(), reason || 'Admin override', {
        sourceIp: (req.auditContext as any)?.sourceIp || req.ip,
        userAgent: (req.auditContext as any)?.userAgent,
        actorId: req.user?.id,
        actorFullName: adminUser?.fullName || 'Admin',
        actorRoleName: roleName,
        portal: 'admin-web',
      });

      res.json({
        success: true,
        data: cancelled,
        message: `Subscription cancelled`,
      });
      return;
    }

    // For non-cancelled status changes, update directly
    subscription.status = status;
    await subscription.save();

    // Update tag subscription status (skip for Gold memberships — no physical tag)
    if (subscription.tagId) {
      if (status === 'active') {
        await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'active' });
      } else if (status === 'expired') {
        await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'expired' });
      } else if (status === 'grace_period') {
        await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'grace_period' });
      }
    }

    res.json({
      success: true,
      data: subscription,
      message: `Subscription status changed from ${oldStatus} to ${status}`,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update subscription status' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/{id}/extend:
 *   post:
 *     summary: Extend subscription by X days (admin support tool)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/extend', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { days, reason } = req.body;
    if (!days || days <= 0 || days > 365) {
      res.status(400).json({ success: false, error: 'Days must be between 1 and 365' });
      return;
    }

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const extensionMs = days * 24 * 60 * 60 * 1000;
    subscription.currentPeriodEnd = new Date(subscription.currentPeriodEnd.getTime() + extensionMs);

    if (subscription.freePeriodEndsAt) {
      subscription.freePeriodEndsAt = new Date(subscription.freePeriodEndsAt.getTime() + extensionMs);
    }

    if (subscription.status === 'grace_period' || subscription.status === 'expired') {
      subscription.status = 'active';
      if (subscription.tagId) {
        await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'active' });
      }
    }

    subscription.reminderStates = {
      reminder30dSent: false,
      reminder7dSent: false,
      reminder1dSent: false,
      graceWeeklySentCount: 0,
    };

    await subscription.save();

    // Log admin extension in invoice
    await Invoice.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      invoiceNumber: `ADMIN-EXT-${Date.now()}`,
      amount: 0,
      currency: 'NZD',
      status: 'paid',
      billingPeriod: {
        start: new Date(),
        end: subscription.currentPeriodEnd,
      },
      paymentMethod: 'admin-extend',
      paidAt: new Date(),
      dueDate: subscription.currentPeriodEnd,
    });

    res.json({
      success: true,
      data: subscription,
      message: `Subscription extended by ${days} days. Reason: ${reason || 'Admin support'}`,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to extend subscription' });
  }
});

// PUT /api/admin/subscriptions/:id/auto-renew — Toggle auto-renew with reason tracking
router.put('/:id/auto-renew', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
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

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const adminUser = await User.findById(req.user!.id).select('fullName roles').lean();
    const roleName = (adminUser?.roles as any[])?.[0] || 'Admin';

    const oldAutoRenew = subscription.autoRenew;
    subscription.autoRenew = autoRenew;

    if (!autoRenew) {
      // Pausing — store pause metadata
      subscription.autoRenewPausedAt = new Date();
      subscription.autoRenewPausedBy = req.user!.id;
      subscription.autoRenewPausedByType = roleName;
      subscription.autoRenewPausedByPortal = 'admin-web';
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

    // Send notification for ALL pause reasons
    if (!autoRenew && reason) {
      try {
        const customer = await User.findById(subscription.userId).select('fullName email').lean();
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
          // In-app notification (always)
          await createAndDeliverNotification({
            userId: (admin as any)._id.toString(),
            type: 'subscription_auto_renew_paused',
            title: `Subscription Auto-Renew Paused — ${reasonLabel}`,
            message: `${adminUser?.fullName || 'Admin'} paused auto-renew for ${customer?.fullName || 'Customer'}'s ${subscription.planName}. Reason: ${reasonLabel}`,
            priority: isHighPriority ? 'high' : 'normal',
            channel: 'alert',
            actionUrl: `/customer-subscriptions/${subscription._id}`,
          });

          // Email notification using template
          const html = renderSubscriptionPausedAdminEmail({
            customerName: customer?.fullName || 'Customer',
            customerEmail: customer?.email || '',
            planName: subscription.planName,
            reason: reasonLabel,
            reasonDetails,
            subscriptionUrl: `${process.env.ADMIN_URL || 'http://localhost:3001'}/customer-subscriptions/${subscription._id}`,
          });
          await sendMail((admin as any).email, `Subscription Auto-Renew Paused: ${subscription.planName}`, html);
        }

        // Send customer confirmation email
        if (customer?.email) {
          const customerHtml = renderSubscriptionPausedEmail({
            name: customer?.fullName || 'Customer',
            planName: subscription.planName,
            reason: reasonLabel,
            reasonDetails,
            pausedAt: new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }),
            resumeUrl: `${process.env.CUSTOMER_URL || 'http://localhost:3000'}/account/subscriptions`,
          });
          await sendMail(customer.email, `Auto-Renew Paused: ${subscription.planName}`, customerHtml);
        }
      } catch (notifyErr) {
        // Non-critical — don't fail the request
      }
    }

    res.json({
      success: true,
      data: subscription,
      message: `Auto-renew ${autoRenew ? 'enabled' : 'disabled'}`,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update auto-renew' });
  }
});

/**
 *   post:
 *     summary: Subscribe a customer to Gold membership (admin action)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/gold/subscribe', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, price } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const user = await User.findById(userId).select('fullName email').lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Check for existing active Gold subscription
    const existing = await Subscription.findOne({
      userId,
      planName: 'Gold Membership',
      status: { $in: ['active', 'grace_period'] },
      deletedAt: null,
    });
    if (existing) {
      res.status(409).json({ success: false, error: 'User already has an active Gold membership' });
      return;
    }

    const subscription = await createGoldSubscription(userId, price);

    res.json({
      success: true,
      data: subscription,
      message: `Gold membership activated for ${user.fullName || user.email}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create Gold subscription' });
  }
});

export default router;
