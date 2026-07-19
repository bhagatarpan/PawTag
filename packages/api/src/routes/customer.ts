import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { createPetSchema, updatePetSchema } from '../middleware/schemas';
import { Pet, Tag, Order, LocationEvent, Notification, FinderScan, User, generatePetId } from '@pawtag/db';

const router = Router();
router.use(authenticate);

// --- My Pets ---
/**
 * @swagger
 * /api/customer/pets:
 *   get:
 *     summary: List my pets
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's pets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Pet'
 *       500:
 *         description: Failed to fetch pets
 */
router.get('/pets', requirePermission('pet.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pets = await Pet.find({ ownerId: req.user!.id, deletedAt: null }).sort({ createdAt: -1 });
    const petIds = pets.map((p) => p._id);
    const tags = await Tag.find({ petId: { $in: petIds }, deletedAt: null }).select('tagId petId status');
    const tagMap = new Map(tags.map((t) => [t.petId.toString(), t]));
    const petsWithTag = pets.map((pet) => ({
      ...pet.toObject(),
      linkedTag: tagMap.get(pet._id.toString()) || null,
    }));
    res.json({ success: true, data: petsWithTag });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch pets' });
  }
});

/**
 * @swagger
 * /api/customer/pets/{id}:
 *   get:
 *     summary: Get a specific pet by ID
 *     tags: [Customer]
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
 *         description: Pet details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Pet'
 *       404:
 *         description: Pet not found
 *       500:
 *         description: Failed to fetch pet
 */
router.get('/pets/:id', requirePermission('pet.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch pet' });
  }
});

/**
 * @swagger
 * /api/customer/pets:
 *   post:
 *     summary: Create a new pet
 *     tags: [Customer]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Pet'
 *       500:
 *         description: Failed to create pet
 */
router.post('/pets', requirePermission('pet.create'), validate(createPetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const petId = await generatePetId(
      req.body.name,
      req.body.gender || 'unknown',
      req.body.breed,
      req.body.color,
    );
    const pet = await Pet.create({ ...req.body, ownerId: req.user!.id, petId });
    res.status(201).json({ success: true, data: pet });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create pet' });
  }
});

/**
 * @swagger
 * /api/customer/pets/{id}:
 *   put:
 *     summary: Update an existing pet
 *     tags: [Customer]
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
 *             $ref: '#/components/schemas/UpdatePetInput'
 *     responses:
 *       200:
 *         description: Pet updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Pet'
 *       404:
 *         description: Pet not found
 *       500:
 *         description: Failed to update pet
 */
router.put('/pets/:id', requirePermission('pet.update'), validate(updatePetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name: _name, ...updateData } = req.body;
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    Object.assign(pet, updateData);
    await pet.save();
    res.json({ success: true, data: pet });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update pet' });
  }
});

/**
 * @swagger
 * /api/customer/pets/{id}:
 *   delete:
 *     summary: Delete a pet
 *     tags: [Customer]
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
 *         description: Pet deleted successfully
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
 *                     message:
 *                       type: string
 *       404:
 *         description: Pet not found
 *       500:
 *         description: Failed to delete pet
 */
router.delete('/pets/:id', requirePermission('pet.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    pet.deletedAt = new Date();
    await pet.save();

    res.json({ success: true, data: { message: 'Pet deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete pet' });
  }
});

// --- My Tags ---
/**
 * @swagger
 * /api/customer/tags:
 *   get:
 *     summary: List my tags
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's tags with populated pet info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *       500:
 *         description: Failed to fetch tags
 */
router.get('/tags', requirePermission('tag.read'), async (req: AuthRequest, res: Response) => {
  try {
    const tags = await Tag.find({ ownerId: req.user!.id, deletedAt: null })
      .populate('petId', 'name petType species breed secondaryBreed color pattern photos photoUrl status')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tags });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

// --- Mark Pet Lost/Found ---
/**
 * @swagger
 * /api/customer/pets/{id}/mark-lost:
 *   post:
 *     summary: Mark a pet as lost
 *     tags: [Customer]
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
 *         description: Pet marked as lost, associated tags updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Pet'
 *       404:
 *         description: Pet not found
 *       500:
 *         description: Failed to mark pet as lost
 */
router.post('/pets/:id/mark-lost', requirePermission('pet.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    pet.status = 'lost';
    pet.lostCount = (pet.lostCount || 0) + 1;
    pet.foundByFinderAt = undefined;
    await pet.save();

    // Update owner responsibility score
    const allPets = await Pet.find({ ownerId: req.user!.id, deletedAt: null }).select('lostCount');
    const totalLostCount = allPets.reduce((sum, p) => sum + (p.lostCount || 0), 0);
    await User.findByIdAndUpdate(req.user!.id, { responsibilityScore: totalLostCount });

    await Tag.updateMany({ petId: pet._id, deletedAt: null }, { status: 'lost' });

    res.json({ success: true, data: pet });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to mark pet as lost' });
  }
});

/**
 * @swagger
 * /api/customer/pets/{id}/mark-found:
 *   post:
 *     summary: Mark a pet as found (safe)
 *     tags: [Customer]
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
 *         description: Pet marked as safe, associated tags reactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Pet'
 *       404:
 *         description: Pet not found
 *       500:
 *         description: Failed to mark pet as found
 */
router.post('/pets/:id/mark-found', requirePermission('pet.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    // Calculate time-to-found if pet was found by finder
    let timeToFoundMs: number | null = null;
    if (pet.foundByFinderAt) {
      timeToFoundMs = Date.now() - new Date(pet.foundByFinderAt).getTime();
    }

    pet.status = 'safe';
    pet.foundByFinderAt = undefined;
    await pet.save();

    // Auto-mark related finder notifications as read
    await Notification.updateMany(
      { userId: req.user!.id, 'data.petId': pet._id.toString(), type: { $in: ['pet_found', 'finder_reminder'] } },
      { read: true },
    );

    // Update owner responsibility score
    const allPets = await Pet.find({ ownerId: req.user!.id, deletedAt: null }).select('lostCount');
    const totalLostCount = allPets.reduce((sum, p) => sum + (p.lostCount || 0), 0);
    await User.findByIdAndUpdate(req.user!.id, { responsibilityScore: totalLostCount });

    await Tag.updateMany({ petId: pet._id, deletedAt: null }, { status: 'active' });

    res.json({ success: true, data: { ...pet.toObject(), timeToFoundMs } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to mark pet as found' });
  }
});

// --- Location History ---
/**
 * @swagger
 * /api/customer/pets/{id}/locations:
 *   get:
 *     summary: Get location history for a pet
 *     tags: [Customer]
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
 *         description: Location history for the pet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LocationEvent'
 *       404:
 *         description: Pet not found
 *       500:
 *         description: Failed to fetch locations
 */
router.get('/pets/:id/locations', requirePermission('pet.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    const locations = await LocationEvent.find({ petId: pet._id }).sort({ timestamp: -1 });
    res.json({ success: true, data: locations });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch locations' });
  }
});

// --- Orders ---
/**
 * @swagger
 * /api/customer/orders:
 *   get:
 *     summary: List my orders
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       500:
 *         description: Failed to fetch orders
 */
router.get('/orders', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

/**
 * @swagger
 * /api/customer/orders/{id}:
 *   get:
 *     summary: Get a specific order by ID
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 *       500:
 *         description: Failed to fetch order
 */
router.get('/orders/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// --- Notifications ---
/**
 * @swagger
 * /api/customer/notifications:
 *   get:
 *     summary: List my notifications
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's notifications (max 50)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *       500:
 *         description: Failed to fetch notifications
 */
router.get('/notifications', requirePermission('notification.read'), async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: notifications });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

/**
 * @swagger
 * /api/customer/notifications/{id}/read:
 *   put:
 *     summary: Mark a notification as read
 *     tags: [Customer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
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
 *                     message:
 *                       type: string
 *       500:
 *         description: Failed to update notification
 */
router.put('/notifications/:id/read', requirePermission('notification.update'), async (req: AuthRequest, res: Response) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { read: true },
    );
    res.json({ success: true, data: { message: 'Notification marked as read' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

// --- Found Timer ---
router.get('/pets/:id/found-timer', requirePermission('pet.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    if (pet.status !== 'found' || !pet.foundByFinderAt) {
      res.json({ success: true, data: { active: false } });
      return;
    }

    const scan = await FinderScan.findOne({ petId: pet._id, action: 'notified_owner' })
      .sort({ notifiedAt: -1 });

    res.json({
      success: true,
      data: {
        active: true,
        foundAt: pet.foundByFinderAt,
        elapsed: Date.now() - new Date(pet.foundByFinderAt).getTime(),
        finderPhone: scan?.finderPhone || null,
        finderEmail: scan?.finderEmail || null,
        finderName: scan?.finderName || null,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch found timer' });
  }
});

// --- Owner Responsibility Score ---
router.get('/responsibility', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('responsibilityScore fullName');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const pets = await Pet.find({ ownerId: req.user!.id, deletedAt: null }).select('name petId lostCount status');
    const totalLostCount = pets.reduce((sum, p) => sum + (p.lostCount || 0), 0);

    let rating: string;
    let color: string;
    if (totalLostCount === 0) { rating = 'Super Awesome Parent'; color = 'green'; }
    else if (totalLostCount <= 2) { rating = 'Good Parent'; color = 'amber'; }
    else if (totalLostCount <= 4) { rating = 'Needs Improvement'; color = 'orange'; }
    else { rating = 'At Risk'; color = 'red'; }

    res.json({
      success: true,
      data: {
        score: totalLostCount,
        rating,
        color,
        pets: pets.map((p) => ({
          name: p.name,
          petId: p.petId,
          lostCount: p.lostCount || 0,
          status: p.status,
        })),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch responsibility score' });
  }
});

// --- Mark Pet as Terminal (deceased/stolen/transferred/donated/sold) ---
router.post('/pets/:id/mark-terminal', requirePermission('pet.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason || !['deceased', 'stolen', 'transferred', 'donated', 'sold'].includes(reason)) {
      res.status(400).json({ success: false, error: 'Reason must be "deceased", "stolen", "transferred", "donated", or "sold"' });
      return;
    }

    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id, deletedAt: null });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    pet.status = reason as any;
    pet.foundByFinderAt = undefined;
    await pet.save();

    // Auto-mark related finder notifications as read
    await Notification.updateMany(
      { userId: req.user!.id, 'data.petId': pet._id.toString(), type: { $in: ['pet_found', 'finder_reminder'] } },
      { read: true },
    );

    await Tag.updateMany({ petId: pet._id, deletedAt: null }, { status: 'inactive' });

    res.json({ success: true, data: pet });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update pet status' });
  }
});

// --- Clear Read Notifications ---
router.delete('/notifications/clear-read', requirePermission('notification.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user!.id, read: true });
    res.json({ success: true, data: { deletedCount: result.deletedCount } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to clear notifications' });
  }
});

// --- Mark All Notifications Read ---
router.put('/notifications/mark-all-read', requirePermission('notification.update'), async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany({ userId: req.user!.id, read: false }, { read: true });
    res.json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to mark notifications' });
  }
});

// --- Unread Notification Count ---
router.get('/notifications/unread-count', requirePermission('notification.read'), async (req: AuthRequest, res: Response) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user!.id, read: false });
    res.json({ success: true, data: { count } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

// ============================================================
// HEALTH RECORDS
// ============================================================

// Helper: verify pet ownership
async function getOwnedPet(petId: string, userId: string) {
  return Pet.findOne({ _id: petId, ownerId: userId, deletedAt: null });
}

// --- Vaccinations ---
router.get('/pets/:id/vaccinations', requirePermission('vaccination.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.vaccinations || [] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch vaccinations' });
  }
});

router.post('/pets/:id/vaccinations', requirePermission('vaccination.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.vaccinations.push(req.body);
    await pet.save();
    res.status(201).json({ success: true, data: pet.vaccinations[pet.vaccinations.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add vaccination' });
  }
});

router.put('/pets/:id/vaccinations/:vaxId', requirePermission('vaccination.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const vax = (pet.vaccinations as any).id(req.params.vaxId);
    if (!vax) { res.status(404).json({ success: false, error: 'Vaccination not found' }); return; }
    Object.assign(vax, req.body);
    await pet.save();
    res.json({ success: true, data: vax });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update vaccination' });
  }
});

router.delete('/pets/:id/vaccinations/:vaxId', requirePermission('vaccination.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const vax = (pet.vaccinations as any).id(req.params.vaxId);
    if (!vax) { res.status(404).json({ success: false, error: 'Vaccination not found' }); return; }
    vax.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Vaccination deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete vaccination' });
  }
});

// --- Microchips ---
router.get('/pets/:id/microchips', requirePermission('microchip.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.microchips || [] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch microchips' });
  }
});

router.post('/pets/:id/microchips', requirePermission('microchip.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.microchips.push(req.body);
    await pet.save();
    res.status(201).json({ success: true, data: pet.microchips[pet.microchips.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add microchip' });
  }
});

router.put('/pets/:id/microchips/:chipId', requirePermission('microchip.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const chip = (pet.microchips as any).id(req.params.chipId);
    if (!chip) { res.status(404).json({ success: false, error: 'Microchip not found' }); return; }
    Object.assign(chip, req.body);
    await pet.save();
    res.json({ success: true, data: chip });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update microchip' });
  }
});

router.delete('/pets/:id/microchips/:chipId', requirePermission('microchip.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const chip = (pet.microchips as any).id(req.params.chipId);
    if (!chip) { res.status(404).json({ success: false, error: 'Microchip not found' }); return; }
    chip.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Microchip deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete microchip' });
  }
});

// --- Medications ---
router.get('/pets/:id/medications', requirePermission('medication.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.medications || [] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch medications' });
  }
});

router.post('/pets/:id/medications', requirePermission('medication.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.medications.push(req.body);
    await pet.save();
    res.status(201).json({ success: true, data: pet.medications[pet.medications.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add medication' });
  }
});

router.put('/pets/:id/medications/:medId', requirePermission('medication.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const med = (pet.medications as any).id(req.params.medId);
    if (!med) { res.status(404).json({ success: false, error: 'Medication not found' }); return; }
    Object.assign(med, req.body);
    await pet.save();
    res.json({ success: true, data: med });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update medication' });
  }
});

router.delete('/pets/:id/medications/:medId', requirePermission('medication.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const med = (pet.medications as any).id(req.params.medId);
    if (!med) { res.status(404).json({ success: false, error: 'Medication not found' }); return; }
    med.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Medication deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete medication' });
  }
});

// --- Allergies ---
router.get('/pets/:id/allergies', requirePermission('allergy.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.allergies || [] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch allergies' });
  }
});

router.post('/pets/:id/allergies', requirePermission('allergy.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.allergies.push(req.body);
    await pet.save();
    res.status(201).json({ success: true, data: pet.allergies[pet.allergies.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add allergy' });
  }
});

router.put('/pets/:id/allergies/:allergyId', requirePermission('allergy.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const allergy = (pet.allergies as any).id(req.params.allergyId);
    if (!allergy) { res.status(404).json({ success: false, error: 'Allergy not found' }); return; }
    Object.assign(allergy, req.body);
    await pet.save();
    res.json({ success: true, data: allergy });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update allergy' });
  }
});

router.delete('/pets/:id/allergies/:allergyId', requirePermission('allergy.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const allergy = (pet.allergies as any).id(req.params.allergyId);
    if (!allergy) { res.status(404).json({ success: false, error: 'Allergy not found' }); return; }
    allergy.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Allergy deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete allergy' });
  }
});

// --- Vet Details ---
router.get('/pets/:id/vet-details', requirePermission('vet_visit.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.vetDetails || [] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch vet details' });
  }
});

router.post('/pets/:id/vet-details', requirePermission('vet_visit.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    if (req.body.isPrimary) {
      for (const vd of pet.vetDetails) { vd.isPrimary = false; }
    }
    pet.vetDetails.push(req.body);
    await pet.save();
    res.status(201).json({ success: true, data: pet.vetDetails[pet.vetDetails.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add vet detail' });
  }
});

router.put('/pets/:id/vet-details/:vetId', requirePermission('vet_visit.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const vet = (pet.vetDetails as any).id(req.params.vetId);
    if (!vet) { res.status(404).json({ success: false, error: 'Vet detail not found' }); return; }
    if (req.body.isPrimary) {
      for (const vd of pet.vetDetails) { vd.isPrimary = false; }
    }
    Object.assign(vet, req.body);
    await pet.save();
    res.json({ success: true, data: vet });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update vet detail' });
  }
});

router.delete('/pets/:id/vet-details/:vetId', requirePermission('vet_visit.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const vet = (pet.vetDetails as any).id(req.params.vetId);
    if (!vet) { res.status(404).json({ success: false, error: 'Vet detail not found' }); return; }
    vet.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Vet detail deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete vet detail' });
  }
});

// --- Surgeries ---
router.get('/pets/:id/surgeries', requirePermission('surgery.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.surgeries || [] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch surgeries' });
  }
});

router.post('/pets/:id/surgeries', requirePermission('surgery.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.surgeries.push(req.body);
    await pet.save();
    res.status(201).json({ success: true, data: pet.surgeries[pet.surgeries.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add surgery' });
  }
});

router.put('/pets/:id/surgeries/:surgId', requirePermission('surgery.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const surg = (pet.surgeries as any).id(req.params.surgId);
    if (!surg) { res.status(404).json({ success: false, error: 'Surgery not found' }); return; }
    Object.assign(surg, req.body);
    await pet.save();
    res.json({ success: true, data: surg });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update surgery' });
  }
});

router.delete('/pets/:id/surgeries/:surgId', requirePermission('surgery.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const surg = (pet.surgeries as any).id(req.params.surgId);
    if (!surg) { res.status(404).json({ success: false, error: 'Surgery not found' }); return; }
    surg.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Surgery deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete surgery' });
  }
});

// --- Weight History ---
router.get('/pets/:id/weight-history', requirePermission('weight.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: (pet.weightHistory || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch weight history' });
  }
});

router.post('/pets/:id/weight-history', requirePermission('weight.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.weightHistory.push(req.body);
    pet.weight = req.body.weight;
    await pet.save();
    res.status(201).json({ success: true, data: pet.weightHistory[pet.weightHistory.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add weight record' });
  }
});

router.delete('/pets/:id/weight-history/:wid', requirePermission('weight.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const rec = (pet.weightHistory as any).id(req.params.wid);
    if (!rec) { res.status(404).json({ success: false, error: 'Weight record not found' }); return; }
    rec.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Weight record deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete weight record' });
  }
});

// --- Health Conditions ---
router.get('/pets/:id/health-conditions', requirePermission('medical_record.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.healthConditions || [] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch health conditions' });
  }
});

router.post('/pets/:id/health-conditions', requirePermission('medical_record.create'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.healthConditions.push(req.body);
    await pet.save();
    res.status(201).json({ success: true, data: pet.healthConditions[pet.healthConditions.length - 1] });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add health condition' });
  }
});

router.put('/pets/:id/health-conditions/:condId', requirePermission('medical_record.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const cond = (pet.healthConditions as any).id(req.params.condId);
    if (!cond) { res.status(404).json({ success: false, error: 'Health condition not found' }); return; }
    Object.assign(cond, req.body);
    await pet.save();
    res.json({ success: true, data: cond });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update health condition' });
  }
});

router.delete('/pets/:id/health-conditions/:condId', requirePermission('medical_record.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    const cond = (pet.healthConditions as any).id(req.params.condId);
    if (!cond) { res.status(404).json({ success: false, error: 'Health condition not found' }); return; }
    cond.deleteOne();
    await pet.save();
    res.json({ success: true, data: { message: 'Health condition deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete health condition' });
  }
});

// --- Desexing ---
router.get('/pets/:id/desexing', requirePermission('desexing.read'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet.desexing || { isDesexed: false } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch desexing info' });
  }
});

router.put('/pets/:id/desexing', requirePermission('desexing.update'), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await getOwnedPet(req.params.id, req.user!.id);
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    pet.desexing = req.body;
    await pet.save();
    res.json({ success: true, data: pet.desexing });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update desexing info' });
  }
});

export default router;
