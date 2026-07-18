import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createPetSchema, updatePetSchema } from '../middleware/schemas';
import { Pet, Tag, Order, LocationEvent, Notification } from '@pawtag/db';

const router = Router();
router.use(authenticate);

// --- My Pets ---
router.get('/pets', async (req: AuthRequest, res: Response) => {
  try {
    const pets = await Pet.find({ ownerId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: pets });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch pets' });
  }
});

router.get('/pets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch pet' });
  }
});

router.post('/pets', validate(createPetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.create({ ...req.body, ownerId: req.user!.id });
    res.status(201).json({ success: true, data: pet });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create pet' });
  }
});

router.put('/pets/:id', validate(updatePetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user!.id },
      req.body,
      { new: true },
    );
    if (!pet) { res.status(404).json({ success: false, error: 'Pet not found' }); return; }
    res.json({ success: true, data: pet });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update pet' });
  }
});

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
router.get('/tags', async (req: AuthRequest, res: Response) => {
  try {
    const tags = await Tag.find({ ownerId: req.user!.id })
      .populate('petId', 'name species breed')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

// --- Mark Pet Lost/Found ---
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
router.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

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
