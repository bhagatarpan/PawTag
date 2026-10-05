import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import {
  InvoiceAccessToken,
  Invoice,
  Subscription,
  User,
  Order,
  UserMembership,
  MembershipTier,
} from '@pawtag/db';
import { CUSTOMER_INVOICE_LIST_PAGE_SIZE } from '@pawtag/shared';
import { generateOtp, generateSecureToken, hashToken } from '../services/auth.service';
import { sendInvoiceOtpEmail, sendInvoiceEmail } from '../services/email.service';
import { generateInvoiceHtml } from '../services/invoice-html.service';
import { isInvoiceOtpDisabled } from '../services/otp-settings.service';
import { config } from '../config';
import { auditService, type AuditContext } from '../services/audit';
import { type AuditRequest } from '../middleware/audit';

const router = Router();
const FRONTEND_URL = config.frontendUrl || 'http://localhost:3000';

function mapInvoiceListItem(inv: any) {
  return {
    _id: String(inv._id),
    invoiceNumber: inv.invoiceNumber,
    amount: Number(inv.amount || 0),
    currency: inv.currency || 'NZD',
    status: inv.status,
    type: inv.type || 'invoice',
    paidAt: inv.paidAt ? new Date(inv.paidAt).toISOString() : null,
    createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : String(inv.createdAt),
    orderId: inv.orderId ? String(inv.orderId) : null,
    userMembershipId: inv.userMembershipId ? String(inv.userMembershipId) : null,
    subscriptionId: inv.subscriptionId ? String(inv.subscriptionId) : null,
  };
}

/** Safe customer projection of related order/membership/subscription data. */
async function buildInvoiceDetailProjection(invoice: any) {
  const base = {
    ...mapInvoiceListItem(invoice),
    billingPeriod: invoice.billingPeriod
      ? {
          start: new Date(invoice.billingPeriod.start).toISOString(),
          end: new Date(invoice.billingPeriod.end).toISOString(),
        }
      : null,
    stripeInvoiceId: invoice.stripeInvoiceId || null,
    paymentMethod: invoice.paymentMethod || null,
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
    voidedReason: invoice.voidedReason || null,
    relatedInvoiceNumber: null as string | null,
    order: null as any,
    membership: null as any,
    subscription: null as any,
  };

  if (invoice.relatedInvoiceId) {
    const original = await Invoice.findById(invoice.relatedInvoiceId).select('invoiceNumber').lean();
    base.relatedInvoiceNumber = original?.invoiceNumber || null;
  }

  if (invoice.orderId) {
    const order = await Order.findById(invoice.orderId).lean();
    if (order) {
      const pay = order.payment as any;
      base.order = {
        orderNumber: order.orderNumber,
        items: (order.items || []).map((i: any) => ({
          productName: i.productName,
          variantName: i.variantName || null,
          quantity: Number(i.quantity || 0),
          unitPrice: i.unitPrice != null ? Number(i.unitPrice) : null,
          totalPrice: i.totalPrice != null ? Number(i.totalPrice) : null,
          tagId: i.tagId || null,
          petName: i.petName || null,
          customisationTexts: i.customisationTexts || [],
        })),
        subtotal: order.subtotal != null ? Number(order.subtotal) : null,
        shippingCost: order.shippingCost != null ? Number(order.shippingCost) : null,
        tax: order.tax != null ? Number(order.tax) : null,
        discount: order.discount
          ? {
              amount: order.discount.amount != null ? Number(order.discount.amount) : null,
              reason: order.discount.reason || null,
            }
          : null,
        cardBrand: pay?.cardBrand || null,
        cardLast4: pay?.cardLast4 || null,
        shippingAddress: order.shippingAddress
          ? {
              line1: order.shippingAddress.line1,
              line2: order.shippingAddress.line2 || null,
              city: order.shippingAddress.city,
              state: order.shippingAddress.state || null,
              zip: order.shippingAddress.zip || null,
              country: order.shippingAddress.country || null,
            }
          : null,
        refundArn: (order as any).refundArn || null,
        refundExpectedArrival: (order as any).refundExpectedArrival
          ? new Date((order as any).refundExpectedArrival).toISOString()
          : null,
      };
    }
  }

  if (invoice.userMembershipId) {
    const membership = await UserMembership.findById(invoice.userMembershipId).lean();
    if (membership) {
      const tier = membership.tierId
        ? await MembershipTier.findById(membership.tierId).select('displayName name tier').lean()
        : null;
      base.membership = {
        tierName: tier?.displayName || tier?.name || 'Membership',
        tier: tier?.tier || null,
        currentPeriodStart: membership.currentPeriodStart
          ? new Date(membership.currentPeriodStart).toISOString()
          : null,
        currentPeriodEnd: membership.currentPeriodEnd
          ? new Date(membership.currentPeriodEnd).toISOString()
          : null,
        price: membership.price != null ? Number(membership.price) : null,
        currency: membership.currency || null,
        cardBrand: membership.cardBrand || null,
        cardLast4: membership.cardLast4 || null,
      };
    }
  }

  if (invoice.subscriptionId) {
    const sub = await Subscription.findById(invoice.subscriptionId).lean();
    if (sub) {
      base.subscription = {
        planName: (sub as any).planName || 'Subscription',
        planType: (sub as any).planType || null,
        currentPeriodStart: (sub as any).currentPeriodStart
          ? new Date((sub as any).currentPeriodStart).toISOString()
          : null,
        currentPeriodEnd: (sub as any).currentPeriodEnd
          ? new Date((sub as any).currentPeriodEnd).toISOString()
          : null,
      };
    }
  }

  return base;
}

// Customer: list own invoices (orders + membership + subscriptions + credit notes)
router.get('/customer/invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(req.query.pageSize) || CUSTOMER_INVOICE_LIST_PAGE_SIZE),
    );
    const userId = req.user!.id;

    const filter = { userId };
    const total = await Invoice.countDocuments(filter);
    const items = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    await auditInvoiceEvent(req, 'customer_invoice_list', userId, {
      page,
      pageSize,
      total,
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        data: items.map(mapInvoiceListItem),
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to load invoices' });
  }
});

// Customer: single invoice detail (ownership-scoped, enriched projection)
router.get('/customer/invoices/:invoiceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.invoiceId,
      userId: req.user!.id,
    }).lean();

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const data = await buildInvoiceDetailProjection(invoice);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load invoice' });
  }
});

async function auditInvoiceEvent(req: AuditRequest, action: string, resourceId: string, metadata: Record<string, unknown>): Promise<void> {
  await auditService.log({
    ...(req.auditContext as AuditContext),
    actorId: req.user?.id,
    actorEmail: req.user?.email,
  }, {
    action,
    eventType: `invoice.${action}`,
    eventCategory: 'READ',
    operationType: 'READ',
    resourceType: 'Invoice',
    resourceId,
    metadata,
    outcome: 'SUCCESS',
    severity: 'MEDIUM',
  });
}

function getClientInfo(req: any) {
  return { ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers['user-agent'] };
}

// Customer: Request secure invoice access link
router.post('/customer/invoices/:invoiceId/access', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) { res.status(404).json({ success: false, error: 'Invoice not found' }); return; }
    if (invoice.userId.toString() !== req.user!.id) { res.status(403).json({ success: false, error: 'Access denied' }); return; }

    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);
    const clientInfo = getClientInfo(req);

    // Invalidate any existing tokens for this invoice
    await InvoiceAccessToken.deleteMany({ invoiceId: invoice._id, userId: req.user!.id });

    // Check if user has skip OTP enabled or system-wide OTP is disabled
    const user = await User.findById(req.user!.id).select('skipInvoiceOtp skipInvoiceOtpExpiresAt email fullName');
    const userSkipOtp = (user as any)?.skipInvoiceOtp && (user as any)?.skipInvoiceOtpExpiresAt && new Date() < new Date((user as any).skipInvoiceOtpExpiresAt);
    const systemOtpDisabled = await isInvoiceOtpDisabled();
    const skipOtp = userSkipOtp || systemOtpDisabled;

    if (skipOtp) {
      // Skip OTP — pre-verified, return invoice HTML directly via secure URL
      await InvoiceAccessToken.create({
        invoiceId: invoice._id,
        userId: req.user!.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verifiedAt: new Date(),
        ...clientInfo,
      });

      await auditInvoiceEvent(req, 'invoice_otp_skipped', invoice._id.toString(), {
        reason: systemOtpDisabled ? 'system otp.skipOtpForInvoice enabled' : 'user skipInvoiceOtp enabled',
      });

      res.json({ success: true, data: { secureUrl: `${FRONTEND_URL}/invoice/${secureToken}?admin=1`, skipOtp: true } });
      return;
    }

    // Normal flow — generate OTP and send email
    const otp = generateOtp();
    const otpHash = hashToken(otp);

    await InvoiceAccessToken.create({
      invoiceId: invoice._id,
      userId: req.user!.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ...clientInfo,
    });

    const name = (user as any)?.fullName || (user as any)?.name || 'Customer';
    const email = (user as any)?.email;
    if (email) {
      const { sendCmsEmailOrFallback } = await import('../services/email.service');
      const { renderInvoiceOtpTemplateEmail } = await import('../services/email/templates');
      const html = renderInvoiceOtpTemplateEmail({
        name,
        invoiceNumber: invoice.invoiceNumber,
        otp,
      });
      await sendCmsEmailOrFallback({
        slug: 'invoice-otp',
        to: email,
        vars: {
          name,
          invoiceNumber: invoice.invoiceNumber,
          otp,
          expiresInMinutes: '10',
        },
        fallbackSubject: `Your PawTag invoice access code — ${invoice.invoiceNumber}`,
        fallbackHtml: html,
        businessFlow: 'orders_commerce',
      });
    }

    res.json({ success: true, data: { secureUrl: `${FRONTEND_URL}/invoice/${secureToken}` } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate invoice access' });
  }
});

// Public: Check token status (no auth required — token IS the auth)
router.get('/invoice/:token/status', async (req, res: Response) => {
  try {
    const tokenHash = hashToken(req.params.token);
    const access = await InvoiceAccessToken.findOne({ tokenHash })
      .populate({ path: 'invoiceId', select: 'invoiceNumber amount currency status billingPeriod paidAt dueDate createdAt' })
      .populate({ path: 'userId', select: 'fullName name email phoneNumber address' });

    if (!access) { res.status(404).json({ success: false, error: 'Invalid link' }); return; }
    if (new Date() > access.expiresAt) { res.status(410).json({ success: false, error: 'Link expired', code: 'EXPIRED' }); return; }

    // Check if OTP verified within 24 hours
    const isVerified = access.verifiedAt && (Date.now() - access.verifiedAt.getTime()) < 24 * 60 * 60 * 1000;

    if (isVerified) {
      // Generate invoice HTML directly
      const html = await generateInvoiceHtml((access.invoiceId as any)._id.toString());
      res.json({
        success: true,
        data: {
          verified: true,
          invoice: access.invoiceId,
          customer: access.userId,
          invoiceHtml: html,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          verified: false,
          invoice: access.invoiceId,
          customer: { email: (access.userId as any)?.email },
        },
      });
    }
  } catch {
    res.status(500).json({ success: false, error: 'Failed to verify token' });
  }
});

// Public: Verify OTP
router.post('/invoice/:token/verify', async (req, res: Response) => {
  try {
    const { otp } = req.body;
    if (!otp || otp.length !== 6) { res.status(400).json({ success: false, error: 'Invalid OTP format' }); return; }

    const tokenHash = hashToken(req.params.token);
    const access = await InvoiceAccessToken.findOne({ tokenHash });

    if (!access) { res.status(404).json({ success: false, error: 'Invalid link' }); return; }
    if (new Date() > access.expiresAt) { res.status(410).json({ success: false, error: 'Link expired', code: 'EXPIRED' }); return; }
    if (!access.otpHash || !access.otpExpiresAt) { res.status(400).json({ success: false, error: 'No OTP pending' }); return; }
    if (new Date() > access.otpExpiresAt) { res.status(410).json({ success: false, error: 'OTP expired', code: 'OTP_EXPIRED' }); return; }
    if (access.otpAttempts >= 5) { res.status(429).json({ success: false, error: 'Too many attempts. Request a new link.' }); return; }

    const otpHash = hashToken(otp);
    if (otpHash !== access.otpHash) {
      access.otpAttempts += 1;
      await access.save();
      res.status(400).json({ success: false, error: `Invalid code. ${5 - access.otpAttempts} attempts remaining.`, attemptsLeft: 5 - access.otpAttempts });
      return;
    }

    // OTP verified
    access.verifiedAt = new Date();
    await access.save();

    // Generate invoice HTML
    const html = await generateInvoiceHtml(access.invoiceId.toString());

    res.json({
      success: true,
      data: {
        verified: true,
        invoice: access.invoiceId,
        invoiceHtml: html,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
});

// Public: Resend OTP
router.post('/invoice/:token/resend-otp', async (req, res: Response) => {
  try {
    const tokenHash = hashToken(req.params.token);
    const access = await InvoiceAccessToken.findOne({ tokenHash }).populate('userId', 'fullName name email');

    if (!access) { res.status(404).json({ success: false, error: 'Invalid link' }); return; }
    if (new Date() > access.expiresAt) { res.status(410).json({ success: false, error: 'Link expired', code: 'EXPIRED' }); return; }

    const user = access.userId as any;
    if (!user?.email) { res.status(400).json({ success: false, error: 'No email on file' }); return; }

    const invoice = await Invoice.findById(access.invoiceId).select('invoiceNumber');
    const otp = generateOtp();
    access.otpHash = hashToken(otp);
    access.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    access.otpAttempts = 0;
    await access.save();

    const name = user.fullName || user.name || 'Customer';
    await sendInvoiceOtpEmail(user.email, name, invoice?.invoiceNumber || '', otp);

    res.json({ success: true, data: { message: 'OTP resent' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resend OTP' });
  }
});

// Admin: View invoice (generates secure token, no OTP needed, audit logged)
router.get('/admin/invoices/:invoiceId/view', authenticate, requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) { res.status(404).json({ success: false, error: 'Invoice not found' }); return; }

    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);
    const clientInfo = getClientInfo(req);

    // Create access token (no OTP, pre-verified)
    await InvoiceAccessToken.create({
      invoiceId: invoice._id,
      userId: invoice.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(), // Pre-verified for admin
      ...clientInfo,
    });

    // Audit log
    await auditInvoiceEvent(req, 'invoice_viewed', invoice._id.toString(), {
      viewedBy: req.user!.email, customerUserId: invoice.userId.toString(), ...clientInfo,
    });

    res.json({ success: true, data: { secureUrl: `${FRONTEND_URL}/invoice/${secureToken}?admin=1` } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate view link' });
  }
});

// Admin: Email invoice to customer
router.post('/admin/invoices/:invoiceId/email', authenticate, requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) { res.status(404).json({ success: false, error: 'Invoice not found' }); return; }

    const targetEmail = req.body.email || undefined;
    let recipientEmail = targetEmail;
    let recipientName = 'Customer';

    if (!recipientEmail) {
      const user = await User.findById(invoice.userId).select('fullName name email');
      if (!user) { res.status(404).json({ success: false, error: 'Customer not found' }); return; }
      recipientEmail = (user as any).email;
      recipientName = (user as any).fullName || (user as any).name || 'Customer';
    } else {
      const targetUser = await User.findById(invoice.userId).select('fullName name');
      recipientName = (targetUser as any)?.fullName || (targetUser as any)?.name || 'Customer';
    }

    if (!recipientEmail) { res.status(400).json({ success: false, error: 'No email address' }); return; }

    const invoiceHtml = await generateInvoiceHtml(invoice._id.toString());
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);

    // Persist the access token so the emailed link actually works
    await InvoiceAccessToken.create({
      invoiceId: invoice._id,
      userId: invoice.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days for admin-emailed invoices
      verifiedAt: new Date(), // Pre-verified — admin-initiated, no OTP required
    });

    const invoiceUrl = `${FRONTEND_URL}/invoice/${secureToken}?admin=1`;
    await sendInvoiceEmail(recipientEmail, recipientName, invoice.invoiceNumber, invoiceHtml, invoiceUrl, invoice.amount);

    // Audit log
    const clientInfo = getClientInfo(req);
    await auditInvoiceEvent(req, 'invoice_emailed', invoice._id.toString(), {
      emailedTo: recipientEmail, customerUserId: invoice.userId.toString(), ...clientInfo,
    });

    res.json({ success: true, data: { message: `Invoice emailed to ${recipientEmail}` } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to email invoice' });
  }
});

// Admin: Generate invoice PDF HTML directly (for print)
router.get('/admin/invoices/:invoiceId/print', authenticate, requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) { res.status(404).json({ success: false, error: 'Invoice not found' }); return; }

    const html = await generateInvoiceHtml(invoice._id.toString());

    // Audit log
    const clientInfo = getClientInfo(req);
    await auditInvoiceEvent(req, 'invoice_printed', invoice._id.toString(), {
      printedBy: req.user!.email, customerUserId: invoice.userId.toString(), ...clientInfo,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate invoice' });
  }
});

export default router;
