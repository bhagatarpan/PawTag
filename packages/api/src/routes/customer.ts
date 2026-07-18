import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createPetSchema, updatePetSchema } from '../middleware/schemas';
import { Pet, Tag, Order, LocationEvent, Notification, generatePetId } from '@pawtag/db';

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
router.get('/pets', async (req: AuthRequest, res: Response) => {
  try {
    const pets = await Pet.find({ ownerId: req.user!.id }).sort({ createdAt: -1 });
    // Attach linked tag info (read-only) for each pet
    const petIds = pets.map((p) => p._id);
    const tags = await Tag.find({ petId: { $in: petIds } }).select('tagId petId status');
    const tagMap = new Map(tags.map((t) => [t.petId.toString(), t]));
    const petsWithTag = pets.map((pet) => ({
      ...pet.toObject(),
      linkedTag: tagMap.get(pet._id.toString()) || null,
    }));
    res.json({ success: true, data: petsWithTag });
  } catch (error) {
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
router.get('/pets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet });
  } catch (error) {
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
router.post('/pets', validate(createPetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const petId = await generatePetId(
      req.body.name,
      req.body.gender || 'unknown',
      req.body.breed,
      req.body.color,
    );
    const pet = await Pet.create({ ...req.body, ownerId: req.user!.id, petId });
    res.status(201).json({ success: true, data: pet });
  } catch (error) {
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
router.put('/pets/:id', validate(updatePetSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Owner cannot change pet name — only admin can
    const { name, ...updateData } = req.body;
    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user!.id },
      updateData,
      { new: true, runValidators: true },
    );
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet });
  } catch (error) {
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
router.delete('/pets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOneAndDelete({ _id: req.params.id, ownerId: req.user!.id });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: { message: 'Pet deleted' } });
  } catch (error) {
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
router.get('/tags', async (req: AuthRequest, res: Response) => {
  try {
    const tags = await Tag.find({ ownerId: req.user!.id })
      .populate('petId', 'name petType species breed secondaryBreed color pattern photos photoUrl status')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tags });
  } catch (error) {
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
router.post('/pets/:id/mark-lost', async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user!.id },
      { status: 'lost' },
      { new: true },
    );
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    // Update associated tags
    await Tag.updateMany({ petId: pet._id }, { status: 'lost' });

    res.json({ success: true, data: pet });
  } catch (error) {
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
router.post('/pets/:id/mark-found', async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user!.id },
      { status: 'safe' },
      { new: true },
    );
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    await Tag.updateMany({ petId: pet._id }, { status: 'active' });

    res.json({ success: true, data: pet });
  } catch (error) {
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
router.get('/pets/:id/locations', async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }

    const locations = await LocationEvent.find({ petId: pet._id }).sort({ timestamp: -1 });
    res.json({ success: true, data: locations });
  } catch (error) {
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
router.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
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
router.get('/orders/:id', async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch (error) {
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
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: notifications });
  } catch (error) {
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
router.put('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { read: true },
    );
    res.json({ success: true, data: { message: 'Notification marked as read' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

export default router;
