import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { sendCheckoutOtpSchema, verifyCheckoutOtpSchema } from '../middleware/schemas';
import { User, VerificationToken, Setting } from '@pawtag/db';
import { generateOtp, hashToken } from '../services/auth.service';
import { sendLoginOtpEmail } from '../services/email.service';
import { sendPhoneOtpSMS } from '../services/sms.service';
import { config } from '../config';
import { auditService } from '../services/audit';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';

const router = Router();
router.use(authenticate);

// POST /api/customer/checkout-otp/send — send OTP for email or sms channel
router.post('/send', validate(sendCheckoutOtpSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { channel } = req.body;
    const userId = req.user!.id;

    // Check if checkout OTP is enabled via CMS settings
    const enabledSetting = await Setting.findOne({ key: 'checkout.otp.enabled' }).lean();
    if (enabledSetting && enabledSetting.value === 'false') {
      return res.status(400).json({ success: false, error: 'Checkout verification is currently disabled' });
    }

    // Check if user already verified recently
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const expirySetting = await Setting.findOne({ key: 'checkout.otp.expiryMinutes' }).lean();
    const expiryMinutes = expirySetting ? parseInt(expirySetting.value, 10) : 15;

    if (user.checkoutOtpVerified && user.checkoutOtpVerifiedAt) {
      const elapsed = Date.now() - user.checkoutOtpVerifiedAt.getTime();
      if (elapsed < expiryMinutes * 60 * 1000) {
        return res.status(200).json({ success: true, data: { alreadyVerified: true } });
      }
    }

    // Rate limit: check recent sends
    const recentSends = await VerificationToken.countDocuments({
      userId,
      type: channel === 'email' ? 'checkout_email' : 'checkout_sms',
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }, // 1 min cooldown
    });
    if (recentSends > 0) {
      return res.status(429).json({ success: false, error: 'Please wait before requesting another code' });
    }

    // Invalidate unused previous OTPs for this channel
    await VerificationToken.updateMany(
      { userId, type: channel === 'email' ? 'checkout_email' : 'checkout_sms', usedAt: null },
      { usedAt: new Date() }
    );

    // Generate and store OTP
    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const otpExpiryMinutes = config.otpExpiryMinutes;

    await VerificationToken.create({
      userId,
      type: channel === 'email' ? 'checkout_email' : 'checkout_sms',
      tokenHash,
      expiresAt: new Date(Date.now() + otpExpiryMinutes * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send OTP via email or SMS
    if (channel === 'email') {
      const promise = sendLoginOtpEmail(user.email, user.fullName || 'Customer', otp);
      promise.catch((err: any) => console.error('Failed to send checkout email OTP:', err));
    } else {
      const promise = sendPhoneOtpSMS(user.phoneNumber, otp);
      promise.catch((err: any) => console.error('Failed to send checkout SMS OTP:', err));
    }

    // Fire-and-forget audit log
    const reqContext = (req as AuditRequest).auditContext;
    if (reqContext) {
      auditService.log({
        ...reqContext,
        actorType: 'USER',
        actorId: userId,
        actorEmail: user.email,
      } as any, {
        action: 'checkout_otp.send',
        eventType: 'USER_ACTION',
        eventCategory: 'SECURITY',
        operationType: 'OTP_SEND',
        resourceType: 'user',
        resourceId: userId,
        metadata: { channel },
      } as any).catch(() => {});
    }

    const masked = channel === 'email'
      ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      : user.phoneNumber.replace(/(\d{3})\d*(\d{3})/, '$1***$2');

    return res.status(200).json({
      success: true,
      data: { message: `OTP sent to ${masked}`, maskedContact: masked },
    });
  } catch (error) {
    console.error('Send checkout OTP error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send verification code' });
  }
});

// POST /api/customer/checkout-otp/verify — verify OTP for email or sms channel
router.post('/verify', validate(verifyCheckoutOtpSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { channel, otp } = req.body;
    const userId = req.user!.id;
    const otpType = channel === 'email' ? 'checkout_email' : 'checkout_sms';

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Find matching OTP
    const tokenHash = hashToken(otp);
    const verificationToken = await VerificationToken.findOne({
      userId,
      type: otpType,
      tokenHash,
      usedAt: null,
    }).sort({ createdAt: -1 });

    if (!verificationToken) {
      // Check if any unused token exists (wrong OTP)
      const unusedToken = await VerificationToken.findOne({
        userId,
        type: otpType,
        usedAt: null,
      }).sort({ createdAt: -1 });

      if (unusedToken) {
        unusedToken.attempts += 1;
        await unusedToken.save();

        const remaining = config.maxOtpAttempts - unusedToken.attempts;
        if (remaining <= 0) {
          unusedToken.usedAt = new Date();
          await unusedToken.save();
          return res.status(400).json({ success: false, error: 'OTP_MAX_ATTEMPTS', message: 'Too many failed attempts. Please request a new code.' });
        }
        return res.status(400).json({ success: false, error: 'INVALID_OTP', message: `Invalid code. ${remaining} attempts remaining.` });
      }

      return res.status(400).json({ success: false, error: 'INVALID_OTP', message: 'Invalid code. Please request a new code.' });
    }

    // Check expiry
    if (verificationToken.expiresAt < new Date()) {
      verificationToken.usedAt = new Date();
      await verificationToken.save();
      return res.status(400).json({ success: false, error: 'OTP_EXPIRED', message: 'Code has expired. Please request a new one.' });
    }

    // Check max attempts
    if (verificationToken.attempts >= config.maxOtpAttempts) {
      verificationToken.usedAt = new Date();
      await verificationToken.save();
      return res.status(400).json({ success: false, error: 'OTP_MAX_ATTEMPTS', message: 'Too many failed attempts. Please request a new code.' });
    }

    // Mark token as used
    verificationToken.usedAt = new Date();
    await verificationToken.save();

    // Check if both channels are required and both are verified
    const requireEmailSetting = await Setting.findOne({ key: 'checkout.otp.requireEmail' }).lean();
    const requireSmsSetting = await Setting.findOne({ key: 'checkout.otp.requireSms' }).lean();
    const requireEmail = requireEmailSetting ? requireEmailSetting.value !== 'false' : true;
    const requireSms = requireSmsSetting ? requireSmsSetting.value !== 'false' : true;

    // Check which channels are verified
    const emailVerified = !requireEmail || await isChannelVerified(userId, 'checkout_email');
    const smsVerified = !requireSms || await isChannelVerified(userId, 'checkout_sms');

    const allVerified = emailVerified && smsVerified;

    if (allVerified) {
      const expirySetting = await Setting.findOne({ key: 'checkout.otp.expiryMinutes' }).lean();
      const expiryMinutes = expirySetting ? parseInt(expirySetting.value, 10) : 15;

      user.checkoutOtpVerified = true;
      user.checkoutOtpVerifiedAt = new Date();
      await user.save();
    }

    // Fire-and-forget audit log
    const reqContext = (req as AuditRequest).auditContext;
    if (reqContext) {
      auditService.log({
        ...reqContext,
        actorType: 'USER',
        actorId: userId,
        actorEmail: user.email,
      } as any, {
        action: 'checkout_otp.verify',
        eventType: 'USER_ACTION',
        eventCategory: 'SECURITY',
        operationType: 'OTP_VERIFY',
        resourceType: 'user',
        resourceId: userId,
        metadata: { channel, success: true, allVerified },
      } as any).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: {
        verified: true,
        channel,
        allVerified,
        expiresAt: allVerified ? user.checkoutOtpVerifiedAt : undefined,
      },
    });
  } catch (error) {
    console.error('Verify checkout OTP error:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify code' });
  }
});

// GET /api/customer/checkout-otp/status — check verification status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const expirySetting = await Setting.findOne({ key: 'checkout.otp.expiryMinutes' }).lean();
    const expiryMinutes = expirySetting ? parseInt(expirySetting.value, 10) : 15;

    let isValid = false;
    if (user.checkoutOtpVerified && user.checkoutOtpVerifiedAt) {
      const elapsed = Date.now() - user.checkoutOtpVerifiedAt.getTime();
      isValid = elapsed < expiryMinutes * 60 * 1000;
    }

    const emailVerified = await isChannelVerified(userId, 'checkout_email');
    const smsVerified = await isChannelVerified(userId, 'checkout_sms');

    return res.status(200).json({
      success: true,
      data: {
        verified: isValid,
        emailVerified,
        smsVerified,
        expiresAt: user.checkoutOtpVerifiedAt,
      },
    });
  } catch (error) {
    console.error('Get checkout OTP status error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check verification status' });
  }
});

// Helper: check if a channel has a verified OTP within the last 15 minutes
async function isChannelVerified(userId: string, type: string): Promise<boolean> {
  const recent = await VerificationToken.findOne({
    userId,
    type,
    usedAt: { $ne: null },
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  }).sort({ createdAt: -1 });
  return !!recent;
}

export default router;
