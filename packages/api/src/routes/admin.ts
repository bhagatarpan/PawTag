import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validation';
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
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

router.get('/users/:id', async (req, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

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

// --- Pet Management ---
router.get('/pets', async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status, ownerId } = req.query;
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { breed: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;
    if (ownerId) query.ownerId = ownerId;

    const total = await Pet.countDocuments(query);
    const pets = await Pet.find(query)
      .populate('ownerId', 'fullName email')
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

router.get('/products/:id', async (req, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return; }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

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

router.get('/content/:id', async (req, res: Response) => {
  try {
    const content = await SiteContent.findById(req.params.id);
    if (!content) { res.status(404).json({ success: false, error: 'Content not found' }); return; }
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch content' });
  }
});

router.post('/content', validate(createContentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const content = await SiteContent.create({ ...req.body, createdBy: req.user!.id });
    res.status(201).json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create content' });
  }
});

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

router.delete('/content/:id', async (req: AuthRequest, res: Response) => {
  try {
    await SiteContent.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: { message: 'Content deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete content' });
  }
});

// --- Settings Management ---
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

router.post('/settings', validate(createSettingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const setting = await Setting.create({ ...req.body, updatedBy: req.user!.id });
    res.status(201).json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create setting' });
  }
});

// --- Feature Flags ---
router.get('/feature-flags', async (_req, res: Response) => {
  try {
    const flags = await FeatureFlag.find().sort({ key: 1 });
    res.json({ success: true, data: flags });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch feature flags' });
  }
});

router.post('/feature-flags', validate(createFeatureFlagSchema), async (req: AuthRequest, res: Response) => {
  try {
    const flag = await FeatureFlag.create(req.body);
    res.status(201).json({ success: true, data: flag });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create feature flag' });
  }
});

router.put('/feature-flags/:key', async (req: AuthRequest, res: Response) => {
  try {
    const flag = await FeatureFlag.findOneAndUpdate({ key: req.params.key }, req.body, { new: true });
    if (!flag) { res.status(404).json({ success: false, error: 'Feature flag not found' }); return; }
    res.json({ success: true, data: flag });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update feature flag' });
  }
});

router.delete('/feature-flags/:key', async (req: AuthRequest, res: Response) => {
  try {
    await FeatureFlag.findOneAndDelete({ key: req.params.key });
    res.json({ success: true, data: { message: 'Feature flag deleted' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete feature flag' });
  }
});

// --- Audit Logs ---
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
