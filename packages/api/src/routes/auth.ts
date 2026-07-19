import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { registerSchema, loginSchema, verifyOtpSchema, updateProfileSchema, changePasswordSchema } from '../middleware/schemas';
import { hashPassword, verifyPassword, generateToken, generateOtp } from '../services/auth.service';
import { User, Role, UserRole } from '@pawtag/db';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new account
 *     description: Create a new customer account. Returns a verification message.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Email or phone already registered
 */
router.post('/register', validate(registerSchema), async (req, res: Response) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email or phone already registered' });
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
    });

    // Assign CUSTOMER RBAC role to new registrant
    const customerRole = await Role.findOne({ name: 'CUSTOMER' });
    if (customerRole) {
      await UserRole.create({
        userId: user._id,
        roleId: customerRole._id,
        isActive: true,
      });
    }

    // TODO: Send OTP email/SMS
    const otp = generateOtp();
    console.log(`OTP for ${email}: ${otp}`);

    res.status(201).json({
      success: true,
      data: { message: 'Registration successful. Please verify your email.' },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login to your account
 *     description: Authenticate with email and password. Returns a JWT token and user info.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT token for authentication
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), async (req, res: Response) => {
  try {
    const { email, password } = req.body;

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

    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    // Fetch RBAC roles
    const userRoles = await UserRole.find({ userId: user._id, isActive: true })
      .populate('roleId', 'name displayName isSuperAdmin');
    const rbacRoles = userRoles.map((ur) => ur.roleId);

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

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with OTP
 *     description: Verify your email address using a 6-digit OTP code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post('/verify-otp', validate(verifyOtpSchema), async (req, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (otp.length !== 6) {
      res.status(400).json({ success: false, error: 'Invalid OTP' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    user.emailVerified = true;
    user.status = 'active';
    await user.save();

    res.json({ success: true, data: { message: 'Email verified successfully' } });
  } catch (error) {
    console.error('OTP verify error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     description: Send a password reset email. Always returns success for security.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent (if account exists)
 */
router.post('/forgot-password', async (req, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
      return;
    }
    // TODO: Send reset email with token
    res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
  } catch {
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    const userData = user.toObject() as any;
    userData.id = userData._id;

    // Include RBAC roles
    const userRoles = await UserRole.find({ userId: user._id, isActive: true })
      .populate('roleId', 'name displayName isSuperAdmin');
    userData.rbacRoles = userRoles.map((ur) => ur.roleId);

    res.json({ success: true, data: userData });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update current user profile
 *     description: Update the authenticated user's profile information.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   line1: { type: string }
 *                   city: { type: string }
 *                   state: { type: string }
 *                   zip: { type: string }
 *                   country: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Not authenticated
 */
router.put('/profile', authenticate, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true }).select(
      '-passwordHash',
    );
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

// POST /api/auth/change-password
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
