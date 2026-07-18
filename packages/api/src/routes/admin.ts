import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
  createPetSchema,
  updatePetSchema,
  createProductSchema,
  updateProductSchema,
  createContentSchema,
  updateContentSchema,
  createSettingSchema,
  createFeatureFlagSchema,
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
} from '@pawtag/db';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('super_admin', 'admin', 'support'));

// --- Dashboard Stats ---
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get dashboard statistics
 *     description: Returns key metrics: total users, pets, tags, orders, revenue, lost pets, recent scans.
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
router.get('/dashboard', async (_req: AuthRequest, res: Response) => {
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
router.get('/users', async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;
    const query: any = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
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
router.get('/users/:id', async (req, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
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
router.put('/users/:id/role', validate(updateUserRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('-passwordHash');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update_role',
      entity: 'User',
      entityId: req.params.id,
      changes: { role: { old: 'unknown', new: req.body.role } },
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
router.put('/users/:id/status', validate(updateUserStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).select('-passwordHash');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update_status',
      entity: 'User',
      entityId: req.params.id,
      changes: { status: { old: 'unknown', new: req.body.status } },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
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
router.post('/owners/register', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;
    if (!email || !password || !fullName) {
      res.status(400).json({ success: false, error: 'email, password, and fullName are required' });
      return;
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already registered' });
      return;
    }
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      phoneNumber: phoneNumber || '',
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
router.post('/pets', async (req: AuthRequest, res: Response) => {
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
    const pet = await Pet.create({ ...parsed.data, ownerId });

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
router.put('/pets/:id', validate(updatePetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

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
router.delete('/pets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    await AuditLog.create({
      userId: req.user!.id,
      action: 'delete',
      entity: 'Pet',
      entityId: req.params.id,
      changes: { name: pet.name, ownerId: pet.ownerId.toString() },
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
router.get('/pets', async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status, petType, petName, petBreed, petColor, petPattern, ownerName, ownerEmail, ownerPhone } = req.query;
    const query: any = {};

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
      ];
    }
    if (status) query.status = status;

    // Owner-level filters — look up matching user IDs first
    const ownerFilters: any = {};
    if (ownerName) {
      ownerFilters.fullName = { $regex: ownerName, $options: 'i' };
    }
    if (ownerEmail) {
      ownerFilters.email = { $regex: ownerEmail, $options: 'i' };
    }
    if (ownerPhone) {
      ownerFilters.phoneNumber = { $regex: ownerPhone, $options: 'i' };
    }

    if (Object.keys(ownerFilters).length > 0) {
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

    res.json({
      success: true,
      data: { items: pets, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
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
router.put('/pets/:id/status', async (req: AuthRequest, res: Response) => {
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
router.delete('/pets/:id', async (req: AuthRequest, res: Response) => {
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
router.get('/tags', async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query: any = {};
    if (search) query.tagId = { $regex: search, $options: 'i' };
    if (status) query.status = status;

    const total = await Tag.countDocuments(query);
    const tags = await Tag.find(query)
      .populate('petId', 'name species breed')
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
router.get('/products', async (req, res: Response) => {
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
router.get('/products/:id', async (req, res: Response) => {
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
router.post('/products', validate(createProductSchema), async (req: AuthRequest, res: Response) => {
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
router.put('/products/:id', validate(updateProductSchema), async (req: AuthRequest, res: Response) => {
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
router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
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
router.get('/orders', async (req, res: Response) => {
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
router.put('/orders/:id/status', async (req: AuthRequest, res: Response) => {
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
router.get('/content', async (req, res: Response) => {
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
router.get('/content/:id', async (req, res: Response) => {
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
router.post('/content', validate(createContentSchema), async (req: AuthRequest, res: Response) => {
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
router.put('/content/:id', validate(updateContentSchema), async (req: AuthRequest, res: Response) => {
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
router.delete('/content/:id', async (req: AuthRequest, res: Response) => {
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
router.get('/settings', async (req, res: Response) => {
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
router.put('/settings/:key', async (req: AuthRequest, res: Response) => {
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
router.post('/settings', validate(createSettingSchema), async (req: AuthRequest, res: Response) => {
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
router.get('/feature-flags', async (_req, res: Response) => {
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
router.post('/feature-flags', validate(createFeatureFlagSchema), async (req: AuthRequest, res: Response) => {
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
router.put('/feature-flags/:key', async (req: AuthRequest, res: Response) => {
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
router.delete('/feature-flags/:key', async (req: AuthRequest, res: Response) => {
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
router.get('/audit-logs', async (req, res: Response) => {
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
router.get('/finder-scans', async (req, res: Response) => {
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
router.get('/location-events', async (req, res: Response) => {
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
