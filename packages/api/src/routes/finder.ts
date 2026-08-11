import { Router, Request, Response } from 'express';
import { Tag, FinderScan, LocationEvent, Notification, Subscription, User, Pet, SiteContent, Product, Setting, EscalationRecord } from '@pawtag/db';
import { sendPushToUser } from '../services/push-notification.service';
import { sendPetFoundEmail } from '../services/email.service';
import { auditService, type AuditContext } from '../services/audit';

const router = Router();

// No auth required — this is the public finder portal

async function auditFinderEvent(
  req: Request,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  // Fire and forget - don't await to prevent blocking response
  const logAudit = async () => {
    try {
      const reqContext = (req as any).auditContext as AuditContext;
      if (!reqContext) {
        // For public routes without audit middleware, create minimal context
        await auditService.log({
          actorType: 'FINDER',
          actorId: 'anonymous',
          sourceIp: req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 'unknown',
          userAgent: req.headers['user-agent']?.toString() || 'unknown',
          applicationName: 'pawtag-finder',
          applicationVersion: '1.0.0',
          apiVersion: 'v1',
          environment: process.env.NODE_ENV || 'development',
          ...overrides,
        }, input);
        return;
      }
      const context: AuditContext = {
        ...reqContext,
        actorType: 'FINDER',
        actorId: 'anonymous',
        ...overrides,
      } as AuditContext;
      await auditService.log(context, input);
    } catch (err) {
      // Log audit failure but don't break the response
      console.error('[Audit] Failed to log finder event:', err);
    }
  };
  
  // Fire and forget
  logAudit();
}

// --- Public stats (must be before /:tagId routes) ---
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [totalTags, activeTags, totalScans, totalUsers, totalPets, lostPets, foundPets] = await Promise.all([
      Tag.countDocuments({ deletedAt: null }),
      Tag.countDocuments({ status: 'active', deletedAt: null }),
      FinderScan.countDocuments(),
      User.countDocuments(),
      Pet.countDocuments({ deletedAt: null }),
      Pet.countDocuments({ status: 'lost', deletedAt: null }),
      Pet.countDocuments({ status: 'found', deletedAt: null }),
    ]);

    res.json({
      success: true,
      data: {
        petsProtected: totalPets,
        tagsSold: totalTags,
        activeTags,
        totalScans,
        reunions: foundPets,
        lostPets,
        registeredUsers: totalUsers,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

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
      .populate({ path: 'ownerId', select: 'fullName phone showOwnerNameInFinder address' });

    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    const pet = tag.petId as any;
    const owner = tag.ownerId as any;

    // Check subscription status
    const isActiveForFinder = !tag.subscriptionStatus ||
      tag.subscriptionStatus === 'active' ||
      tag.subscriptionStatus === 'grace_period' ||
      tag.subscriptionStatus === 'none';

    if (!isActiveForFinder) {
      // Tag subscription expired — still log the scan but return limited info
      await FinderScan.create({
        tagId: tag._id,
        petId: pet?._id || tag._id,
        deviceInfo: req.headers['user-agent'] || 'unknown',
        action: 'viewed',
      });

      await auditFinderEvent(req, {
        action: 'view_expired_tag',
        eventType: 'finder_view_expired',
        eventCategory: 'READ',
        operationType: 'READ',
        resourceType: 'Tag',
        resourceId: tag._id.toString(),
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: {
          tagId: tag.tagId,
          subscriptionStatus: tag.subscriptionStatus,
          message: 'This PawTag is no longer active. The owner needs to renew their subscription.',
          petInfo: null,
        },
      });

      res.json({
        success: true,
        data: {
          tagActive: false,
          subscriptionStatus: tag.subscriptionStatus,
          message: 'This PawTag is no longer active. The owner needs to renew their subscription.',
          petInfo: null,
        },
      });
      return;
    }

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

    // Update subscription scan count if linked
    if (tag.subscriptionId) {
      await Subscription.findByIdAndUpdate(tag.subscriptionId, {
        lastScannedAt: new Date(),
        $inc: { totalScans: 1 },
      });
    }

    // Check admin CMS setting for finder name visibility
    const adminSetting = await Setting.findOne({ key: 'finder.showOwnerName' });
    const adminShowName = adminSetting?.value !== 'false'; // default true
    const ownerShowName = owner.showOwnerNameInFinder !== false; // default true
    const showOwnerName = adminShowName && ownerShowName;

    // Build owner info based on privacy settings
    let ownerName: string | null = null;
    let ownerLocation: string | null = null;
    if (showOwnerName) {
      ownerName = owner.fullName;
      if (owner.address?.city) {
        const parts = [owner.address.line2, owner.address.city].filter(Boolean);
        ownerLocation = parts.join(', ');
      }
    } else if (owner.address?.city) {
      const parts = [owner.address.line2, owner.address.city].filter(Boolean);
      ownerLocation = `located in ${parts.join(', ')}`;
    }

    res.json({
      success: true,
      data: {
        pet: {
          name: pet.name,
          petId: pet.petId,
          species: pet.species,
          breed: pet.breed,
          breedOrigin: pet.breedOrigin,
          secondaryBreed: pet.secondaryBreed,
          color: pet.color,
          pattern: pet.pattern,
          gender: pet.gender,
          age: pet.age,
          favouriteFood: pet.favouriteFood,
          photos: pet.photos,
          photoUrl: pet.photoUrl,
          medicalAlerts: pet.medicalAlerts,
          vaccinations: pet.vaccinations || [],
          microchips: pet.microchips || [],
          status: pet.status,
        },
        tagId: tag.tagId,
        tagStatus: tag.status,
        subscriptionStatus: tag.subscriptionStatus || 'none',
        ownerName,
        ownerLocation,
        ownerPhone: owner.phone,
      },
    });

    await auditFinderEvent(req, {
      action: 'view_pet_info',
      eventType: 'finder_view_pet',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'Tag',
      resourceId: tag._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        tagId: tag.tagId,
        petId: pet._id.toString(),
        petName: pet.name,
        petStatus: pet.status,
        subscriptionStatus: tag.subscriptionStatus,
        ownerId: owner?._id?.toString(),
        ownerName: ownerName || '(hidden)',
        showOwnerName,
        fieldsAccessed: ['pet.name', 'pet.petId', 'pet.species', 'pet.breed', 'pet.medicalAlerts', 'pet.status', 'ownerName', 'ownerPhone'],
        subscriptionActive: isActiveForFinder,
      },
    });
  } catch {
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
    const { finderPhone, finderEmail, finderName, latitude, longitude, accuracy, consent } = req.body;

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
    const scan = await FinderScan.findOne({ tagId: tag._id }).sort({ createdAt: -1 }) as any;
    if (scan) {
      scan.action = 'notified_owner';
      scan.notifiedAt = new Date();
      scan.contactAttempted = true;
      scan.finderPhone = finderPhone || undefined;
      scan.finderEmail = finderEmail || undefined;
      scan.finderName = finderName || undefined;
      // Store location if provided
      if (latitude && longitude) {
        scan.location = { latitude, longitude };
        scan.action = 'shared_location';
      }
      // Store consent for audit trail
      if (consent) {
        scan.consent = {
          locationConsent: consent.locationConsent || 'skipped',
          consentedAt: consent.consentedAt ? new Date(consent.consentedAt) : new Date(),
          consentVersion: consent.consentVersion || '1.0',
          ipAddress: req.ip || req.socket.remoteAddress || undefined,
        };
      }
      await scan.save();
    }

    // Save location event if GPS coordinates provided
    let locationSaved = false;
    if (latitude && longitude) {
      await LocationEvent.create({
        tagId: tag._id,
        petId: pet._id,
        ownerId: tag.ownerId,
        timestamp: new Date(),
        location: { latitude, longitude, accuracy, source: 'qr_scan' },
      });

      // Update tag last scan location
      tag.lastScanLocation = { latitude, longitude, source: 'qr_scan' };
      tag.lastScannedAt = new Date();
      await tag.save();
      locationSaved = true;
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

    // Build location context for notification
    let locationContext = '';
    if (locationSaved) {
      const accuracyMeters = accuracy ? Math.round(accuracy) : null;
      locationContext = accuracyMeters
        ? `📍 They were approximately ${accuracyMeters}m from the scan location.`
        : '📍 They shared their location with you.';
    }

    // Create notification to owner
    if (owner) {
      const notifTitle = `Your pet ${pet?.name || 'Unknown'} has been found!`;
      const notifMessage = `A kind person found your pet ${pet?.name || ''} (${pet?.petId || ''}). They left their contact details so you can reach them. ${contactInfo}${locationContext ? '\n\n' + locationContext : ''}`;

      await Notification.create({
        userId: owner._id,
        type: 'pet_found',
        title: notifTitle,
        message: notifMessage,
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
          location: locationSaved ? { latitude, longitude, accuracy } : null,
        },
      });

      await sendPushToUser(owner._id.toString(), notifTitle, notifMessage, {
        type: 'pet_found',
        petId: pet?._id?.toString() || '',
        tagId: tag.tagId,
      }).catch(() => {});

      // Send email notification to owner
      if (owner.email) {
        const scanLocation = locationSaved
          ? `${latitude}, ${longitude}${accuracy ? ` (±${Math.round(accuracy)}m)` : ''}`
          : undefined;
        await sendPetFoundEmail(
          owner.email,
          owner.fullName || 'Pet Owner',
          pet?.name || 'your pet',
          contactInfo,
          contactInfo,
          scanLocation,
        ).catch(() => {});
      }

      // Create escalation record for 30-minute follow-up
      const escalationDelaySetting = await Setting.findOne({ key: 'escalation.delayMinutes' });
      const delayMinutes = parseInt(escalationDelaySetting?.value || '30', 10);
      const escalationDeadline = new Date(Date.now() + delayMinutes * 60 * 1000);

      await EscalationRecord.create({
        petId: pet?._id,
        ownerId: owner._id,
        tagId: tag._id,
        finderScanId: scan?._id || tag._id,
        status: 'pending',
        foundAt: new Date(),
        ownerNotifiedAt: new Date(),
        escalationDeadline,
        finderName: finderName || null,
        finderPhone: finderPhone || null,
        finderEmail: finderEmail || null,
        finderMessage: contactInfo || null,
        scanLocation: locationSaved ? { latitude, longitude, accuracy } : undefined,
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Owner has been notified successfully! Thank you for helping reunite this pet with its owner.',
        petFound: pet?.status === 'found',
        locationShared: locationSaved,
      },
    });

    await auditFinderEvent(req, {
      action: 'notify_owner',
      eventType: 'finder_notify_owner',
      eventCategory: 'SYSTEM',
      operationType: 'CREATE',
      resourceType: 'FinderScan',
      resourceId: scan?._id?.toString() || tag._id.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        tagId: tag.tagId,
        petId: pet?._id?.toString(),
        petName: pet?.name,
        petStatus: pet?.status,
        ownerId: owner?._id?.toString(),
        finderName: finderName || null,
        finderPhone: finderPhone || null,
        finderEmail: finderEmail || null,
        locationShared: locationSaved,
        location: locationSaved ? { latitude, longitude, accuracy } : null,
        petFound: pet?.status === 'found',
        consent: consent || null,
      },
    });
  } catch {
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
  } catch {
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
    const { latitude, longitude, accuracy } = req.body;
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
      location: { latitude, longitude, accuracy, source: 'qr_scan' },
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

    await auditFinderEvent(req, {
      action: 'share_location',
      eventType: 'finder_share_location',
      eventCategory: 'SYSTEM',
      operationType: 'CREATE',
      resourceType: 'LocationEvent',
      resourceId: tag._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        tagId: tag.tagId,
        petId: tag.petId?.toString(),
        ownerId: tag.ownerId?.toString(),
        location: { latitude, longitude, accuracy },
        scanId: scan?._id?.toString(),
      },
    });
  } catch {
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
router.get('/shop/products', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, category, search } = req.query;
    const query: any = { isActive: true };
    
    if (category && category !== 'all') query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ name: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, data: products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

router.get('/shop/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.json({ success: true, data: product });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
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
    const content = await SiteContent.findOne({ slug: req.params.slug, status: 'published' });
    if (!content) {
      res.status(404).json({ success: false, error: 'Page not found' });
      return;
    }
    res.json({ success: true, data: content });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch content' });
  }
});

export default router;
