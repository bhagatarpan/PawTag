import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
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
  forgotPasswordSchema,
  resetPasswordSchema,
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
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/auth.service';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendWelcomeEmail, sendLoginNotification, sendLoginOtpEmail } from '../services/email.service';
import { sendPhoneOtpSMS } from '../services/sms.service';
import { isRegistrationOtpDisabled } from '../services/otp-settings.service';
import { User, Role, UserRole, VerificationToken, Setting, AuditEvent } from '@pawtag/db';
import { auditService, resolveActorType, type AuditContext } from '../services/audit';
import { createAuditContextFromRequest, setAuditActor, type AuditRequest } from '../middleware/audit';
import { config } from '../config';
import logger from '../lib/logger';

const router = Router();

// Brute-force protection: 5 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5', 10),
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});

// Prevent spam account creation: 3 registrations per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX || '3', 10),
  message: { success: false, error: 'Too many registration attempts. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});

// Prevent email bombing: 3 password resets per hour per IP
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX || '3', 10),
  message: { success: false, error: 'Too many password reset attempts. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});

// MFA: 1 OTP send per 30 seconds
const mfaSendLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: parseInt(process.env.MFA_SEND_RATE_LIMIT_MAX || '1', 10),
  message: { success: false, error: 'Please wait before requesting a new code.' },
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});

// MFA: 5 verify attempts per 15 minutes
const mfaVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.MFA_VERIFY_RATE_LIMIT_MAX || '5', 10),
  message: { success: false, error: 'Too many verification attempts. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});

function getClientInfo(req: any) {
  return { ipAddress: req.ip || req.connection?.remoteAddress, userAgent: req.headers['user-agent'] };
}

async function auditAuthEvent(
  req: AuditRequest,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<Parameters<typeof auditService.log>[0]> = {},
): Promise<void> {
  const reqContext = req.auditContext as AuditContext;
  if (!reqContext) {
    throw new Error('Audit middleware not applied - request has no audit context');
  }
  const context: AuditContext = {
    ...reqContext,
    actorType: 'USER',
    ...overrides,
  } as AuditContext;
  await auditService.log(context, input);
}

/**
 * Emit a FAILURE audit event for a denied/failed security flow (failed login,
 * lockout attempt, blocked account, etc.). Failures in these paths must never
 * change the HTTP response, but must never be silently dropped either.
 */
async function auditSecurityFailure(
  req: AuditRequest,
  payload: { action: string; eventType: string; reason: string; resourceId?: string; actorEmail?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  const reqContext = req.auditContext as AuditContext;
  if (!reqContext) return;
  try {
    await auditService.log(
      {
        ...reqContext,
        actorType: 'UNKNOWN',
        actorEmail: payload.actorEmail,
        actorUsername: payload.actorEmail,
        authenticationMethod: 'password',
      } as AuditContext,
      {
        action: payload.action,
        eventType: payload.eventType,
        eventCategory: 'AUTH',
        operationType: 'CREATE',
        resourceType: 'User',
        resourceId: payload.resourceId,
        outcome: 'FAILURE',
        severity: 'HIGH',
        status: 'denied',
        reason: payload.reason,
        metadata: payload.metadata,
      },
    );
  } catch (err) {
    logger.error({ err, reason: payload.reason }, 'Failed to persist security failure audit event');
  }
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

/** In development with MFA test mode enabled, route verification emails to the test email. */
async function resolveVerificationRecipient(originalEmail: string): Promise<string> {
  if (config.nodeEnv !== 'development') return originalEmail;
  const mfaTestMode = (await Setting.findOne({ key: 'mfa.testMode' }).lean())?.value === 'true';
  if (!mfaTestMode) return originalEmail;
  const mfaTestEmail = (await Setting.findOne({ key: 'mfa.testEmail' }).lean())?.value || 'arpanbhagat@yahoo.com';
  return mfaTestEmail;
}

/** In development with MFA test mode enabled, return the test email for sending OTPs, else null. */
async function getTestEmailRecipient(): Promise<string | null> {
  if (config.nodeEnv !== 'development') return null;
  const mfaTestMode = (await Setting.findOne({ key: 'mfa.testMode' }).lean())?.value === 'true';
  if (!mfaTestMode) return null;
  return (await Setting.findOne({ key: 'mfa.testEmail' }).lean())?.value || 'arpanbhagat@yahoo.com';
}

router.post('/register', registerLimiter, validate(registerSchema), async (req, res: Response) => {
  try {
    const { email: rawEmail, password, fullName, phoneNumber: rawPhone } = req.body;
    const email = normalizeEmail(rawEmail);
    const phoneNumber = normalizePhone(rawPhone);

    const existing = await User.findOne({ $or: [{ email }, { phoneNumber }], deletedAt: null });
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
      await UserRole.create({
        userId: user._id,
        roleId: customerRole._id,
        assignedBy: user._id,
        isActive: true,
      });
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

    const emailResult = await sendVerificationEmail(await resolveVerificationRecipient(email), fullName, emailToken);

    if (config.nodeEnv === 'development') {
      console.log('\n🔑 [DEV] Email verification URL:');
      console.log(`   ${config.frontendUrl}/verify-email?token=${emailToken}\n`);
    }

    await auditAuthEvent(req as AuditRequest, {
      action: 'register',
      eventType: 'user_registration',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { email, fullName, role: 'customer', emailSent: emailResult.success },
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

// CAPTCHA endpoint: generates a simple math challenge
router.get('/captcha', (_req, res: Response) => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const operators = ['+', '-', '×'];
  const op = operators[Math.floor(Math.random() * operators.length)];
  let answer: number;
  let question: string;

  switch (op) {
    case '+': answer = a + b; question = `${a} + ${b}`; break;
    case '-': answer = a - b; question = `${a} − ${b}`; break;
    case '×': answer = a * b; question = `${a} × ${b}`; break;
    default: answer = a + b; question = `${a} + ${b}`;
  }

  const token = jwt.sign({ captchaAnswer: answer }, config.jwtSecret, { expiresIn: '5m' });

  res.json({
    success: true,
    data: { question: `What is ${question}?`, token },
  });
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res: Response) => {
  try {
    const { email: rawEmail, password, captchaToken, captchaAnswer } = req.body;
    const email = normalizeEmail(rawEmail);

    const user = await User.findOne({ email, deletedAt: null });

    // CAPTCHA check: after 2 failed attempts, require CAPTCHA
    if (user && (user.failedLoginAttempts || 0) >= 2 && !captchaToken) {
      res.status(400).json({
        success: false,
        error: 'CAPTCHA required. Please complete the verification.',
        code: 'CAPTCHA_REQUIRED',
      });
      return;
    }

    // Validate CAPTCHA if provided
    if (captchaToken && captchaAnswer !== undefined) {
      try {
        const decoded = jwt.verify(captchaToken, config.jwtSecret) as { captchaAnswer: number; exp: number };
        if (decoded.captchaAnswer !== captchaAnswer) {
          res.status(400).json({ success: false, error: 'Invalid CAPTCHA answer. Please try again.' });
          return;
        }
      } catch {
        res.status(400).json({ success: false, error: 'CAPTCHA expired. Please get a new one.' });
        return;
      }
    }

    if (!user) {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'login_failed',
        eventType: 'login_failure',
        reason: 'account_not_found',
        metadata: { email, captchaRequired: false },
      });
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check if account is locked due to too many failed attempts
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await auditSecurityFailure(req as AuditRequest, {
        action: 'login_blocked',
        eventType: 'login_blocked_account_locked',
        reason: 'account_locked',
        resourceId: user._id.toString(),
        actorEmail: user.email,
        metadata: { minutesLeft },
      });
      res.status(423).json({
        success: false,
        error: `Account locked due to too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
        code: 'ACCOUNT_LOCKED',
      });
      return;
    }

    // If lockout has expired, clear it
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      await user.save();
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      // Track failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MINUTES = 30;
      const lockoutTriggered = user.failedLoginAttempts >= MAX_ATTEMPTS;
      if (lockoutTriggered) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await auditAuthEvent(req as AuditRequest, {
          action: 'account_locked',
          eventType: 'account_lockout',
          eventCategory: 'SECURITY',
          operationType: 'UPDATE',
          resourceType: 'User',
          resourceId: user._id.toString(),
          outcome: 'SUCCESS',
          severity: 'HIGH',
          metadata: { reason: 'too_many_failed_logins', attempts: user.failedLoginAttempts, maxAttempts: MAX_ATTEMPTS },
        }, { actorType: 'SYSTEM' });
      }
      await user.save();

      await auditSecurityFailure(req as AuditRequest, {
        action: 'login_failed',
        eventType: 'login_failure',
        reason: lockoutTriggered ? 'invalid_credentials_and_locked' : 'invalid_credentials',
        resourceId: user._id.toString(),
        actorEmail: user.email,
        metadata: { attempts: user.failedLoginAttempts, maxAttempts: MAX_ATTEMPTS },
      });

      // Send notification for failed admin login attempts
      const isAdminUser = user.role === 'admin' || user.role === 'customer_service';
      if (isAdminUser) {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const ua = req.headers['user-agent'] || 'unknown';
        sendLoginNotification(user.email, user.fullName, user.email, ip, ua, false).catch(() => {});
      }

      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Successful login — reset failed attempts and update lastLogin
    // Use findOneAndUpdate to skip validation (some users may lack phoneNumber)
    const updateFields: Record<string, unknown> = { lastLogin: new Date() };
    if (user.failedLoginAttempts > 0) {
      updateFields.failedLoginAttempts = 0;
      updateFields.lockedUntil = undefined;
    }
    await User.findByIdAndUpdate(user._id, { $set: updateFields });

if (user.status === 'suspended') {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'login_blocked',
        eventType: 'login_blocked_suspended',
        reason: 'account_suspended',
        resourceId: user._id.toString(),
        actorEmail: user.email,
      });
      res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

if (user.status === 'inactive') {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'login_blocked',
        eventType: 'login_blocked_inactive',
        reason: 'account_inactive',
        resourceId: user._id.toString(),
        actorEmail: user.email,
      });
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
      await auditSecurityFailure(req as AuditRequest, {
        action: 'login_blocked',
        eventType: 'login_blocked_pending_verification',
        reason: 'requires_verification',
        resourceId: user._id.toString(),
        actorEmail: user.email,
      });
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

    // MFA check: determine if MFA is required for this user
    const mfaAdminEnabled = (await Setting.findOne({ key: 'mfa.adminEnabled' }).lean())?.value === 'true';
    const mfaCustomerEnabled = (await Setting.findOne({ key: 'mfa.customerEnabled' }).lean())?.value === 'true';
    const mfaTestMode = (await Setting.findOne({ key: 'mfa.testMode' }).lean())?.value === 'true';
    const mfaTestEmail = (await Setting.findOne({ key: 'mfa.testEmail' }).lean())?.value || 'arpanbhagat@yahoo.com';

    let mfaRequired = false;
    if (isAdmin) {
      // Admin/CSR: MFA only if global admin setting is enabled
      mfaRequired = mfaAdminEnabled;
    } else {
      // Customer: MFA if per-user field is true (defaults true) AND global setting is enabled
      mfaRequired = user.mfaEnabled !== false && mfaCustomerEnabled;
    }

    if (mfaRequired) {
      // Generate temp token for MFA flow (5 min expiry)
      const tempToken = jwt.sign(
        { userId: user._id.toString(), email: user.email, purpose: 'login_mfa' },
        config.jwtSecret,
        { expiresIn: '5m' },
      );

      // Generate and send OTP
      const otp = generateOtp();
      const otpHash = hashToken(otp);
      const mfaOtpExpiry = 5; // minutes

      await VerificationToken.create({
        userId: user._id,
        tokenHash: otpHash,
        type: 'login_mfa',
        expiresAt: new Date(Date.now() + mfaOtpExpiry * 60 * 1000),
        attempts: 0,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Send OTP email (test mode: send to test email)
      const recipient = mfaTestMode ? mfaTestEmail : user.email;
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const ua = req.headers['user-agent'] || 'unknown';
      sendLoginOtpEmail(recipient, user.fullName, otp, `${mfaOtpExpiry} minutes`).catch(() => {});

      await auditAuthEvent(req as AuditRequest, {
        action: 'login_mfa_otp_sent',
        eventType: 'mfa_otp_sent',
        eventCategory: 'AUTH',
        operationType: 'CREATE',
        resourceType: 'User',
        resourceId: user._id.toString(),
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: { mfaType: 'email_otp', recipient: mfaTestMode ? 'test_email' : 'user_email', otpExpiryMinutes: mfaOtpExpiry },
      });

      // Mask email for response
      const [localPart, domain] = user.email.split('@');
      const maskedEmail = localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1) + '@' + domain;

      res.json({
        success: true,
        data: {
          code: 'MFA_REQUIRED',
          tempToken,
          maskedEmail,
          expiresIn: mfaOtpExpiry * 60,
        },
      });
      return;
    }

    // No MFA required — generate tokens directly
    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    const refreshTokens = generateRefreshToken();
    await storeRefreshToken(user._id.toString(), refreshTokens.tokenHash);

    await auditAuthEvent(req as AuditRequest, {
      action: 'login',
      eventType: 'user_login',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { mfaRequired: false, isAdmin, rbacRoles: rbacRoles.map((r: any) => r.name) },
    }, { actorType: resolveActorType(user.role), authenticationMethod: 'password' });

    // Send login notification for admin accounts
    if (isAdmin) {
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const ua = req.headers['user-agent'] || 'unknown';
      sendLoginNotification(user.email, user.fullName, user.email, ip, ua, true).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        token,
        refreshToken: refreshTokens.token,
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
  const isAjax = req.headers.accept?.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest';

  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      if (isAjax) { res.status(400).json({ success: false, error: 'Invalid verification link.', code: 'invalid' }); return; }
      res.redirect(`${config.frontendUrl}/verify-account?email_status=invalid`);
      return;
    }

    const tokenHash = hashToken(token);
    const verificationToken = await VerificationToken.findOne({
      tokenHash,
      type: 'email_verification',
    });

    if (!verificationToken) {
      if (isAjax) { res.status(400).json({ success: false, error: 'Invalid or used verification link.', code: 'invalid' }); return; }
      res.redirect(`${config.frontendUrl}/verify-account?email_status=invalid`);
      return;
    }

    // Idempotency guard: if this exact token already verified the user (e.g. a
    // double-invocation of the frontend effect), treat it as success instead of "used".
    if (verificationToken.usedAt) {
      const alreadyUser = await User.findById(verificationToken.userId);
      if (alreadyUser && alreadyUser.emailVerified) {
        if (isAjax) { res.json({ success: true, data: { message: 'Email already verified.', email: alreadyUser.email, phoneNumber: alreadyUser.phoneNumber } }); return; }
        res.redirect(`${config.frontendUrl}/verify-account?email_status=already_verified`);
        return;
      }
    }

    if (verificationToken.expiresAt < new Date()) {
      if (isAjax) { res.status(400).json({ success: false, error: 'This verification link has expired.', code: 'expired' }); return; }
      res.redirect(`${config.frontendUrl}/verify-account?email_status=expired`);
      return;
    }

    const user = await User.findById(verificationToken.userId);
    if (!user) {
      if (isAjax) { res.status(400).json({ success: false, error: 'User not found.', code: 'invalid' }); return; }
      res.redirect(`${config.frontendUrl}/verify-account?email_status=invalid`);
      return;
    }

    if (user.emailVerified) {
      if (isAjax) { res.json({ success: true, data: { message: 'Email already verified.', email: user.email, phoneNumber: user.phoneNumber } }); return; }
      res.redirect(`${config.frontendUrl}/verify-account?email_status=already_verified`);
      return;
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    verificationToken.usedAt = new Date();
    await verificationToken.save();

    await auditAuthEvent(req as AuditRequest, {
      action: 'email_verified',
      eventType: 'email_verification',
      eventCategory: 'AUTH',
      operationType: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { email: user.email, tokenId: verificationToken._id.toString() },
    }, { actorType: 'USER' });

    await checkAndActivateUser(user._id.toString());

    if (isAjax) {
      res.json({ success: true, data: { message: 'Email verified successfully!', email: user.email, phoneNumber: user.phoneNumber } });
      return;
    }
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

    const user = await User.findOne({ email, deletedAt: null });
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

    const emailResult = await sendVerificationEmail(await resolveVerificationRecipient(email), user.fullName, emailToken);

    if (config.nodeEnv === 'development') {
      console.log('\n🔑 [DEV] Email verification URL (resent):');
      console.log(`   ${config.frontendUrl}/verify-email?token=${emailToken}\n`);
    }

    await auditAuthEvent(req as AuditRequest, {
      action: 'email_verification_resent',
      eventType: 'email_verification_resend',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'LOW',
      metadata: { email: user.email, resendCount: recentTokens + 1, emailSent: emailResult.success },
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

    const user = await User.findOne({ phoneNumber, deletedAt: null });
    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, an OTP has been sent.' } });
      return;
    }

    if (user.phoneVerified) {
      res.json({ success: true, data: { message: 'Your phone number is already verified.' } });
      return;
    }

    // Check if system-wide registration OTP is disabled
    if (await isRegistrationOtpDisabled()) {
      user.phoneVerified = true;
      await user.save();

      await auditAuthEvent(req as AuditRequest, {
        action: 'phone_otp_skipped_system',
        eventType: 'phone_verification_skipped',
        eventCategory: 'AUTH',
        operationType: 'UPDATE',
        resourceType: 'User',
        resourceId: user._id.toString(),
        outcome: 'SUCCESS',
        severity: 'INFO',
        metadata: { reason: 'registration_otp_disabled', phoneNumber },
      }, { actorType: 'SYSTEM' });

      await checkAndActivateUser(user._id);

      res.json({ success: true, data: { message: 'Phone verified (system override).', otpSkipped: true } });
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

    // In dev + test mode, also email the OTP to the test email so it's easy to retrieve
    const testRecipient = await getTestEmailRecipient();
    if (testRecipient) {
      sendLoginOtpEmail(testRecipient, user.fullName, otp, '10 minutes').catch(() => {});
    }

    if (config.nodeEnv === 'development') {
      console.log('\n🔑 [DEV] Phone OTP:');
      console.log(`   Phone: ${phoneNumber}`);
      console.log(`   OTP:   ${otp}\n`);
    }

    await auditAuthEvent(req as AuditRequest, {
      action: 'phone_otp_sent',
      eventType: 'phone_otp_send',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'LOW',
      metadata: { phoneNumber, smsSent: smsResult.success, testMode: !!testRecipient, otpExpiryMinutes: config.otpExpiryMinutes },
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
      const user = await User.findOne({ phoneNumber, deletedAt: null });
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

    await auditAuthEvent(req as AuditRequest, {
      action: 'phone_verified',
      eventType: 'phone_verification',
      eventCategory: 'AUTH',
      operationType: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { phoneNumber: user.phoneNumber, tokenId: verificationToken._id.toString(), attempts: verificationToken.attempts },
    }, { actorType: 'USER' });

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

    const user = await User.findOne({ phoneNumber, deletedAt: null });
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

    // In dev + test mode, also email the OTP to the test email so it's easy to retrieve
    const testRecipient = await getTestEmailRecipient();
    if (testRecipient) {
      sendLoginOtpEmail(testRecipient, user.fullName, otp, '10 minutes').catch(() => {});
    }

    if (config.nodeEnv === 'development') {
      console.log('\n🔑 [DEV] Phone OTP (resent):');
      console.log(`   Phone: ${phoneNumber}`);
      console.log(`   OTP:   ${otp}\n`);
    }

    await auditAuthEvent(req as AuditRequest, {
      action: 'phone_otp_resent',
      eventType: 'phone_otp_resend',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'LOW',
      metadata: { phoneNumber, smsSent: smsResult.success, resendCount: recentOtps + 1, testMode: !!testRecipient },
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
      const user = await User.findOne({ email: req.query.email as string, deletedAt: null });
      if (user) userId = user._id.toString();
    }

    if (!userId) {
      // Not authenticated and no email given (e.g. someone hit /verify-account directly).
      // Return 200 with null data so the frontend renders the verification steps instead of
      // the axios interceptor redirecting to /login on a 401.
      res.status(200).json({ success: true, data: null });
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

router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), async (req, res: Response) => {
  try {
    const { email: rawEmail } = req.body;
    const email = normalizeEmail(rawEmail);

    const user = await User.findOne({ email, deletedAt: null });
    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
      return;
    }

    const resetToken = generateSecureToken();
    const resetTokenHash = hashToken(resetToken);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    const clientInfo = getClientInfo(req);

    const verificationToken = await VerificationToken.create({
      userId: user._id,
      type: 'password_reset',
      tokenHash: resetTokenHash,
      expiresAt: resetExpiry,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    });

    await sendPasswordResetEmail(email, user.fullName, resetToken);

    if (config.nodeEnv === 'development') {
      console.log('\n🔑 [DEV] Password reset URL:');
      console.log(`   ${config.frontendUrl}/reset-password?token=${resetToken}\n`);
    }

    await auditAuthEvent(req as AuditRequest, {
      action: 'password_reset_requested',
      eventType: 'password_reset_request',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: { email: user.email, tokenId: verificationToken._id.toString(), resetExpiryHours: 1 },
    });

    res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    const tokenHash = hashToken(token);
    const verificationToken = await VerificationToken.findOne({
      tokenHash,
      type: 'password_reset',
      usedAt: null,
    });

    if (!verificationToken) {
      res.status(400).json({ success: false, error: 'Invalid or used reset link.' });
      return;
    }

    if (verificationToken.expiresAt < new Date()) {
      res.status(400).json({ success: false, error: 'This reset link has expired. Please request a new one.' });
      return;
    }

    const user = await User.findById(verificationToken.userId);
    if (!user) {
      res.status(400).json({ success: false, error: 'User not found.' });
      return;
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    verificationToken.usedAt = new Date();
    await verificationToken.save();

    const clientInfo = getClientInfo(req);
    await auditAuthEvent(req as AuditRequest, {
      action: 'password_reset_completed',
      eventType: 'password_reset_complete',
      eventCategory: 'AUTH',
      operationType: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: { email: user.email, tokenId: verificationToken._id.toString() },
    }, { actorType: 'USER', authenticationMethod: 'password_reset_token' });

    sendPasswordChangedEmail(user.email, user.fullName, 'self', clientInfo.ipAddress).catch((err) => {
      console.error('Failed to send password changed email:', err);
    });

    res.json({ success: true, data: { message: 'Password has been reset successfully. You can now log in.' } });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
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
    const existing = await User.findById(req.user!.id);
    if (!existing) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    const beforeState = {
      fullName: existing.fullName,
      email: existing.email,
      phoneNumber: existing.phoneNumber,
      profilePicture: existing.profilePicture,
      address: existing.address,
      emergencyContact: existing.emergencyContact,
    };
    const update = { ...req.body };
    if (update.email && update.email !== existing.email) {
      const inUse = await User.findOne({ email: update.email, _id: { $ne: existing._id }, deletedAt: null });
      if (inUse) {
        await auditAuthEvent(req as AuditRequest, {
          action: 'profile_update_failed',
          eventType: 'profile_update_failed',
          eventCategory: 'AUTH',
          operationType: 'UPDATE',
          resourceType: 'User',
          resourceId: existing._id.toString(),
          outcome: 'FAILURE',
          severity: 'MEDIUM',
          metadata: { reason: 'email_taken', attemptedEmail: update.email },
        }, { actorType: 'USER' });
        res.status(400).json({ success: false, error: 'Email already in use' });
        return;
      }
    }
    const user = await User.findByIdAndUpdate(req.user!.id, update, { new: true }).select('-passwordHash');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    const afterState = {
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePicture: user.profilePicture,
      address: user.address,
      emergencyContact: user.emergencyContact,
    };
    const changedFields = Object.keys(update).map((field) => ({ field, before: (beforeState as any)[field], after: (user as any)[field] }));
    await auditAuthEvent(req as AuditRequest, {
      action: 'profile_updated',
      eventType: 'profile_update',
      eventCategory: 'AUTH',
      operationType: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      beforeState,
      afterState,
      changedFields,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    }, { actorType: 'USER' });

    // Auto-complete onboarding if user has filled all required fields
    if (!user.onboardingCompleted && user.phoneNumber && user.address?.line1 && user.address?.city && user.emergencyContact?.name && user.emergencyContact?.phone) {
      await User.findByIdAndUpdate(user._id, {
        onboardingCompleted: true,
        onboardingSkipped: false,
      });
      user.onboardingCompleted = true;
      user.onboardingSkipped = false;
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

    await auditAuthEvent(req as AuditRequest, {
      action: 'password_changed',
      eventType: 'password_change',
      eventCategory: 'AUTH',
      operationType: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: { changedBy: 'self' },
    }, { authenticationMethod: 'current_password' });

    sendPasswordChangedEmail(user.email, user.fullName, 'self', getClientInfo(req).ipAddress).catch((err) => {
      console.error('Failed to send password changed email:', err);
    });

    res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

router.post('/refresh', async (req, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'Refresh token is required' });
      return;
    }

    const result = await verifyRefreshToken(refreshToken);
    if (!result) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await User.findById(result.userId);
    if (!user || user.status === 'suspended' || user.status === 'inactive') {
      res.status(401).json({ success: false, error: 'User not found or inactive' });
      return;
    }

    const newRefreshTokens = await rotateRefreshToken(refreshToken);
    if (!newRefreshTokens) {
      res.status(401).json({ success: false, error: 'Failed to rotate refresh token' });
      return;
    }

    const newAccessToken = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    await auditAuthEvent(req as AuditRequest, {
      action: 'token_refreshed',
      eventType: 'token_refresh',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'LOW',
      metadata: { rotated: true },
    }, { actorType: 'USER', authenticationMethod: 'refresh_token' });

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshTokens.token,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

router.post('/logout', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    // Logout intentionally remains usable without an access token, but a valid
    // refresh token still gives us enough identity to attribute the event.
    if (!req.user && refreshToken) {
      const refreshPayload = await verifyRefreshToken(refreshToken);
      if (refreshPayload) {
        const logoutUser = await User.findById(refreshPayload.userId).select('_id email role');
        if (logoutUser) {
          setAuditActor(req as AuditRequest, {
            actorType: resolveActorType(logoutUser.role),
            actorId: logoutUser._id.toString(),
            actorEmail: logoutUser.email,
            actorUsername: logoutUser.email,
            authenticationMethod: 'refresh_token',
          });
          req.user = { id: logoutUser._id.toString(), email: logoutUser.email, role: logoutUser.role };
        }
      }
    }

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    await auditAuthEvent(req as AuditRequest, {
      action: 'logout',
      eventType: 'user_logout',
      eventCategory: 'AUTH',
      operationType: 'DELETE',
      resourceType: 'User',
      resourceId: req.user?.id,
      outcome: 'SUCCESS',
      severity: 'LOW',
      metadata: { revokedRefreshToken: !!refreshToken },
    }, { actorType: req.user ? resolveActorType(req.user.role) : 'UNKNOWN' });

    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to logout' });
  }
});

// --- MFA: Send OTP ---
router.post('/mfa/send-otp', mfaSendLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken || typeof tempToken !== 'string') {
      res.status(400).json({ success: false, error: 'Session token is required.' });
      return;
    }

    // Verify temp token
    let decoded: { userId: string; email: string; purpose: string; exp: number };
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret) as { userId: string; email: string; purpose: string; exp: number };
    } catch {
      res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
      return;
    }

    if (decoded.purpose !== 'login_mfa') {
      res.status(401).json({ success: false, error: 'Invalid session.' });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.deletedAt) {
      res.status(401).json({ success: false, error: 'User not found.' });
      return;
    }

    // Generate OTP
    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const mfaOtpExpiry = 5; // minutes

    // Store OTP
    await VerificationToken.create({
      userId: user._id,
      tokenHash: otpHash,
      type: 'login_mfa',
      expiresAt: new Date(Date.now() + mfaOtpExpiry * 60 * 1000),
      attempts: 0,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Check test mode
    const mfaTestMode = (await Setting.findOne({ key: 'mfa.testMode' }).lean())?.value === 'true';
    const mfaTestEmail = (await Setting.findOne({ key: 'mfa.testEmail' }).lean())?.value || 'arpanbhagat@yahoo.com';
    const recipient = mfaTestMode ? mfaTestEmail : user.email;

    // Send OTP email
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    sendLoginOtpEmail(recipient, user.fullName, otp, `${mfaOtpExpiry} minutes`).catch(() => {});

    await auditAuthEvent(req as AuditRequest, {
      action: 'login_mfa_otp_sent',
      eventType: 'mfa_otp_sent',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { mfaType: 'email_otp', recipient: mfaTestMode ? 'test_email' : 'user_email', otpExpiryMinutes: mfaOtpExpiry, tempTokenUsed: true },
    }, { actorType: 'USER', authenticationMethod: 'temp_token' });

    // Mask email
    const [localPart, domain] = user.email.split('@');
    const maskedEmail = localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1) + '@' + domain;

    res.json({
      success: true,
      data: {
        message: 'A verification code has been sent to your email.',
        maskedEmail,
        expiresIn: mfaOtpExpiry * 60,
      },
    });
  } catch (error) {
    console.error('MFA send-otp error:', error);
    res.status(500).json({ success: false, error: 'Failed to send verification code.' });
  }
});

// --- MFA: Verify OTP ---
router.post('/mfa/verify', mfaVerifyLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { tempToken, otp } = req.body;
    if (!tempToken || !otp) {
      res.status(400).json({ success: false, error: 'Session token and verification code are required.' });
      return;
    }

    // Verify temp token
    let decoded: { userId: string; email: string; purpose: string; exp: number };
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret) as { userId: string; email: string; purpose: string; exp: number };
    } catch {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'mfa_failed',
        eventType: 'mfa_verification_failure',
        reason: 'session_expired',
      });
      res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
      return;
    }

    if (decoded.purpose !== 'login_mfa') {
      res.status(401).json({ success: false, error: 'Invalid session.' });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.deletedAt) {
      res.status(401).json({ success: false, error: 'User not found.' });
      return;
    }

    if (user.status === 'suspended') {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'mfa_blocked',
        eventType: 'mfa_blocked_suspended',
        reason: 'account_suspended',
        resourceId: user._id.toString(),
        actorEmail: user.email,
      });
      res.status(403).json({ success: false, error: 'Your account has been suspended.', code: 'ACCOUNT_SUSPENDED' });
      return;
    }
    if (user.status === 'inactive') {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'mfa_blocked',
        eventType: 'mfa_blocked_inactive',
        reason: 'account_inactive',
        resourceId: user._id.toString(),
        actorEmail: user.email,
      });
      res.status(403).json({ success: false, error: 'Your account is inactive.', code: 'ACCOUNT_INACTIVE' });
      return;
    }

    // Find OTP token
    const otpHash = hashToken(otp);
    const token = await VerificationToken.findOne({
      userId: user._id,
      tokenHash: otpHash,
      type: 'login_mfa',
      usedAt: null,
    }).sort({ createdAt: -1 });

    if (!token) {
      // Find any unused token to check attempts
      const anyToken = await VerificationToken.findOne({
        userId: user._id,
        type: 'login_mfa',
        usedAt: null,
      }).sort({ createdAt: -1 });

      if (!anyToken) {
        await auditSecurityFailure(req as AuditRequest, {
          action: 'mfa_failed',
          eventType: 'mfa_verification_failure',
          reason: 'no_active_otp',
          resourceId: user._id.toString(),
          actorEmail: user.email,
        });
        res.status(400).json({ success: false, error: 'No verification code found. Please request a new one.', code: 'OTP_MAX_ATTEMPTS' });
        return;
      }

      const maxAttempts = parseInt(process.env.MAX_OTP_ATTEMPTS || '5', 10);
      if (anyToken.attempts >= maxAttempts) {
        await auditSecurityFailure(req as AuditRequest, {
          action: 'mfa_failed',
          eventType: 'mfa_verification_failure',
          reason: 'otp_max_attempts',
          resourceId: user._id.toString(),
          actorEmail: user.email,
        });
        res.status(400).json({ success: false, error: 'Too many attempts. Please request a new code.', code: 'OTP_MAX_ATTEMPTS' });
        return;
      }

      anyToken.attempts += 1;
      await anyToken.save();

      const remaining = maxAttempts - anyToken.attempts;
      await auditSecurityFailure(req as AuditRequest, {
        action: 'mfa_failed',
        eventType: 'mfa_verification_failure',
        reason: 'invalid_otp',
        resourceId: user._id.toString(),
        actorEmail: user.email,
        metadata: { remainingAttempts: remaining },
      });
      res.status(400).json({
        success: false,
        error: 'Invalid verification code.',
        code: 'INVALID_OTP',
        data: { remainingAttempts: remaining },
      });
      return;
    }

    // Check expiry
    if (token.expiresAt < new Date()) {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'mfa_failed',
        eventType: 'mfa_verification_failure',
        reason: 'otp_expired',
        resourceId: user._id.toString(),
        actorEmail: user.email,
      });
      res.status(400).json({ success: false, error: 'This code has expired. Please request a new one.', code: 'OTP_EXPIRED' });
      return;
    }

    // Check max attempts
    const maxAttempts = parseInt(process.env.MAX_OTP_ATTEMPTS || '5', 10);
    if (token.attempts >= maxAttempts) {
      await auditSecurityFailure(req as AuditRequest, {
        action: 'mfa_failed',
        eventType: 'mfa_verification_failure',
        reason: 'otp_max_attempts',
        resourceId: user._id.toString(),
        actorEmail: user.email,
      });
      res.status(400).json({ success: false, error: 'Too many attempts. Please request a new code.', code: 'OTP_MAX_ATTEMPTS' });
      return;
    }

    // Mark OTP as used
    token.usedAt = new Date();
    token.attempts += 1;
    await token.save();

    // Generate real tokens
    const jwtToken = generateToken({ id: user._id.toString(), email: user.email, role: user.role });
    const refreshTokens = generateRefreshToken();
    await storeRefreshToken(user._id.toString(), refreshTokens.tokenHash);

    // Get RBAC roles
    const userRoles = await UserRole.find({ userId: user._id, isActive: true })
      .populate('roleId', 'name displayName isSuperAdmin');
    const rbacRoles = userRoles.map((ur) => ur.roleId);

    const isAdmin = rbacRoles.some((r: any) => r.isSuperAdmin || ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'WEBSITE_EDITOR'].includes(r.name));
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    await auditAuthEvent(req as AuditRequest, {
      action: 'login_mfa_verified',
      eventType: 'mfa_verification',
      eventCategory: 'AUTH',
      operationType: 'CREATE',
      resourceType: 'User',
      resourceId: user._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { mfaType: 'email_otp', isAdmin, rbacRoles: rbacRoles.map((r: any) => r.name) },
    }, { actorType: resolveActorType(user.role), authenticationMethod: 'mfa_email_otp' });

    // Send login notification for admin accounts
    if (isAdmin) {
      sendLoginNotification(user.email, user.fullName, user.email, ip, ua, true).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        token: jwtToken,
        refreshToken: refreshTokens.token,
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
    console.error('MFA verify error:', error);
    res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

export default router;
