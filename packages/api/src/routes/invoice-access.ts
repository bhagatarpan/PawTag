import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { InvoiceAccessToken, Invoice, Subscription, User } from '@pawtag/db';
import { generateOtp, generateSecureToken, hashToken } from '../services/auth.service';
import { sendInvoiceOtpEmail, sendInvoiceEmail } from '../services/email.service';
import { generateInvoiceHtml } from '../services/invoice-html.service';
import { isInvoiceOtpDisabled } from '../services/otp-settings.service';
import { config } from '../config';
import { auditService, type AuditContext } from '../services/audit';
import { type AuditRequest } from '../middleware/audit';

const router = Router();
const FRONTEND_URL = config.frontendUrl || 'http://localhost:3000';

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
        reason: systemOtpDisabled ? 'system otp.noOtpForInvoice enabled' : 'user skipInvoiceOtp enabled',
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
      await sendInvoiceOtpEmail(email, name, invoice.invoiceNumber, otp);
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
