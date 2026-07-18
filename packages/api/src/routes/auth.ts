import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { registerSchema, loginSchema, verifyOtpSchema, updateProfileSchema } from '../middleware/schemas';
import { hashPassword, verifyPassword, generateToken, generateOtp } from '../services/auth.service';
import { User } from '@pawtag/db';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res: Response) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email or phone already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);
    await User.create({
      email,
      passwordHash,
      fullName,
      phoneNumber,
      role: 'customer',
      status: 'pending_verification',
    });

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

// POST /api/auth/login
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
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', validate(verifyOtpSchema), async (req, res: Response) => {
  try {
    const { email, otp } = req.body;

    // TODO: Implement real OTP verification
    // For now, accept any 6-digit code
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

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
      return;
    }

    // TODO: Send reset email with token
    res.json({ success: true, data: { message: 'If an account exists, a reset email has been sent.' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// PUT /api/auth/profile
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
  } catch (error) {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

export default router;
