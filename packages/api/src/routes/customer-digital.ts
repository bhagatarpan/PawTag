/**
 * @module Customer Digital Product Routes
 * @description Customer-facing routes for accessing purchased digital products.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { DigitalProduct, DigitalEntitlement, Product } from '@pawtag/db';
import { NotFoundError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/customer/digital-products
 * List all digital products the customer has purchased
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { page = 1, limit = 20 } = req.query;

    const query = { userId, isActive: true };

    const total = await DigitalEntitlement.countDocuments(query);
    const entitlements = await DigitalEntitlement.find(query)
      .populate({
        path: 'digitalProductId',
        populate: { path: 'productId', select: 'name description images price' },
      })
      .sort({ grantedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: entitlements, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list customer digital products');
    res.status(500).json({ success: false, error: 'Failed to list digital products' });
  }
});

/**
 * GET /api/customer/digital-products/:entitlementId
 * Get details for a specific digital product entitlement
 */
router.get('/:entitlementId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const entitlement = await DigitalEntitlement.findOne({
      _id: req.params.entitlementId,
      userId,
      isActive: true,
    }).populate({
      path: 'digitalProductId',
      populate: { path: 'productId', select: 'name description images price' },
    });

    if (!entitlement) throw new NotFoundError('Digital product entitlement');

    // Check if access has expired
    const isExpired = entitlement.accessExpiresAt && entitlement.accessExpiresAt < new Date();

    // Check if download limit reached
    const isDownloadLimitReached = entitlement.downloadLimit > 0 &&
      entitlement.downloadCount >= entitlement.downloadLimit;

    res.json({
      success: true,
      data: {
        entitlement,
        isExpired,
        isDownloadLimitReached,
        canDownload: !isExpired && !isDownloadLimitReached,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ success: false, error: error.message });
    } else {
      logger.error({ error }, 'Failed to get digital product entitlement');
      res.status(500).json({ success: false, error: 'Failed to get digital product' });
    }
  }
});

/**
 * POST /api/customer/digital-products/:entitlementId/download
 * Record a download and return access info
 */
router.post('/:entitlementId/download', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const entitlement = await DigitalEntitlement.findOne({
      _id: req.params.entitlementId,
      userId,
      isActive: true,
    }).populate({
      path: 'digitalProductId',
      populate: { path: 'productId', select: 'name' },
    });

    if (!entitlement) throw new NotFoundError('Digital product entitlement');

    // Check if access has expired
    if (entitlement.accessExpiresAt && entitlement.accessExpiresAt < new Date()) {
      return res.status(403).json({ success: false, error: 'Access has expired' });
    }

    // Check if download limit reached
    if (entitlement.downloadLimit > 0 && entitlement.downloadCount >= entitlement.downloadLimit) {
      return res.status(403).json({ success: false, error: 'Download limit reached' });
    }

    // Increment download count
    entitlement.downloadCount += 1;
    await entitlement.save();

    const digitalProduct = entitlement.digitalProductId as any;

    res.json({
      success: true,
      data: {
        fileUrl: digitalProduct.fileUrl,
        fileName: (entitlement.digitalProductId as any).productId?.name || 'download',
        mimeType: digitalProduct.mimeType,
        downloadCount: entitlement.downloadCount,
        downloadLimit: entitlement.downloadLimit,
        accessExpiresAt: entitlement.accessExpiresAt,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ success: false, error: error.message });
    } else {
      logger.error({ error }, 'Failed to process digital product download');
      res.status(500).json({ success: false, error: 'Failed to process download' });
    }
  }
});

export default router;
