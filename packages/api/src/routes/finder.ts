import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Tag, FinderScan, LocationEvent, Notification, User, Pet, SiteContent, Setting, EscalationRecord } from '@pawtag/db';
import { toFinderPetView } from '@pawtag/shared';
import { sendPushToUser } from '../services/push-notification.service';
import { sendPetFoundEmail } from '../services/email.service';
import { auditService, type AuditContext } from '../services/audit';
import { createDbRateLimiter } from '../lib/rate-limiter';
import { requireCaptcha } from '../middleware/captcha';
import { parseUserAgent } from '../lib/user-agent';
import { getIpGeoData } from '../lib/geo-location';
import { recordPetHistory } from '../lib/pet-history';
import { describeIpArea, createScanAlertIfEligible } from '../lib/lost-pet-alerts';
import logger from '../lib/logger';

// Zod schemas for Finder endpoints
// Business rule (scan→reunification): phone is REQUIRED; name/email/message
// stay optional. The previous phone-OR-email rule was replaced by the
// founder-approved contract (2026-10-26) — client mirrors this validation.
const finderNotifySchema = z.object({
  finderPhone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(7, 'Enter a valid phone number')
    .max(20, 'Phone number must be 20 characters or less')
    .regex(/^\+?[\d\s().-]+$/, 'Enter a valid phone number'),
  finderEmail: z.union([z.string().email('Invalid email address'), z.literal('')]).optional(),
  finderName: z.string().max(100, 'Name must be 100 characters or less').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  consent: z.object({
    locationConsent: z.enum(['granted', 'denied', 'skipped', 'unavailable']),
  }).optional(),
  captchaToken: z.string().optional(),
  captchaAnswer: z.number().int().optional(),
});

const shareLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  accuracy: z.number().min(0).optional(),
});

const router = Router();

// Helper to detect device type from User-Agent
function detectDeviceType(ua: string): 'desktop' | 'mobile' | 'tablet' {
  if (!ua) return 'desktop';
  const lower = ua.toLowerCase();
  if (lower.includes('tablet') || lower.includes('ipad')) return 'tablet';
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return 'mobile';
  return 'desktop';
}

// A finder can share the same physical GPS spot twice (grant-time share +
// coordinates riding along on the notify payload). One LocationEvent per
// spot per pet within a short window keeps the owner's timeline clean
// without losing either delivery path.
async function recordSharedLocationIfNew(params: {
  tagId: unknown;
  petId: unknown;
  ownerId: unknown;
  latitude: number;
  longitude: number;
  accuracy?: number;
}): Promise<boolean> {
  const { tagId, petId, ownerId, latitude, longitude, accuracy } = params;
  // ~50m tolerance — same physical spot, not a different sighting.
  const SPOT_DEGREES = 0.0005;
  const recentCutoff = new Date(Date.now() - 2 * 60 * 1000);
  const existing = await LocationEvent.findOne({
    petId,
    timestamp: { $gte: recentCutoff },
    'location.latitude': { $gte: latitude - SPOT_DEGREES, $lte: latitude + SPOT_DEGREES },
    'location.longitude': { $gte: longitude - SPOT_DEGREES, $lte: longitude + SPOT_DEGREES },
  });
  if (existing) return false;
  await LocationEvent.create({
    tagId,
    petId,
    ownerId,
    timestamp: new Date(),
    location: { latitude, longitude, accuracy, source: 'qr_scan' },
  });
  return true;
}

// Finder-specific rate limiters — values from DB settings
const finderNotifyLimiter = createDbRateLimiter({
  settingKey: 'rateLimit.finder.notify.max',
  defaultValue: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many notification requests. Please try again later.',
  keySuffix: 'finder:notify',
});
const finderLocationLimiter = createDbRateLimiter({
  settingKey: 'rateLimit.finder.location.max',
  defaultValue: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Too many location requests. Please try again later.',
  keySuffix: 'finder:location',
});
// Tag lookups were previously unlimited; the finder landing page now offers
// direct tag-ID entry, so bound per-IP lookups (setting is seeded in CMS).
const finderViewLimiter = createDbRateLimiter({
  settingKey: 'rateLimit.finder.view.max',
  defaultValue: 60,
  windowMs: 60 * 60 * 1000,
  message: 'Too many tag lookups. Please try again later.',
  keySuffix: 'finder:view',
});

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
      logger.error({ err }, '[Audit] Failed to log finder event');
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
 *                         age:
 *                           type: number
 *                           description: Age in whole years (computed from birthday when only birthday is set)
 *                         favouriteFood:
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
router.get('/:tagId', finderViewLimiter, async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findOne({ tagId: req.params.tagId, deletedAt: null })
      .populate({ path: 'petId', match: { deletedAt: null }, select: '-__v' })
      .populate({ path: 'ownerId', select: 'fullName phoneNumber showOwnerNameInFinder address.line2 address.city' });

    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    const pet = tag.petId as any;
    const owner = tag.ownerId as any;

    // HYBRID 2: Check tag status using centralized service
    const { calculateTagStatus } = await import('../services/tag-status.service');
    const tagStatus = await calculateTagStatus(tag);

    // Product rule: finders can only find tags that are currently active.
    // Limited / expired / replaced / returned / cancelled / inactive / deleted are not findable.
    const rawStatus = tag.status as string;
    const nonFindableRawStatuses = new Set(['replaced', 'returned', 'cancelled', 'deleted', 'inactive', 'terminated']);
    const isFindable = tagStatus.status === 'active'
      && tagStatus.finderEnabled
      && !nonFindableRawStatuses.has(rawStatus);

    if (!isFindable) {
      // Tag is not findable — log scan, no pet/owner data
      const userAgent = (req.headers['user-agent'] as string) || 'unknown';
      const { browser, device } = parseUserAgent(userAgent);
      const ipGeo = await getIpGeoData(req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || '');

      await FinderScan.create({
        tagId: tag._id,
        petId: pet?._id || tag._id,
        deviceInfo: userAgent,
        deviceBrowser: browser,
        deviceOS: device,
        deviceType: detectDeviceType(userAgent),
        ipLocation: ipGeo || undefined,
        action: 'viewed',
      });

      const notFindableReason = rawStatus === 'returned' || tag.returnedAt
        ? 'returned'
        : rawStatus === 'cancelled'
          ? 'cancelled'
          : rawStatus === 'replaced'
            ? 'replaced'
            : tagStatus.status === 'limited'
              ? 'limited'
              : 'expired';

      await auditFinderEvent(req, {
        action: notFindableReason === 'returned' ? 'view_returned_tag' : 'view_inactive_tag',
        eventType: notFindableReason === 'returned' ? 'finder_view_returned' : 'finder_view_inactive',
        eventCategory: 'READ',
        operationType: 'READ',
        resourceType: 'Tag',
        resourceId: tag._id.toString(),
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: {
          tagId: tag.tagId,
          reason: notFindableReason,
          message: 'This PawTag is no longer active.',
          petInfo: null,
        },
      });

      res.json({
        success: true,
        data: {
          tagActive: false,
          tagLimited: false,
          message: 'This PawTag is no longer active.',
          petInfo: null,
        },
      });
      return;
    }

    // Log the scan
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    const { browser, device } = parseUserAgent(userAgent);
    const ipGeo = await getIpGeoData(req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || '');

    const createdScan = await FinderScan.create({
      tagId: tag._id,
      petId: pet._id,
      deviceInfo: userAgent,
      deviceBrowser: browser,
      deviceOS: device,
      deviceType: detectDeviceType(userAgent),
      ipLocation: ipGeo || undefined,
      action: 'viewed',
    });

    // Owner-facing scan history + Level-1 "is your pet safe?" alert.
    // A bare scan NEVER marks a pet lost (business rule). Both helpers are
    // failure-isolated (never throw), so awaiting them cannot break the
    // finder's lookup while keeping the writes deterministic for tests.
    if (owner?._id) {
      const scanArea = describeIpArea(ipGeo);
      await Promise.all([
        recordPetHistory({
          petId: pet._id.toString(),
          ownerId: owner._id.toString(),
          type: 'scan_received',
          actor: 'system',
          precision: scanArea ? 'approximate' : 'none',
          metadata: { tagId: tag.tagId, scanId: createdScan._id.toString(), area: scanArea },
        }),
        createScanAlertIfEligible({
          petId: pet._id.toString(),
          petName: pet.name || 'your pet',
          petStatus: pet.status,
          ownerId: owner._id.toString(),
          tagId: tag.tagId,
          area: scanArea,
        }),
      ]);
    }

    // Update tag scan info
    tag.lastScannedAt = new Date();
    await tag.save();

    // Check admin CMS setting for finder name visibility
    const adminSetting = await Setting.findOne({ key: 'finder.showOwnerName' });
    const adminShowName = adminSetting?.value !== 'false'; // default true
    const ownerShowName = owner.showOwnerNameInFinder !== false; // default true
    const showOwnerName = adminShowName && ownerShowName;

    // Status-based mask — safe pets don't expose owner info in production
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const isSafe = pet.status === 'safe';
    const maskOwner = isSafe && !isDev;

    // Build owner info based on privacy settings and pet status
    let ownerName: string | null = null;
    let ownerLocation: string | null = null;
    let ownerPhone: string | null = null;

    if (!maskOwner) {
      if (showOwnerName) {
        ownerName = owner.fullName;
        ownerPhone = owner.phoneNumber;
        if (owner.address?.city) {
          const parts = [owner.address.line2, owner.address.city].filter(Boolean);
          ownerLocation = parts.join(', ');
        }
      } else if (owner.address?.city) {
        const parts = [owner.address.line2, owner.address.city].filter(Boolean);
        ownerLocation = `located in ${parts.join(', ')}`;
      }
    }

    // Build pet view and gate medical alerts by owner's membership tier
    const petView = toFinderPetView(pet);
    if (owner?._id) {
      try {
        // Check owner's medical_alerts entitlement from registry
        const { membershipEntitlementService } = await import('../services/membership-entitlement.service');
        const hasMedicalAlerts = await membershipEntitlementService.hasAccess(owner._id, 'medical_alerts');
        if (!hasMedicalAlerts) {
          petView.medicalAlerts = undefined;
        }
      } catch {
        // If entitlement check fails, hide medical alerts for safety
        petView.medicalAlerts = undefined;
      }
    }

    res.json({
      success: true,
      data: {
        pet: petView,
        tagId: tag.tagId,
        tagStatus: tag.status,
        ownerName,
        ownerLocation,
        ownerPhone,
        safePetMasking: maskOwner,
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
        ownerId: owner?._id?.toString(),
        ownerName: ownerName || '(hidden)',
        showOwnerName,
        fieldsAccessed: ['pet.name', 'pet.petId', 'pet.species', 'pet.breed', 'pet.color', 'pet.age', 'pet.favouriteFood', 'pet.medicalAlerts', 'pet.status', 'ownerName', 'ownerPhone'],
        deviceBrowser: browser,
        deviceOS: device,
        deviceType: detectDeviceType(userAgent),
        ipCity: ipGeo?.city,
        ipRegion: ipGeo?.region,
        ipCountry: ipGeo?.country,
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
router.post('/:tagId/notify', finderNotifyLimiter, requireCaptcha, async (req: Request, res: Response) => {
  try {
    // Zod validation
    const parsed = finderNotifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || 'Invalid input' });
      return;
    }

    const { finderPhone, finderEmail, finderName, latitude, longitude, accuracy, consent } = parsed.data;

    const tag = await Tag.findOne({ tagId: req.params.tagId, deletedAt: null })
      .populate({ path: 'petId', match: { deletedAt: null } })
      .populate({ path: 'ownerId', select: 'fullName email phoneNumber' });

    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    // Returned/expired tags must not notify owners
    if (tag.status === 'returned' || tag.returnedAt) {
      res.status(400).json({ success: false, error: 'This PawTag is no longer active.' });
      return;
    }
    const { calculateTagStatus: calcNotify } = await import('../services/tag-status.service');
    const notifyStatus = await calcNotify(tag);
    if (!notifyStatus.finderEnabled) {
      res.status(400).json({ success: false, error: 'This PawTag is no longer active.' });
      return;
    }

    const pet = tag.petId as any;
    const owner = tag.ownerId as any;

    // Block notify for safe pets in production
    const isDevNotify = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (pet && pet.status === 'safe' && !isDevNotify) {
      res.status(400).json({ success: false, error: 'This pet is safe and does not need assistance.' });
      return;
    }

    // Update scan record with finder contact details
    const scan = await FinderScan.findOne({ tagId: tag._id }).sort({ createdAt: -1 }) as any;
    if (scan) {
      scan.action = 'notified_owner';
      scan.notifiedAt = new Date();
      scan.contactAttempted = true;
      scan.finderPhone = finderPhone || undefined;
      scan.finderEmail = finderEmail || undefined;
      scan.finderName = finderName || undefined;
      // Store GPS location if provided
      if (latitude && longitude) {
        scan.gpsLocation = { latitude, longitude, accuracy };
        scan.action = 'shared_location';
      }
      // Store consent for audit trail — server-authoritative timestamps and version
      if (consent) {
        scan.consent = {
          locationConsent: consent.locationConsent || 'skipped',
          consentedAt: new Date(), // Always server timestamp, never client-provided
          consentVersion: '1.0', // Server canonical version
          ipAddress: req.ip || req.socket.remoteAddress || undefined,
        };
      }
      await scan.save();
    }

    // Save location event if GPS coordinates provided
    let locationSaved = false;
    if (latitude && longitude) {
      await recordSharedLocationIfNew({
        tagId: tag._id,
        petId: pet._id,
        ownerId: tag.ownerId,
        latitude,
        longitude,
        accuracy,
      });

      // Update tag last scan location
      tag.lastScanLocation = { latitude, longitude, source: 'qr_scan' };
      tag.lastScannedAt = new Date();
      await tag.save();
      locationSaved = true;
    }

    // IMPORTANT: Do NOT auto-mark pet as 'found' here.
    // A finder report is evidence, not final recovery.
    // The pet stays 'lost' until the owner explicitly confirms recovery
    // via the mark-found endpoint. The EscalationRecord tracks the finder report.
    // See Work Packet 2.2 — finder report vs recovery confirmed.

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
      // IDEMPOTENCY: Check if a notification already exists for this tag + finder contact recently.
      // This prevents duplicate notifications from double-taps, browser retries, or network issues.
      const recentCutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
      const existingNotification = await Notification.findOne({
        userId: owner._id,
        type: 'pet_found',
        'data.tagId': tag.tagId,
        'data.finderPhone': finderPhone || null,
        'data.finderEmail': finderEmail || null,
        createdAt: { $gte: recentCutoff },
      }).sort({ createdAt: -1 });

      if (existingNotification) {
        // Already notified — return existing result instead of creating duplicate
        logger.info({ tagId: tag.tagId, notificationId: existingNotification._id }, 'Duplicate finder notify — returning existing notification');
        res.json({
          success: true,
          data: {
            message: 'Thank you! The owner has already been notified about this scan.',
            petFound: false,
            locationShared: locationSaved,
            duplicate: true,
          },
        });
        return;
      }

      // History (owner-facing): one fresh finder submission = one set of
      // timeline events; retries hitting the 5-minute dedupe above return
      // early and never duplicate the timeline.
      if (pet) {
        await recordPetHistory({
          petId: pet._id.toString(),
          ownerId: owner._id.toString(),
          type: 'finder_notified',
          actor: 'finder',
          metadata: {
            scanId: scan?._id?.toString() || null,
            finderName: finderName || null,
            finderPhone: finderPhone || null,
            finderEmail: finderEmail || null,
            locationShared: locationSaved,
          },
        });
        if (locationSaved && consent?.locationConsent === 'granted') {
          await recordPetHistory({
            petId: pet._id.toString(),
            ownerId: owner._id.toString(),
            type: 'finder_location_shared',
            actor: 'finder',
            precision: 'precise',
            metadata: { scanId: scan?._id?.toString() || null, accuracy: accuracy ?? null, latitude, longitude, source: 'qr_scan' },
          });
        } else if (consent && consent.locationConsent !== 'granted') {
          await recordPetHistory({
            petId: pet._id.toString(),
            ownerId: owner._id.toString(),
            type: 'finder_location_declined',
            actor: 'finder',
            precision: 'none',
            metadata: { consent: consent.locationConsent },
          });
        }
      }
      let emailResult = 'skipped_no_email';

      const notifTitle = `Your pet ${pet?.name || 'Unknown'} has been found!`;
      const notifMessage = `A kind person found your pet ${pet?.name || ''} (${pet?.petId || ''}). They left their contact details so you can reach them. ${contactInfo}${locationContext ? '\n\n' + locationContext : ''}`;

      // Product rule (founder): when a finder notifies on an ACTIVE tag, email the owner
      // regardless of membership. Free customers get this for the 3-month Active Period;
      // after that the tag is no longer finder-active unless membership keeps it active.
      // Email is isolated from in-app/push so a provider failure cannot block recovery contact.
      if (owner.email) {
        emailResult = 'failed';
        try {
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
          );
          emailResult = 'sent';
        } catch (emailErr) {
          logger.error({ err: emailErr, petId: pet?._id, ownerEmail: owner.email }, '[Finder] Failed to send pet-found email to owner');
        }
      }

      // In-app + push: decided by the entitlement registry alone — the
      // activation context (free 3-month window after a tag purchase) is
      // resolved inside hasAccess, so no route-level "free customer"
      // special cases (docs/ACTIVATION-ENTITLEMENTS.md).
      const { membershipEntitlementService } = await import('../services/membership-entitlement.service');
      const ownerInAppEntitled = await membershipEntitlementService.hasAccess(owner._id.toString(), 'in_app_notifications');

      let inAppResult = 'skipped_not_entitled';
      let pushResult = 'skipped_not_entitled';
      if (ownerInAppEntitled) {
        try {
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
          inAppResult = 'created';
        } catch (notifErr) {
          inAppResult = 'failed';
          logger.error({ err: notifErr, petId: pet?._id, ownerId: owner._id }, '[Finder] Failed to create in-app notification for owner');
        }

        // Push runs independently of the in-app write (one failing must not
        // block the other) and never blocks the finder's submission.
        try {
          const pushOutcome = await sendPushToUser(owner._id.toString(), notifTitle, notifMessage, {
            type: 'pet_found',
            petId: pet?._id?.toString() || '',
            tagId: tag.tagId,
          });
          pushResult = pushOutcome.sent ? 'sent' : 'failed';
        } catch {
          pushResult = 'failed';
        }
      }

      // History: honest per-channel delivery attempt statuses — neither the
      // history nor the UI may claim a channel succeeded unless it did.
      if (pet) {
        await recordPetHistory({
          petId: pet._id.toString(),
          ownerId: owner._id.toString(),
          type: 'notification_attempted',
          actor: 'system',
          metadata: {
            channels: { email: emailResult, inApp: inAppResult, push: pushResult },
            tagId: tag.tagId,
          },
        });
      }

      // Create escalation record for 30-minute follow-up
      // IDEMPOTENCY: Check if an escalation already exists for this tag recently
      const existingEscalation = await EscalationRecord.findOne({
        tagId: tag._id,
        createdAt: { $gte: recentCutoff },
      }).sort({ createdAt: -1 });

      if (!existingEscalation) {
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
    }

    res.json({
      success: true,
      data: {
        message: 'Thank you! The owner has been notified and will be alerted shortly.',
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

    res.json({
      success: true,
      data: {
        active: true,
        foundAt: pet.foundByFinderAt,
        elapsed: Date.now() - new Date(pet.foundByFinderAt).getTime(),
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
router.post('/:tagId/share-location', finderLocationLimiter, async (req: Request, res: Response) => {
  try {
    // Zod validation with numeric range checks
    const parsed = shareLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message || 'Invalid coordinates' });
      return;
    }

    const { latitude, longitude, accuracy } = parsed.data;

    const tag = await Tag.findOne({ tagId: req.params.tagId })
      .populate({ path: 'petId', match: { deletedAt: null }, select: '_id' })
      .populate({ path: 'ownerId', select: '_id' });
    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    // Same findable guard as notify — dead tags share nothing (also protects
    // this endpoint now that it is called at grant time by the finder client).
    const { calculateTagStatus: calcShare } = await import('../services/tag-status.service');
    const shareTagStatus = await calcShare(tag);
    if (!shareTagStatus.finderEnabled || !tag.petId || !tag.ownerId) {
      res.status(400).json({ success: false, error: 'This PawTag is no longer active.' });
      return;
    }

    // CAPTCHA intentionally NOT required here (founder packet 2026-10-28):
    // this endpoint records a consented GPS point only — it notifies nobody
    // and cannot be auto-solved around (a tap-share can't carry a user-solved
    // challenge). Abuse is bounded by the 10/h limiter, server-side consent
    // recording, the audit trail below, and the 2-minute same-spot dedupe.
    // The consequential contact action (notify) keeps requireCaptcha.
    await recordSharedLocationIfNew({
      tagId: tag._id,
      petId: (tag.petId as any)._id,
      ownerId: (tag.ownerId as any)._id,
      latitude,
      longitude,
      accuracy,
    });

    // Update tag last scan location
    tag.lastScanLocation = { latitude, longitude, source: 'qr_scan' };
    tag.lastScannedAt = new Date();
    await tag.save();

    // Update scan record — consent recorded server-authoritatively (privacy
    // trail): this endpoint IS the finder's explicit grant action.
    const scan = await FinderScan.findOne({ tagId: tag._id }).sort({ createdAt: -1 });
    if (scan) {
      scan.location = { latitude, longitude };
      scan.action = 'shared_location';
      scan.consent = {
        locationConsent: 'granted',
        consentedAt: new Date(),
        consentVersion: '1.0',
        ipAddress: req.ip || req.socket.remoteAddress || undefined,
      };
      await scan.save();
    }

    await recordPetHistory({
      petId: (tag.petId as any)._id.toString(),
      ownerId: (tag.ownerId as any)._id.toString(),
      type: 'finder_location_shared',
      actor: 'finder',
      precision: 'precise',
      metadata: { accuracy: accuracy ?? null, latitude, longitude, source: 'qr_scan', standalone: true },
    });

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
// Product routes now served by PawTag products API
// Frontend uses sdk.store.product.list() and sdk.store.product.retrieve()

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
