import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
  adminResetPasswordSchema,
  createPetSchema,
  updatePetSchema,
  createProductSchema,
  updateProductSchema,
  createContentSchema,
  updateContentSchema,
  createSettingSchema,
  createFeatureFlagSchema,
  createTagSchema,
  updateTagSchema,
} from '../middleware/schemas';
import {
  User,
  Pet,
  Tag,
  Order,
  Product,
  FinderScan,
  LocationEvent,
  SiteContent,
  Setting,
  FeatureFlag,
  AuditLog,
  generatePetId,
} from '@pawtag/db';
import { hashPassword } from '../services/auth.service';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// --- Dashboard Stats ---
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get dashboard statistics
 *     description: 'Returns key metrics: total users, pets, tags, orders, revenue, lost pets, recent scans.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/dashboard', requirePermission('dashboard.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const [totalUsers, totalPets, totalTags, totalOrders, lostPets, recentScans] =
      await Promise.all([
        User.countDocuments(),
        Pet.countDocuments(),
        Tag.countDocuments(),
        Order.countDocuments(),
        Pet.countDocuments({ status: 'lost' }),
        FinderScan.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
      ]);

    const revenue = await Order.aggregate([
      { $match: { 'payment.status': 'completed' } },
      { $group: { _id: null, total: { $sum: '$payment.amount' } } },
    ]);

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'fullName email');

    res.json({
      success: true,
      data: {
        totalUsers,
        totalPets,
        totalTags,
        totalOrders,
        totalRevenue: revenue[0]?.total || 0,
        lostPets,
        recentScans,
        recentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

// --- Comprehensive Lost/Found Statistics ---
router.get('/stats/lost-found', requirePermission('stats.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalPets,
      totalLost,
      totalFound,
      totalSafe,
      lostLast30d,
      lostLast7d,
      foundByFinder,
      foundByOwner,
      avgTimeToFind,
      petsWithMultipleLosses,
      topLostPetTypes,
      lostByDayOfWeek,
      currentlyWaiting,
      ownersWithHighScore,
    ] = await Promise.all([
      Pet.countDocuments({ deletedAt: null }),
      Pet.countDocuments({ status: 'lost', deletedAt: null }),
      Pet.countDocuments({ status: 'found', deletedAt: null }),
      Pet.countDocuments({ status: 'safe', deletedAt: null }),
      Pet.countDocuments({ lostCount: { $gte: 1 }, updatedAt: { $gte: thirtyDaysAgo }, deletedAt: null }),
      Pet.countDocuments({ lostCount: { $gte: 1 }, updatedAt: { $gte: sevenDaysAgo }, deletedAt: null }),
      Pet.countDocuments({ foundByFinderAt: { $ne: null }, deletedAt: null }),
      Pet.countDocuments({ status: 'safe', lostCount: { $gte: 1 }, foundByFinderAt: null, deletedAt: null }),
      Pet.aggregate([
        { $match: { foundByFinderAt: { $ne: null }, status: 'safe', deletedAt: null } },
        {
          $project: {
            diff: { $subtract: ['$foundByFinderAt', '$updatedAt'] },
          },
        },
        { $group: { _id: null, avg: { $avg: '$diff' } } },
      ]),
      Pet.countDocuments({ lostCount: { $gte: 2 }, deletedAt: null }),
      Pet.aggregate([
        { $match: { lostCount: { $gte: 1 }, deletedAt: null } },
        { $group: { _id: '$petType', count: { $sum: 1 }, totalLost: { $sum: '$lostCount' } } },
        { $sort: { totalLost: -1 } },
        { $limit: 10 },
      ]),
      Pet.aggregate([
        { $match: { lostCount: { $gte: 1 }, deletedAt: null } },
        {
          $project: {
            dayOfWeek: { $dayOfWeek: '$createdAt' },
          },
        },
        { $group: { _id: '$dayOfWeek', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Pet.countDocuments({ status: 'found', foundByFinderAt: { $ne: null }, deletedAt: null }),
      User.countDocuments({ responsibilityScore: { $gte: 5 }, deletedAt: null }),
    ]);

    const avgHours = avgTimeToFind[0]?.avg
      ? Math.round(avgTimeToFind[0].avg / (1000 * 60 * 60))
      : 0;

    // Owner responsibility distribution
    const responsibilityDistribution = await User.aggregate([
      { $match: { role: 'customer', deletedAt: null } },
      {
        $bucket: {
          groupBy: '$responsibilityScore',
          boundaries: [0, 1, 3, 5, 10, 100],
          default: '10+',
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    // Monthly lost/found trend (last 6 months)
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const monthlyTrend = await Pet.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, deletedAt: null } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: 1 },
          lost: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
          foundByFinder: { $sum: { $cond: [{ $ne: ['$foundByFinderAt', null] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalPets,
          totalLost,
          totalFound,
          totalSafe,
          foundByFinder,
          foundByOwner,
          lostLast30d,
          lostLast7d,
          currentlyWaiting: currentlyWaiting,
          petsWithMultipleLosses,
          ownersWithHighScore,
        },
        performance: {
          avgTimeToFindHours: avgHours,
          finderReuniteRate: totalPets > 0 ? Math.round((foundByFinder / Math.max(totalLost + foundByFinder + totalSafe, 1)) * 100) : 0,
        },
        breakdown: {
          topLostPetTypes,
          lostByDayOfWeek,
          responsibilityDistribution,
          monthlyTrend,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load statistics' });
  }
});

// --- User Management ---
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get all users with pagination and filtering
 *     description: Returns a paginated list of users with optional search, role, and status filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by fullName or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by user role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by user status
 *     responses:
 *       200:
 *         description: Paginated list of users
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/users', requirePermission('user.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;
    const query: any = { deletedAt: null };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) query.role = role;
    if (status) query.status = status;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: users, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get a user by ID
 *     description: Returns a single user by their ID without the password hash.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 */
router.get('/users/:id', requirePermission('user.read'), async (req, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deletedAt: null }).select('-passwordHash');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     tags: [Admin - Users]
 *     summary: Update a user's role
 *     description: Updates the role of a user and logs the change in the audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 description: New user role
 *             required:
 *               - role
 *     responses:
 *       200:
 *         description: Updated user
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 */
router.put('/users/:id/role', requirePermission('user.assign_role'), validate(updateUserRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deletedAt: null });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const oldRole = user.role;
    user.role = req.body.role as any;
    await user.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update_role',
      entity: 'User',
      entityId: req.params.id,
      changes: { role: { old: oldRole, new: req.body.role } },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     tags: [Admin - Users]
 *     summary: Update a user's status
 *     description: Updates the status of a user and logs the change in the audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: New user status
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Updated user
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 */
router.put('/users/:id/status', requirePermission('user.update'), validate(updateUserStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deletedAt: null });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const oldStatus = user.status;
    user.status = req.body.status as any;
    await user.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update_status',
      entity: 'User',
      entityId: req.params.id,
      changes: { status: { old: oldStatus, new: req.body.status } },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', requirePermission('user.reset_password'), validate(adminResetPasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deletedAt: null });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    user.passwordHash = await hashPassword(req.body.newPassword);
    await user.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'reset_password',
      entity: 'User',
      entityId: req.params.id,
      changes: { note: 'Admin reset password' },
    });

    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// PUT /api/admin/users/:id/lock
router.put('/users/:id/lock', requirePermission('user.deactivate'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deletedAt: null });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const oldStatus = user.status;
    user.status = 'suspended';
    await user.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'lock_account',
      entity: 'User',
      entityId: req.params.id,
      changes: { status: { old: oldStatus, new: 'suspended' } },
    });

    res.json({ success: true, data: { message: 'Account locked' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to lock account' });
  }
});

// PUT /api/admin/users/:id/unlock
router.put('/users/:id/unlock', requirePermission('user.activate'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deletedAt: null });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const oldStatus = user.status;
    user.status = 'active';
    await user.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'unlock_account',
      entity: 'User',
      entityId: req.params.id,
      changes: { status: { old: oldStatus, new: 'active' } },
    });

    res.json({ success: true, data: { message: 'Account unlocked' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to unlock account' });
  }
});

// DELETE /api/admin/users/:id (soft delete)
router.delete('/users/:id', requirePermission('user.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deletedAt: null });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    user.deletedAt = new Date();
    await user.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'soft_delete',
      entity: 'User',
      entityId: req.params.id,
      changes: { email: user.email, name: user.fullName, note: 'Soft deleted' },
    });

    res.json({ success: true, data: { message: 'User deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// --- Admin: Register Owner on Behalf ---
/**
 * @swagger
 * /api/admin/owners/register:
 *   post:
 *     tags: [Admin - Users]
 *     summary: Register a new owner on behalf of a customer
 *     description: Admin creates an owner account for customers who cannot do it themselves (e.g. elderly owners).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Owner created successfully
 *       400:
 *         description: Email already exists
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.post('/owners/register', requirePermission('user.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;
    if (!email || !password || !fullName || !phoneNumber) {
      res.status(400).json({ success: false, error: 'email, password, fullName, and phoneNumber are required' });
      return;
    }
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phoneNumber }], deletedAt: null });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email or phone already registered' });
      return;
    }
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      phoneNumber,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      phoneVerified: false,
    });

    await AuditLog.create({
      userId: req.user!.id,
      action: 'create',
      entity: 'User',
      entityId: user._id.toString(),
      changes: { email, fullName, role: 'customer', note: 'Admin registered owner on behalf' },
    });

    const { passwordHash: _, ...safeUser } = user.toObject();
    res.status(201).json({ success: true, data: safeUser });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to register owner' });
  }
});

// --- Admin: Create Pet for Any Owner ---
/**
 * @swagger
 * /api/admin/pets:
 *   post:
 *     tags: [Admin - Pets]
 *     summary: Create a pet for any owner (admin god-mode)
 *     description: Admin creates a pet record on behalf of an owner.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePetInput'
 *     responses:
 *       201:
 *         description: Pet created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.post('/pets', requirePermission('pet.create'), async (req: AuthRequest, res: Response) => {
  try {
    // Admin creates pet for any owner — ownerId is required
    const { ownerId, ...petData } = req.body;
    if (!ownerId) {
      res.status(400).json({ success: false, error: 'ownerId is required' });
      return;
    }
    const owner = await User.findById(ownerId);
    if (!owner) {
      res.status(400).json({ success: false, error: 'Owner not found' });
      return;
    }
    // Validate pet data (skip ownerId)
    const parsed = createPetSchema.safeParse(petData);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      res.status(400).json({ success: false, error: 'Validation failed', details: errors });
      return;
    }
    const petId = await generatePetId(
      parsed.data.name,
      parsed.data.gender || 'unknown',
      parsed.data.breed,
      parsed.data.color,
    );
    const pet = await Pet.create({ ...parsed.data, ownerId, petId });

    await AuditLog.create({
      userId: req.user!.id,
      action: 'create',
      entity: 'Pet',
      entityId: pet._id.toString(),
      changes: { name: pet.name, petType: pet.petType, ownerId },
    });

    res.status(201).json({ success: true, data: pet });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create pet' });
  }
});

// --- Admin: Update Any Pet ---
/**
 * @swagger
 * /api/admin/pets/{id}:
 *   put:
 *     tags: [Admin - Pets]
 *     summary: Update any pet (admin god-mode)
 *     description: Admin can update any pet record including name, breed, photos, status, etc.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pet ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePetInput'
 *     responses:
 *       200:
 *         description: Pet updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Pet not found
 */
router.put('/pets/:id', requirePermission('pet.update'), validate(updatePetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    Object.assign(pet, req.body);
    await pet.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update',
      entity: 'Pet',
      entityId: pet._id.toString(),
      changes: req.body,
    });

    res.json({ success: true, data: pet });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update pet' });
  }
});

// --- Admin: Delete Any Pet ---
/**
 * @swagger
 * /api/admin/pets/{id}:
 *   delete:
 *     tags: [Admin - Pets]
 *     summary: Delete any pet (admin god-mode)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pet deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Pet not found
 */
router.delete('/pets/:id', requirePermission('pet.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    pet.deletedAt = new Date();
    await pet.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'soft_delete',
      entity: 'Pet',
      entityId: req.params.id,
      changes: { name: pet.name, petId: pet.petId, ownerId: pet.ownerId.toString(), note: 'Soft deleted' },
    });

    res.json({ success: true, data: { message: 'Pet deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete pet' });
  }
});

// --- Pet Management ---
/**
 * @swagger
 * /api/admin/pets:
 *   get:
 *     tags: [Admin - Pets]
 *     summary: Get all pets with advanced filtering
 *     description: Returns a paginated list of pets with filtering by type, breed, color, pattern, status, and owner info.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: petType
 *         schema:
 *           type: string
 *           enum: [Dog, Cat, Rabbit, Hamster, Guinea Pig, Bird]
 *         description: Filter by pet type
 *       - in: query
 *         name: petName
 *         schema:
 *           type: string
 *         description: Filter by pet name (partial match)
 *       - in: query
 *         name: petBreed
 *         schema:
 *           type: string
 *         description: Filter by pet breed (partial match)
 *       - in: query
 *         name: petColor
 *         schema:
 *           type: string
 *         description: Filter by pet color (partial match)
 *       - in: query
 *         name: petPattern
 *         schema:
 *           type: string
 *         description: Filter by pet pattern (partial match)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [safe, lost, found]
 *         description: Filter by pet status
 *       - in: query
 *         name: ownerName
 *         schema:
 *           type: string
 *         description: Filter by owner name (partial match)
 *       - in: query
 *         name: ownerEmail
 *         schema:
 *           type: string
 *         description: Filter by owner email (partial match)
 *       - in: query
 *         name: ownerPhone
 *         schema:
 *           type: string
 *         description: Filter by owner phone (partial match)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: General search across pet name and breed
 *     responses:
 *       200:
 *         description: Paginated list of pets
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/pets', requirePermission('pet.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status, petType, petName, petBreed, petColor, petPattern, ownerName, ownerEmail, ownerPhone } = req.query;
    const query: any = { deletedAt: null };

    // Pet-level filters
    if (petType) query.petType = petType;
    if (petName) query.name = { $regex: petName, $options: 'i' };
    if (petBreed) query.breed = { $regex: petBreed, $options: 'i' };
    if (petColor) query.color = { $regex: petColor, $options: 'i' };
    if (petPattern) query.pattern = { $regex: petPattern, $options: 'i' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { breed: { $regex: search, $options: 'i' } },
        { petId: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;

    // Owner-level filters — look up matching user IDs first
    const ownerFilters: any = { deletedAt: null };
    if (ownerName) {
      ownerFilters.fullName = { $regex: ownerName, $options: 'i' };
    }
    if (ownerEmail) {
      ownerFilters.email = { $regex: ownerEmail, $options: 'i' };
    }
    if (ownerPhone) {
      ownerFilters.phoneNumber = { $regex: ownerPhone, $options: 'i' };
    }

    if (Object.keys(ownerFilters).length > 1) {
      const matchingUsers = await User.find(ownerFilters).select('_id');
      const userIds = matchingUsers.map((u) => u._id);
      query.ownerId = { $in: userIds };
    }

    const total = await Pet.countDocuments(query);
    const pets = await Pet.find(query)
      .populate('ownerId', 'fullName email phoneNumber')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Attach linked tag info for each pet
    const petIds = pets.map((p) => p._id);
    const tags = await Tag.find({ petId: { $in: petIds }, deletedAt: null }).select('tagId petId status');
    const tagMap = new Map(tags.map((t) => [t.petId.toString(), t]));
    const petsWithTag = pets.map((pet) => ({
      ...pet.toObject(),
      linkedTag: tagMap.get(pet._id.toString()) || null,
    }));

    res.json({
      success: true,
      data: { items: petsWithTag, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch pets' });
  }
});

/**
 * @swagger
 * /api/admin/pets/{id}/status:
 *   put:
 *     tags: [Admin - Pets]
 *     summary: Update a pet's status
 *     description: Updates the status of a pet and logs the change in the audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pet ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: New pet status
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Updated pet
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Pet not found
 */
router.put('/pets/:id/status', requirePermission('pet.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update_pet_status',
      entity: 'Pet',
      entityId: req.params.id,
      changes: { status: { old: 'unknown', new: req.body.status } },
    });

    res.json({ success: true, data: pet });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update pet status' });
  }
});

/**
 * @swagger
 * /api/admin/pets/{id}:
 *   delete:
 *     tags: [Admin - Pets]
 *     summary: Delete a pet
 *     description: Deletes a pet by ID and logs the action in the audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pet ID
 *     responses:
 *       200:
 *         description: Pet deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Pet not found
 */
router.delete('/pets/:id', requirePermission('pet.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'delete',
      entity: 'Pet',
      entityId: req.params.id,
    });

    res.json({ success: true, data: { message: 'Pet deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete pet' });
  }
});

// --- Tag Management ---
/**
 * @swagger
 * /api/admin/tags:
 *   get:
 *     tags: [Admin - Tags]
 *     summary: Get all tags with pagination and filtering
 *     description: Returns a paginated list of tags with optional search and status filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by tagId
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by tag status
 *     responses:
 *       200:
 *         description: Paginated list of tags
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/tags', requirePermission('tag.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query: any = { deletedAt: null };
    if (search) query.tagId = { $regex: search, $options: 'i' };
    if (status) query.status = status;

    const total = await Tag.countDocuments(query);
    const tags = await Tag.find(query)
      .populate('petId', 'name petId petType breed color status')
      .populate('ownerId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: tags, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

// --- Tag CRUD ---

function generateTagId(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `PT-${digits}`;
}

/**
 * @swagger
 * /api/admin/tags:
 *   post:
 *     tags: [Admin - Tags]
 *     summary: Create a new tag and link it to a pet
 *     description: Creates a tag. Enforces one-tag-per-pet rule. tagId is auto-generated if not provided.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [petId, ownerId]
 *             properties:
 *               petId:
 *                 type: string
 *               ownerId:
 *                 type: string
 *               tagId:
 *                 type: string
 *                 description: "Format: PT-NNNNNN. Auto-generated if omitted."
 *               status:
 *                 type: string
 *                 enum: [active, inactive, lost]
 *     responses:
 *       201:
 *         description: Tag created
 *       400:
 *         description: Validation error or pet already has a tag
 */
router.post('/tags', requirePermission('tag.create'), validate(createTagSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { petId, ownerId, tagId: customTagId, status } = req.body;

    const pet = await Pet.findOne({ _id: petId, deletedAt: null });
    if (!pet) { res.status(400).json({ success: false, error: 'Pet not found' }); return; }

    const owner = await User.findOne({ _id: ownerId, deletedAt: null });
    if (!owner) { res.status(400).json({ success: false, error: 'Owner not found' }); return; }

    const existingTag = await Tag.findOne({ petId, deletedAt: null });
    if (existingTag) {
      res.status(400).json({ success: false, error: `This pet already has a tag (${existingTag.tagId}). Each pet can only have one tag.` });
      return;
    }

    let tagId = customTagId;
    if (!tagId) {
      let attempts = 0;
      do { tagId = generateTagId(); attempts++; } while (await Tag.findOne({ tagId }) && attempts < 10);
    } else {
      if (!/^PT-\d{6}$/.test(tagId)) { res.status(400).json({ success: false, error: 'Tag ID must be in format PT-NNNNNN' }); return; }
      if (await Tag.findOne({ tagId })) { res.status(400).json({ success: false, error: 'Tag ID already exists' }); return; }
    }

    const tag = await Tag.create({ tagId, petId, ownerId, status: status || 'active' });
    const populated = await Tag.findById(tag._id)
      .populate('petId', 'name petId petType breed color')
      .populate('ownerId', 'fullName email');

    await AuditLog.create({ userId: req.user!.id, action: 'create', entity: 'Tag', entityId: tag._id.toString(), changes: { tagId, petId, ownerId } });
    res.status(201).json({ success: true, data: populated });
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to create tag' }); }
});

/**
 * @swagger
 * /api/admin/tags/{id}:
 *   get:
 *     tags: [Admin - Tags]
 *     summary: Get a single tag by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tag details
 *       404:
 *         description: Tag not found
 */
router.get('/tags/:id', requirePermission('tag.read'), async (req: AuthRequest, res: Response) => {
  try {
    const tag = await Tag.findOne({ _id: req.params.id, deletedAt: null })
      .populate('petId', 'name petId petType breed color pattern photos photoUrl status')
      .populate('ownerId', 'fullName email phoneNumber');
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }
    res.json({ success: true, data: tag });
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to fetch tag' }); }
});

/**
 * @swagger
 * /api/admin/tags/{id}:
 *   put:
 *     tags: [Admin - Tags]
 *     summary: Update a tag (admin god-mode)
 *     description: Admin can change pet link, owner, or status. Enforces one-tag-per-pet when changing petId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               petId:
 *                 type: string
 *               ownerId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, lost]
 *     responses:
 *       200:
 *         description: Tag updated
 *       400:
 *         description: Validation error or pet already has a tag
 *       404:
 *         description: Tag not found
 */
router.put('/tags/:id', requirePermission('tag.update'), validate(updateTagSchema), async (req: AuthRequest, res: Response) => {
  try {
    const tag = await Tag.findOne({ _id: req.params.id, deletedAt: null });
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }

    if (req.body.petId && req.body.petId !== tag.petId.toString()) {
      const newPet = await Pet.findOne({ _id: req.body.petId, deletedAt: null });
      if (!newPet) { res.status(400).json({ success: false, error: 'Pet not found' }); return; }
      const existingTagOnNewPet = await Tag.findOne({ petId: req.body.petId, _id: { $ne: tag._id }, deletedAt: null });
      if (existingTagOnNewPet) {
        res.status(400).json({ success: false, error: `Pet already has a tag (${existingTagOnNewPet.tagId}). Each pet can only have one tag.` });
        return;
      }
    }

    const oldValues: any = {};
    const newValues: any = {};
    for (const key of ['petId', 'ownerId', 'status']) {
      if (req.body[key] !== undefined) {
        oldValues[key] = tag.get(key);
        newValues[key] = req.body[key];
      }
    }

    Object.assign(tag, req.body);
    await tag.save();
    const updated = await Tag.findById(tag._id)
      .populate('petId', 'name petId petType breed color')
      .populate('ownerId', 'fullName email');

    await AuditLog.create({ userId: req.user!.id, action: 'update', entity: 'Tag', entityId: tag._id.toString(), changes: { old: oldValues, new: newValues } });
    res.json({ success: true, data: updated });
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to update tag' }); }
});

/**
 * @swagger
 * /api/admin/tags/{id}:
 *   delete:
 *     tags: [Admin - Tags]
 *     summary: Delete a tag
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tag deleted
 *       404:
 *         description: Tag not found
 */
router.delete('/tags/:id', requirePermission('tag.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const tag = await Tag.findOne({ _id: req.params.id, deletedAt: null });
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }

    tag.deletedAt = new Date();
    await tag.save();

    await AuditLog.create({ userId: req.user!.id, action: 'soft_delete', entity: 'Tag', entityId: req.params.id, changes: { tagId: tag.tagId, note: 'Soft deleted' } });
    res.json({ success: true, data: { message: 'Tag deleted' } });
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to delete tag' }); }
});

// --- QR Code Generation ---

const FINDER_BASE_URL = process.env.FINDER_URL || 'http://localhost:3003';

/**
 * @swagger
 * /api/admin/tags/{id}/qr:
 *   get:
 *     tags: [Admin - Tags]
 *     summary: Generate QR code image for a tag
 *     description: 'Returns a PNG image of the QR code. The QR encodes the finder URL (e.g. http://localhost:3003/PT-123456).'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 300
 *         description: Image size in pixels
 *     responses:
 *       200:
 *         description: QR code PNG image
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Tag not found
 */
router.get('/tags/:id/qr', requirePermission('tag.generate_qr'), async (req: AuthRequest, res: Response) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }

    const size = Math.min(Math.max(Number(req.query.size) || 300, 100), 1000);
    const url = `${FINDER_BASE_URL}/${tag.tagId}`;
    const qrBuffer = await QRCode.toBuffer(url, { width: size, margin: 2, color: { dark: '#000000', light: '#ffffff' } });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${tag.tagId}.png"`);
    res.send(qrBuffer);
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to generate QR code' }); }
});

/**
 * @swagger
 * /api/admin/tags/{id}/sticker:
 *   get:
 *     tags: [Admin - Tags]
 *     summary: Generate a printable sticker page for a tag
 *     description: Returns an HTML page with QR code, tagId, petId, and petName — ready for printing as a sticker.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sticker HTML page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Tag not found
 */
router.get('/tags/:id/sticker', requirePermission('tag.generate_sticker'), async (req: AuthRequest, res: Response) => {
  try {
    const tag = await Tag.findById(req.params.id)
      .populate('petId', 'name petId petType breed color')
      .populate('ownerId', 'fullName');
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }

    const pet = tag.petId as any;
    const url = `${FINDER_BASE_URL}/${tag.tagId}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 250, margin: 1, color: { dark: '#000000', light: '#ffffff' } });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PawTag Sticker - ${tag.tagId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
    .sticker { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; width: 320px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .qr { margin: 12px auto; }
    .qr img { width: 200px; height: 200px; }
    .tag-id { font-size: 22px; font-weight: 700; color: #111; font-family: monospace; letter-spacing: 1px; margin: 8px 0 4px; }
    .pet-name { font-size: 18px; font-weight: 600; color: #374151; margin: 4px 0; }
    .pet-id { font-size: 13px; color: #6b7280; font-family: monospace; }
    .pet-details { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    .branding { font-size: 10px; color: #d1d5db; margin-top: 12px; border-top: 1px solid #f3f4f6; padding-top: 8px; }
    .scan-hint { font-size: 11px; color: #9ca3af; margin-top: 8px; }
    @media print {
      body { background: white; }
      .sticker { border: 1px solid #ccc; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="sticker">
    <img src="${qrDataUrl}" alt="QR Code" class="qr" />
    <div class="tag-id">${tag.tagId}</div>
    <div class="pet-name">${pet.name}</div>
    <div class="pet-id">${pet.petId || ''}</div>
    <div class="pet-details">${pet.petType || ''} &middot; ${pet.breed || ''} &middot; ${pet.color || ''}</div>
    <div class="scan-hint">Scan to view pet info</div>
    <div class="branding">PawTag &mdash; Reuniting lost pets with their families</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to generate sticker' }); }
});

/**
 * @swagger
 * /api/admin/tags/qr-bulk:
 *   post:
 *     tags: [Admin - Tags]
 *     summary: Generate QR codes for multiple tags at once
 *     description: Returns an HTML page with all QR stickers in a grid, ready for printing.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of tag Mongo IDs to generate QR codes for
 *     responses:
 *       200:
 *         description: HTML page with all QR stickers
 */
router.post('/tags/qr-bulk', requirePermission('tag.generate_qr'), async (req: AuthRequest, res: Response) => {
  try {
    const { tagIds } = req.body;
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      res.status(400).json({ success: false, error: 'tagIds array is required' });
      return;
    }

    const tags = await Tag.find({ _id: { $in: tagIds } })
      .populate('petId', 'name petId petType breed color');

    const stickers = await Promise.all(tags.map(async (tag) => {
      const pet = tag.petId as any;
      const url = `${FINDER_BASE_URL}/${tag.tagId}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1 });
      return { tag, pet, qrDataUrl };
    }));

    const stickerCards = stickers.map(({ tag, pet, qrDataUrl }) => `
      <div class="sticker">
        <img src="${qrDataUrl}" alt="QR" class="qr" />
        <div class="tag-id">${tag.tagId}</div>
        <div class="pet-name">${pet?.name || 'Unknown'}</div>
        <div class="pet-id">${pet?.petId || ''}</div>
        <div class="pet-details">${pet?.petType || ''} &middot; ${pet?.breed || ''} &middot; ${pet?.color || ''}</div>
      </div>
    `).join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PawTag QR Stickers (${stickers.length})</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
    h1 { font-size: 18px; color: #374151; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .sticker { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
    .qr { margin: 8px auto; }
    .qr img { width: 180px; height: 180px; }
    .tag-id { font-size: 20px; font-weight: 700; color: #111; font-family: monospace; letter-spacing: 1px; margin: 6px 0 4px; }
    .pet-name { font-size: 16px; font-weight: 600; color: #374151; }
    .pet-id { font-size: 12px; color: #6b7280; font-family: monospace; }
    .pet-details { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    @media print { body { padding: 0; } .grid { gap: 12px; } }
  </style>
</head>
<body>
  <h1>PawTag QR Stickers (${stickers.length} tags)</h1>
  <div class="grid">${stickerCards}</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to generate bulk QR codes' }); }
});

// --- Product Management ---
/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     tags: [Admin - Products]
 *     summary: Get all products with pagination and filtering
 *     description: Returns a paginated list of products with optional search, category, and active status filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or SKU
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *         description: Filter by active status (true/false)
 *     responses:
 *       200:
 *         description: Paginated list of products
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/products', requirePermission('product.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, category, isActive } = req.query;
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: products, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

/**
 * @swagger
 * /api/admin/products/{id}:
 *   get:
 *     tags: [Admin - Products]
 *     summary: Get a product by ID
 *     description: Returns a single product by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Product not found
 */
router.get('/products/:id', requirePermission('product.read'), async (req, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return; }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

/**
 * @swagger
 * /api/admin/products:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Create a new product
 *     description: Creates a new product and logs the action in the audit log.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               sku:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *             required:
 *               - name
 *               - sku
 *               - price
 *     responses:
 *       201:
 *         description: Product created
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.post('/products', requirePermission('product.create'), validate(createProductSchema), async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.create(req.body);

    await AuditLog.create({
      userId: req.user!.id,
      action: 'create',
      entity: 'Product',
      entityId: product._id.toString(),
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

/**
 * @swagger
 * /api/admin/products/{id}:
 *   put:
 *     tags: [Admin - Products]
 *     summary: Update a product
 *     description: Updates a product by ID and logs the action in the audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               sku:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated product
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Product not found
 */
router.put('/products/:id', requirePermission('product.update'), validate(updateProductSchema), async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update',
      entity: 'Product',
      entityId: req.params.id,
    });

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

/**
 * @swagger
 * /api/admin/products/{id}:
 *   delete:
 *     tags: [Admin - Products]
 *     summary: Delete a product
 *     description: Deletes a product by ID and logs the action in the audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Product not found
 */
router.delete('/products/:id', requirePermission('product.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'delete',
      entity: 'Product',
      entityId: req.params.id,
    });

    res.json({ success: true, data: { message: 'Product deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// --- Order Management ---
/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     tags: [Admin - Orders]
 *     summary: Get all orders with pagination and filtering
 *     description: Returns a paginated list of orders with optional status and search filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by order number
 *     responses:
 *       200:
 *         description: Paginated list of orders
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/orders', requirePermission('order.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (search) query.orderNumber = { $regex: search, $options: 'i' };

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: orders, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

/**
 * @swagger
 * /api/admin/orders/{id}/status:
 *   put:
 *     tags: [Admin - Orders]
 *     summary: Update an order's status
 *     description: Updates the status of an order and logs the change in the audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: New order status
 *               trackingNumber:
 *                 type: string
 *                 description: Optional tracking number
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Updated order
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Order not found
 */
router.put('/orders/:id/status', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, trackingNumber } = req.body;
    const update: any = { status };
    if (trackingNumber) update.trackingNumber = trackingNumber;

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update_order_status',
      entity: 'Order',
      entityId: req.params.id,
      changes: { status: { old: 'unknown', new: status } },
    });

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
});

// --- Site Content Management ---
/**
 * @swagger
 * /api/admin/content:
 *   get:
 *     tags: [Admin - Content]
 *     summary: Get all site content with filtering
 *     description: Returns a list of site content with optional status and search filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by content status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by title or slug
 *     responses:
 *       200:
 *         description: List of site content
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/content', requirePermission('content.read'), async (req, res: Response) => {
  try {
    const { status, search } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const content = await SiteContent.find(query)
      .populate('createdBy', 'fullName')
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch content' });
  }
});

/**
 * @swagger
 * /api/admin/content/{id}:
 *   get:
 *     tags: [Admin - Content]
 *     summary: Get site content by ID
 *     description: Returns a single site content document by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Content details
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Content not found
 */
router.get('/content/:id', requirePermission('content.read'), async (req, res: Response) => {
  try {
    const content = await SiteContent.findById(req.params.id);
    if (!content) { res.status(404).json({ success: false, error: 'Content not found' }); return; }
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch content' });
  }
});

/**
 * @swagger
 * /api/admin/content:
 *   post:
 *     tags: [Admin - Content]
 *     summary: Create new site content
 *     description: Creates a new site content document with the creator's user ID.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               body:
 *                 type: string
 *               status:
 *                 type: string
 *             required:
 *               - title
 *               - slug
 *     responses:
 *       201:
 *         description: Content created
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.post('/content', requirePermission('content.create'), validate(createContentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const content = await SiteContent.create({ ...req.body, createdBy: req.user!.id });
    res.status(201).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create content' });
  }
});

/**
 * @swagger
 * /api/admin/content/{id}:
 *   put:
 *     tags: [Admin - Content]
 *     summary: Update site content
 *     description: Updates a site content document by ID. Auto-sets publishedAt when status changes to published.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               body:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated content
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Content not found
 */
router.put('/content/:id', requirePermission('content.update'), validate(updateContentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const update = { ...req.body };
    if (update.status === 'published' && !update.publishedAt) {
      update.publishedAt = new Date();
    }
    const content = await SiteContent.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!content) { res.status(404).json({ success: false, error: 'Content not found' }); return; }
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update content' });
  }
});

/**
 * @swagger
 * /api/admin/content/{id}:
 *   delete:
 *     tags: [Admin - Content]
 *     summary: Delete site content
 *     description: Deletes a site content document by ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Content deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.delete('/content/:id', requirePermission('content.delete'), async (req: AuthRequest, res: Response) => {
  try {
    await SiteContent.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: { message: 'Content deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete content' });
  }
});

// --- Settings Management ---
/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     tags: [Admin - Settings]
 *     summary: Get all settings with optional category filter
 *     description: Returns a list of system settings, optionally filtered by category.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by setting category
 *     responses:
 *       200:
 *         description: List of settings
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/settings', requirePermission('setting.read'), async (req, res: Response) => {
  try {
    const { category } = req.query;
    const query: any = {};
    if (category) query.category = category;

    const settings = await Setting.find(query).sort({ category: 1, key: 1 });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

/**
 * @swagger
 * /api/admin/settings/{key}:
 *   put:
 *     tags: [Admin - Settings]
 *     summary: Update a setting by key
 *     description: Updates an existing setting's value by its key.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Setting key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 type: string
 *                 description: New setting value
 *             required:
 *               - value
 *     responses:
 *       200:
 *         description: Updated setting
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Setting not found
 */
router.put('/settings/:key', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { value: req.body.value, updatedBy: req.user!.id },
      { new: true },
    );
    if (!setting) { res.status(404).json({ success: false, error: 'Setting not found' }); return; }
    res.json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update setting' });
  }
});

/**
 * @swagger
 * /api/admin/settings:
 *   post:
 *     tags: [Admin - Settings]
 *     summary: Create a new setting
 *     description: Creates a new system setting.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *             required:
 *               - key
 *               - value
 *     responses:
 *       201:
 *         description: Setting created
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.post('/settings', requirePermission('setting.create'), validate(createSettingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const setting = await Setting.create({ ...req.body, updatedBy: req.user!.id });
    res.status(201).json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create setting' });
  }
});

// --- Feature Flags ---
/**
 * @swagger
 * /api/admin/feature-flags:
 *   get:
 *     tags: [Admin - Feature Flags]
 *     summary: Get all feature flags
 *     description: Returns a list of all feature flags sorted by key.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of feature flags
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/feature-flags', requirePermission('feature_flag.read'), async (_req, res: Response) => {
  try {
    const flags = await FeatureFlag.find().sort({ key: 1 });
    res.json({ success: true, data: flags });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch feature flags' });
  }
});

/**
 * @swagger
 * /api/admin/feature-flags:
 *   post:
 *     tags: [Admin - Feature Flags]
 *     summary: Create a new feature flag
 *     description: Creates a new feature flag.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               description:
 *                 type: string
 *             required:
 *               - key
 *     responses:
 *       201:
 *         description: Feature flag created
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.post('/feature-flags', requirePermission('feature_flag.create'), validate(createFeatureFlagSchema), async (req: AuthRequest, res: Response) => {
  try {
    const flag = await FeatureFlag.create(req.body);
    res.status(201).json({ success: true, data: flag });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create feature flag' });
  }
});

/**
 * @swagger
 * /api/admin/feature-flags/{key}:
 *   put:
 *     tags: [Admin - Feature Flags]
 *     summary: Update a feature flag by key
 *     description: Updates an existing feature flag by its key.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Feature flag key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated feature flag
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Feature flag not found
 */
router.put('/feature-flags/:key', requirePermission('feature_flag.update'), async (req: AuthRequest, res: Response) => {
  try {
    const flag = await FeatureFlag.findOneAndUpdate({ key: req.params.key }, req.body, { new: true });
    if (!flag) { res.status(404).json({ success: false, error: 'Feature flag not found' }); return; }
    res.json({ success: true, data: flag });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update feature flag' });
  }
});

/**
 * @swagger
 * /api/admin/feature-flags/{key}:
 *   delete:
 *     tags: [Admin - Feature Flags]
 *     summary: Delete a feature flag by key
 *     description: Deletes a feature flag by its key.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Feature flag key
 *     responses:
 *       200:
 *         description: Feature flag deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.delete('/feature-flags/:key', requirePermission('feature_flag.delete'), async (req: AuthRequest, res: Response) => {
  try {
    await FeatureFlag.findOneAndDelete({ key: req.params.key });
    res.json({ success: true, data: { message: 'Feature flag deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete feature flag' });
  }
});

// --- Audit Logs ---
/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     tags: [Admin - Audit Logs]
 *     summary: Get all audit logs with pagination and filtering
 *     description: Returns a paginated list of audit logs with optional entity and user filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: entity
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: Paginated list of audit logs
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/audit-logs', requirePermission('audit_log.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 50, entity, userId } = req.query;
    const query: any = {};
    if (entity) query.entity = entity;
    if (userId) query.userId = userId;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: logs, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// --- Finder Scans ---
/**
 * @swagger
 * /api/admin/finder-scans:
 *   get:
 *     tags: [Admin - Finder Scans]
 *     summary: Get all finder scans with pagination
 *     description: Returns a paginated list of all finder scan events.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Paginated list of finder scans
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/finder-scans', requirePermission('finder_scan.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const total = await FinderScan.countDocuments();
    const scans = await FinderScan.find()
      .populate('tagId', 'tagId')
      .populate('petId', 'name species breed')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: scans, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch finder scans' });
  }
});

// --- Location Events ---
/**
 * @swagger
 * /api/admin/location-events:
 *   get:
 *     tags: [Admin - Location Events]
 *     summary: Get all location events with pagination and filtering
 *     description: Returns a paginated list of location events with optional pet filter.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: petId
 *         schema:
 *           type: string
 *         description: Filter by pet ID
 *     responses:
 *       200:
 *         description: Paginated list of location events
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/location-events', requirePermission('location_event.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 50, petId } = req.query;
    const query: any = {};
    if (petId) query.petId = petId;

    const total = await LocationEvent.countDocuments(query);
    const events = await LocationEvent.find(query)
      .populate('petId', 'name')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: events, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch location events' });
  }
});

export default router;
