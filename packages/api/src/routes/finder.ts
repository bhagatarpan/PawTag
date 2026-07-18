import { Router, Request, Response } from 'express';
import { Tag, FinderScan, LocationEvent, Pet, Notification, User } from '@pawtag/db';

const router = Router();

// No auth required — this is the public finder portal

/**
 * @swagger
 * /api/finder/{tagId}:
 *   get:
 *     summary: Get pet info by tag ID
 *     tags: [Finder]
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *         description: The tag identifier
 *     responses:
 *       200:
 *         description: Pet and owner information
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
 *                     pet:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         species:
 *                           type: string
 *                         breed:
 *                           type: string
 *                         color:
 *                           type: string
 *                         photoUrl:
 *                           type: string
 *                         medicalAlerts:
 *                           type: string
 *                         status:
 *                           type: string
 *                     tagId:
 *                       type: string
 *                     ownerName:
 *                       type: string
 *                     ownerPhone:
 *                       type: string
 *       404:
 *         description: Tag not found
 *       500:
 *         description: Failed to load pet info
 */
router.get('/:tagId', async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findOne({ tagId: req.params.tagId, deletedAt: null })
      .populate({ path: 'petId', match: { deletedAt: null }, select: '-__v' })
      .populate({ path: 'ownerId', select: 'fullName phone' });

    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    const pet = tag.petId as any;
    const owner = tag.ownerId as any;

    // Log the scan
    await FinderScan.create({
      tagId: tag._id,
      petId: pet._id,
      deviceInfo: req.headers['user-agent'] || 'unknown',
      action: 'viewed',
    });

    // Update tag scan info
    tag.lastScannedAt = new Date();
    await tag.save();

    res.json({
      success: true,
      data: {
        pet: {
          name: pet.name,
          petId: pet.petId,
          species: pet.species,
          breed: pet.breed,
          secondaryBreed: pet.secondaryBreed,
          color: pet.color,
          pattern: pet.pattern,
          gender: pet.gender,
          age: pet.age,
          favouriteFood: pet.favouriteFood,
          photos: pet.photos,
          photoUrl: pet.photoUrl,
          medicalAlerts: pet.medicalAlerts,
          status: pet.status,
        },
        tagId: tag.tagId,
        tagStatus: tag.status,
        ownerName: owner.fullName,
        ownerPhone: owner.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load pet info' });
  }
});

/**
 * @swagger
 * /api/finder/{tagId}/notify:
 *   post:
 *     summary: Notify owner that pet was found
 *     tags: [Finder]
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *         description: The tag identifier
 *     responses:
 *       200:
 *         description: Owner has been notified
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
 *         description: Tag not found
 *       500:
 *         description: Failed to notify owner
 */
router.post('/:tagId/notify', async (req: Request, res: Response) => {
  try {
    const { finderPhone, finderEmail, finderName } = req.body;

    if (!finderPhone && !finderEmail) {
      res.status(400).json({ success: false, error: 'Please provide at least a phone number or email so the owner can contact you.' });
      return;
    }

    const tag = await Tag.findOne({ tagId: req.params.tagId, deletedAt: null })
      .populate({ path: 'petId', match: { deletedAt: null } })
      .populate({ path: 'ownerId', select: 'fullName email phone' });

    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    const pet = tag.petId as any;
    const owner = tag.ownerId as any;

    // Update scan record with finder contact details
    const scan = await FinderScan.findOne({ tagId: tag._id }).sort({ createdAt: -1 });
    if (scan) {
      scan.action = 'notified_owner';
      scan.notifiedAt = new Date();
      scan.contactAttempted = true;
      scan.finderPhone = finderPhone || undefined;
      scan.finderEmail = finderEmail || undefined;
      scan.finderName = finderName || undefined;
      await scan.save();
    }

    // Auto-mark pet as found
    if (pet && pet.status === 'lost') {
      pet.status = 'found';
      pet.foundByFinderAt = new Date();
      await pet.save();
      await Tag.updateMany({ petId: pet._id, deletedAt: null }, { status: 'active' });
    }

    // Build contact info string for notification
    const contactParts: string[] = [];
    if (finderName) contactParts.push(`Name: ${finderName}`);
    if (finderPhone) contactParts.push(`Phone: ${finderPhone}`);
    if (finderEmail) contactParts.push(`Email: ${finderEmail}`);
    const contactInfo = contactParts.join(' | ');

    // Create notification to owner
    if (owner) {
      await Notification.create({
        userId: owner._id,
        type: 'pet_found',
        title: `Your pet ${pet?.name || 'Unknown'} has been found!`,
        message: `A kind person found your pet ${pet?.name || ''} (${pet?.petId || ''}). They left their contact details so you can reach them. ${contactInfo}`,
        priority: 'high',
        data: {
          petId: pet?._id,
          petName: pet?.name,
          petPetId: pet?.petId,
          tagId: tag.tagId,
          finderPhone: finderPhone || null,
          finderEmail: finderEmail || null,
          finderName: finderName || null,
          foundAt: new Date().toISOString(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Owner has been notified successfully! Thank you for helping reunite this pet with its owner.',
        petFound: pet?.status === 'found',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to notify owner' });
  }
});

// --- Found Timer (public) ---
router.get('/:tagId/found-timer', async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findOne({ tagId: req.params.tagId, deletedAt: null })
      .populate({ path: 'petId', match: { deletedAt: null }, select: 'name petId status foundByFinderAt' });

    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }

    const pet = tag.petId as any;
    if (!pet || pet.status !== 'found' || !pet.foundByFinderAt) {
      res.json({ success: true, data: { active: false } });
      return;
    }

    const scan = await FinderScan.findOne({ petId: pet._id, action: 'notified_owner' }).sort({ notifiedAt: -1 });

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
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch found timer' });
  }
});

/**
 * @swagger
 * /api/finder/{tagId}/share-location:
 *   post:
 *     summary: Finder shares their GPS location with the pet owner
 *     tags: [Finder]
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *         description: The tag identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 format: double
 *                 description: GPS latitude coordinate
 *               longitude:
 *                 type: number
 *                 format: double
 *                 description: GPS longitude coordinate
 *     responses:
 *       200:
 *         description: Location shared with owner
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
 *       400:
 *         description: Location coordinates required
 *       404:
 *         description: Tag not found
 *       500:
 *         description: Failed to share location
 */
router.post('/:tagId/share-location', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      res.status(400).json({ success: false, error: 'Location coordinates required' });
      return;
    }

    const tag = await Tag.findOne({ tagId: req.params.tagId });
    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    // Save location event
    await LocationEvent.create({
      tagId: tag._id,
      petId: tag.petId,
      ownerId: tag.ownerId,
      timestamp: new Date(),
      location: { latitude, longitude, source: 'qr_scan' },
    });

    // Update tag last scan location
    tag.lastScanLocation = { latitude, longitude, source: 'qr_scan' };
    tag.lastScannedAt = new Date();
    await tag.save();

    // Update scan record
    const scan = await FinderScan.findOne({ tagId: tag._id }).sort({ createdAt: -1 });
    if (scan) {
      scan.location = { latitude, longitude };
      scan.action = 'shared_location';
      await scan.save();
    }

    res.json({ success: true, data: { message: 'Location shared with owner' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to share location' });
  }
});

/**
 * @swagger
 * /api/finder/shop/products:
 *   get:
 *     summary: List active products (public shop)
 *     tags: [Finder]
 *     responses:
 *       200:
 *         description: List of active products
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
 *                     $ref: '#/components/schemas/Product'
 *       500:
 *         description: Failed to fetch products
 */
router.get('/shop/products', async (_req: Request, res: Response) => {
  try {
    const { Product } = require('@pawtag/db');
    const products = await Product.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

/**
 * @swagger
 * /api/finder/content/{slug}:
 *   get:
 *     summary: Get published page content by slug
 *     tags: [Finder]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Content page slug
 *     responses:
 *       200:
 *         description: Published content page
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SiteContent'
 *       404:
 *         description: Page not found
 *       500:
 *         description: Failed to fetch content
 */
router.get('/content/:slug', async (req: Request, res: Response) => {
  try {
    const { SiteContent } = require('@pawtag/db');
    const content = await SiteContent.findOne({ slug: req.params.slug, status: 'published' });
    if (!content) {
      res.status(404).json({ success: false, error: 'Page not found' });
      return;
    }
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch content' });
  }
});

export default router;
