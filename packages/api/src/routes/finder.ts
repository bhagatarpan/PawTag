import { Router, Request, Response } from 'express';
import { Tag, FinderScan, LocationEvent } from '@pawtag/db';

const router = Router();

// No auth required — this is the public finder portal

// GET /api/finder/:tagId — Get pet info by tag ID
router.get('/:tagId', async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findOne({ tagId: req.params.tagId })
      .populate({ path: 'petId', select: '-__v' })
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
          species: pet.species,
          breed: pet.breed,
          color: pet.color,
          photoUrl: pet.photoUrl,
          medicalAlerts: pet.medicalAlerts,
          status: pet.status,
        },
        tagId: tag.tagId,
        ownerName: owner.fullName,
        ownerPhone: owner.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load pet info' });
  }
});

// POST /api/finder/:tagId/notify — Notify owner that pet was found
router.post('/:tagId/notify', async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findOne({ tagId: req.params.tagId });
    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    const scan = await FinderScan.findOne({ tagId: tag._id }).sort({ createdAt: -1 });
    if (scan) {
      scan.action = 'notified_owner';
      scan.notifiedAt = new Date();
      scan.contactAttempted = true;
      await scan.save();
    }

    // TODO: Send notification to owner (email, push, SMS)

    res.json({ success: true, data: { message: 'Owner has been notified' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to notify owner' });
  }
});

// POST /api/finder/:tagId/share-location — Finder shares their GPS location
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

// GET /api/finder/public/products — Public product listing (for shop)
router.get('/shop/products', async (_req: Request, res: Response) => {
  try {
    const { Product } = require('@pawtag/db');
    const products = await Product.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /api/finder/public/content/:slug — Public page content
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
