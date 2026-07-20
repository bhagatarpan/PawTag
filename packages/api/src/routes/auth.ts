import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendEmailVerificationSchema,
  sendPhoneOtpSchema,
  verifyPhoneSchema,
  resendPhoneOtpSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../middleware/schemas';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateOtp,
  generateSecureToken,
  hashToken,
  normalizeEmail,
  normalizePhone,
} from '../services/auth.service';
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from '../services/email.service';
import { sendPhoneOtpSMS } from '../services/sms.service';
import { User, Role, UserRole, VerificationToken, AuditLog } from '@pawtag/db';
import { config } from '../config';

const router = Router();

function getClientInfo(req: any) {
  return { ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers['user-agent'] };
}

async function checkAndActivateUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) return;
  if (user.emailVerified && user.phoneVerified && user.status === 'pending_verification') {
    user.status = 'active';
    await user.save();
    await sendWelcomeEmail(user.email, user.fullName);
  }
}

router.post('/register', validate(registerSchema), async (req, res: Response) => {
  try {
    const { email: rawEmail, password, fullName, phoneNumber: rawPhone } = req.body;
    const email = normalizeEmail(rawEmail);
    const phoneNumber = normalizePhone(rawPhone);

    const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existing) {
      res.status(400).json({ success: false, error: 'An account with this email or phone number already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      fullName,
      phoneNumber,
      role: 'customer',
      status: 'pending_verification',
      emailVerified: false,
      phoneVerified: false,
    });

    const customerRole = await Role.findOne({ name: 'CUSTOMER' });
    if (customerRole) {
      await UserRole.create({ userId: user._id, roleId: customerRole._id, isActive: true });
    }

    const emailToken = generateSecureToken();
    const emailTokenHash = hashToken(emailToken);
    const emailExpiry = new Date(Date.now() + config.emailTokenExpiryHours * 60 * 60 * 1000);
    const clientInfo = getClientInfo(req);

    await VerificationToken.create({
      userId: user._id,
      type: 'email_verification',
      tokenHash: emailTokenHash,
      expiresAt: emailExpiry,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    const emailResult = await sendVerificationEmail(email, fullName, emailToken);

    await AuditLog.create({
      userId: user._id,
      action: 'registration',
      entity: 'user',
      entityId: user._id.toString(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Your account has been created. Please verify your email address and mobile number to activate your account.',
        userId: user._id,
        email,
        emailSent: emailResult.success,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', validate(loginSchema), async (req, res: Response) => {
  try {
    const { email: rawEmail, password } = req.body;
    const email = normalizeEmail(rawEmail);

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

    if (user.status === 'inactive') {
      res.status(403).json({
        success: false,
        error: 'Your account is inactive. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // Check if user has admin roles — admins bypass verification
    const userRoles = await UserRole.find({ userId: user._id, isActive: true })
      .populate('roleId', 'name displayName isSuperAdmin');
    const rbacRoles = userRoles.map((ur) => ur.roleId);
    const isAdmin = rbacRoles.some((r: any) => r.isSuperAdmin || ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'WEBSITE_EDITOR'].includes(r.name));

    if (user.status === 'pending_verification' && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Please verify your email and phone number to activate your account.',
        code: 'REQUIRES_VERIFICATION',
        data: {
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          email,
          phoneNumber: user.phoneNumber,
        },
      });
      return;
    }

    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          rbacRoles,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.get('/verify-email', async (req, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      res.redirect(`${config.frontendUrl}/verify-account?email_status=invalid`);
      return;
    }

    const tokenHash = hashToken(token);
    const verificationToken = await VerificationToken.findOne({
      tokenHash,
      type: 'email_verification',
      usedAt: null,
    });

    if (!verificationToken) {
      res.redirect(`${config.frontendUrl}/verify-account?email_status=invalid`);
      return;
    }

    if (verificationToken.expiresAt < new Date()) {
      res.redirect(`${config.frontendUrl}/verify-account?email_status=expired`);
      return;
    }

    const user = await User.findById(verificationToken.userId);
    if (!user) {
      res.redirect(`${config.frontendUrl}/verify-account?email_status=invalid`);
      return;
    }

    if (user.emailVerified) {
      res.redirect(`${config.frontendUrl}/verify-account?email_status=already_verified`);
      return;
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    verificationToken.usedAt = new Date();
    await verificationToken.save();

    const clientInfo = getClientInfo(req);
    await AuditLog.create({
      userId: user._id,
      action: 'email_verified',
      entity: 'user',
      entityId: user._id.toString(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    await checkAndActivateUser(user._id.toString());

    res.redirect(`${config.frontendUrl}/verify-account?email_status=verified`);
  } catch (error) {
    console.error('Email verification error:', error);
    res.redirect(`${config.frontendUrl}/verify-account?email_status=error`);
  }
});

router.post('/resend-email-verification', validate(resendEmailVerificationSchema), async (req, res: Response) => {
  try {
    const { email: rawEmail } = req.body;
    const email = normalizeEmail(rawEmail);

    const user = await User.findOne({ email });
    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, a verification email has been sent.' } });
      return;
    }

    if (user.emailVerified) {
      res.json({ success: true, data: { message: 'Your email is already verified.' } });
      return;
    }

    const recentTokens = await VerificationToken.countDocuments({
      userId: user._id,
      type: 'email_verification',
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });

    if (recentTokens >= config.maxResendCount) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again in 15 minutes.',
      });
      return;
    }

    await VerificationToken.updateMany(
      { userId: user._id, type: 'email_verification', usedAt: null },
      { usedAt: new Date() },
    );

    const emailToken = generateSecureToken();
    const emailTokenHash = hashToken(emailToken);
    const emailExpiry = new Date(Date.now() + config.emailTokenExpiryHours * 60 * 60 * 1000);
    const clientInfo = getClientInfo(req);

    await VerificationToken.create({
      userId: user._id,
      type: 'email_verification',
      tokenHash: emailTokenHash,
      expiresAt: emailExpiry,
      resendCount: recentTokens + 1,
      lastSentAt: new Date(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    const emailResult = await sendVerificationEmail(email, user.fullName, emailToken);

    await AuditLog.create({
      userId: user._id,
      action: 'email_verification_resent',
      entity: 'user',
      entityId: user._id.toString(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    res.json({
      success: true,
      data: {
        message: 'If an account exists, a verification email has been sent.',
        emailSent: emailResult.success,
      },
    });
  } catch (error) {
    console.error('Resend email verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend verification email' });
  }
});

router.post('/send-phone-otp', validate(sendPhoneOtpSchema), async (req, res: Response) => {
  try {
    const { phoneNumber: rawPhone } = req.body;
    const phoneNumber = normalizePhone(rawPhone);

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, an OTP has been sent.' } });
      return;
    }

    if (user.phoneVerified) {
      res.json({ success: true, data: { message: 'Your phone number is already verified.' } });
      return;
    }

    const recentOtps = await VerificationToken.countDocuments({
      userId: user._id,
      type: 'phone_otp',
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });

    if (recentOtps >= config.maxResendCount) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again in 15 minutes.',
      });
      return;
    }

    await VerificationToken.updateMany(
      { userId: user._id, type: 'phone_otp', usedAt: null },
      { usedAt: new Date() },
    );

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const otpExpiry = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);
    const clientInfo = getClientInfo(req);

    await VerificationToken.create({
      userId: user._id,
      type: 'phone_otp',
      tokenHash: otpHash,
      expiresAt: otpExpiry,
      resendCount: recentOtps + 1,
      lastSentAt: new Date(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    const smsResult = await sendPhoneOtpSMS(phoneNumber, otp);

    await AuditLog.create({
      userId: user._id,
      action: 'phone_otp_sent',
      entity: 'user',
      entityId: user._id.toString(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    res.json({
      success: true,
      data: {
        message: 'If an account exists, an OTP has been sent.',
        smsSent: smsResult.success,
      },
    });
  } catch (error) {
    console.error('Send phone OTP error:', error);
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

router.post('/verify-phone', validate(verifyPhoneSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { otp } = req.body;

    let userId = req.user?.id;

    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.default.verify(authHeader.split(' ')[1], config.jwtSecret) as { id: string };
          userId = decoded.id;
        } catch {
          // Token invalid — continue without userId
        }
      }
    }

    if (!userId) {
      const { phoneNumber: rawPhone } = req.body;
      if (!rawPhone) {
        res.status(401).json({ success: false, error: 'Authentication required or phone number required' });
        return;
      }
      const phoneNumber = normalizePhone(rawPhone);
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }
      userId = user._id.toString();
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.phoneVerified) {
      res.json({ success: true, data: { message: 'Phone number is already verified.' } });
      return;
    }

    const otpHash = hashToken(otp);
    const verificationToken = await VerificationToken.findOne({
      userId: user._id,
      type: 'phone_otp',
      tokenHash: otpHash,
      usedAt: null,
    }).sort({ createdAt: -1 });

    if (!verificationToken) {
      const allOtps = await VerificationToken.find({
        userId: user._id,
        type: 'phone_otp',
        usedAt: null,
      }).sort({ createdAt: -1 });

      let tokenWithAttempts: typeof allOtps[0] | null = null;
      for (const t of allOtps) {
        if (t.attempts < config.maxOtpAttempts) {
          tokenWithAttempts = t;
          break;
        }
      }

      if (!tokenWithAttempts) {
        res.status(400).json({
          success: false,
          error: 'Too many failed attempts. Please request a new OTP.',
          code: 'OTP_MAX_ATTEMPTS',
        });
        return;
      }

      tokenWithAttempts.attempts += 1;
      await tokenWithAttempts.save();

      const remaining = config.maxOtpAttempts - tokenWithAttempts.attempts;
      res.status(400).json({
        success: false,
        error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
        code: 'INVALID_OTP',
        data: { remainingAttempts: remaining },
      });
      return;
    }

    if (verificationToken.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        error: 'This OTP has expired. Please request a new one.',
        code: 'OTP_EXPIRED',
      });
      return;
    }

    if (verificationToken.attempts >= config.maxOtpAttempts) {
      res.status(400).json({
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.',
        code: 'OTP_MAX_ATTEMPTS',
      });
      return;
    }

    user.phoneVerified = true;
    user.phoneVerifiedAt = new Date();
    await user.save();

    verificationToken.usedAt = new Date();
    verificationToken.attempts += 1;
    await verificationToken.save();

    const clientInfo = getClientInfo(req);
    await AuditLog.create({
      userId: user._id,
      action: 'phone_verified',
      entity: 'user',
      entityId: user._id.toString(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    await checkAndActivateUser(user._id.toString());

    res.json({ success: true, data: { message: 'Phone number verified successfully.' } });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

router.post('/resend-phone-otp', validate(resendPhoneOtpSchema), async (req, res: Response) => {
  try {
    const { phoneNumber: rawPhone } = req.body;
    const phoneNumber = normalizePhone(rawPhone);

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, an OTP has been sent.' } });
      return;
    }

    if (user.phoneVerified) {
      res.json({ success: true, data: { message: 'Your phone number is already verified.' } });
      return;
    }

    const recentOtps = await VerificationToken.countDocuments({
      userId: user._id,
      type: 'phone_otp',
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });

    if (recentOtps >= config.maxResendCount) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again in 15 minutes.',
      });
      return;
    }

    await VerificationToken.updateMany(
      { userId: user._id, type: 'phone_otp', usedAt: null },
      { usedAt: new Date() },
    );

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const otpExpiry = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);
    const clientInfo = getClientInfo(req);

    await VerificationToken.create({
      userId: user._id,
      type: 'phone_otp',
      tokenHash: otpHash,
      expiresAt: otpExpiry,
      resendCount: recentOtps + 1,
      lastSentAt: new Date(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    const smsResult = await sendPhoneOtpSMS(phoneNumber, otp);

    await AuditLog.create({
      userId: user._id,
      action: 'phone_otp_resent',
      entity: 'user',
      entityId: user._id.toString(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    res.json({
      success: true,
      data: {
        message: 'If an account exists, an OTP has been sent.',
        smsSent: smsResult.success,
      },
    });
  } catch (error) {
    console.error('Resend phone OTP error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend OTP' });
  }
});

router.get('/verification-status', async (req: AuthRequest, res: Response) => {
  try {
    let userId = req.user?.id;

    if (!userId && req.query.email) {
      const user = await User.findOne({ email: req.query.email as string });
      if (user) userId = user._id.toString();
    }

    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required or email required' });
      return;
    }

    const user = await User.findById(userId).select('emailVerified phoneVerified status email phoneNumber');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const lastOtp = await VerificationToken.findOne({
      userId: user._id,
      type: 'phone_otp',
    }).sort({ createdAt: -1 });

    const otpCooldown = lastOtp?.lastSentAt
      ? Math.max(0, config.resendCooldownSeconds - Math.floor((Date.now() - lastOtp.lastSentAt.getTime()) / 1000))
      : 0;

    res.json({
      success: true,
      data: {
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        status: user.status,
        email: user.email,
        phoneNumber: user.phoneNumber,
        otpCooldown,
      },
    });
  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get verification status' });
  }
});

router.post('/forgot-password', async (req, res: Response) => {
  try {
    const { email: rawEmail } = req.body;
    const email = normalizeEmail(rawEmail);

    const user = await User.findOne({ email });
    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
      return;
    }

    const resetToken = generateSecureToken();
    const resetTokenHash = hashToken(resetToken);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    const clientInfo = getClientInfo(req);

    await VerificationToken.create({
      userId: user._id,
      type: 'password_reset',
      tokenHash: resetTokenHash,
      expiresAt: resetExpiry,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    await sendPasswordResetEmail(email, user.fullName, resetToken);

    await AuditLog.create({
      userId: user._id,
      action: 'password_reset_requested',
      entity: 'user',
      entityId: user._id.toString(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    const userData = user.toObject() as any;
    userData.id = userData._id;

    const userRoles = await UserRole.find({ userId: user._id, isActive: true })
      .populate('roleId', 'name displayName isSuperAdmin');
    userData.rbacRoles = userRoles.map((ur) => ur.roleId);

    res.json({ success: true, data: userData });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

router.put('/profile', authenticate, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!.id);
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ success: false, error: 'Current password is incorrect' }); return; }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

export default router;
