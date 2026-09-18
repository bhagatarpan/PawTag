import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { deleteProductImageSchema } from '../middleware/schemas';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';
import { auditService, type AuditContext } from '../services/audit';
import { uploadMedia, deleteMedia } from '../services/storage';
import { Pet, User } from '@pawtag/db';
import logger from '../lib/logger';

const router = Router();

async function auditUploadEvent(
  req: AuditRequest,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  // Fire and forget — never block the file response
  const logAudit = async () => {
    try {
      const reqContext = createAuditContextFromRequest(req);
      const context: AuditContext = {
        ...reqContext,
        actorType: 'USER',
        actorId: req.user?.id,
        actorUsername: req.user?.email,
        ...overrides,
      } as AuditContext;
      await auditService.log(context, input);
    } catch (err) {
      logger.error({ err }, '[Audit] Failed to log upload event');
    }
  };
  logAudit();
}

// Configure multer for memory storage
const memoryStorage = multer.memoryStorage();

const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * @swagger
 * /api/upload/pet-photo:
 *   post:
 *     tags: [Upload]
 *     summary: Upload a pet photo
 *     description: Upload an image file for a pet. Returns the URL to access the uploaded image.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Image file (jpg, png, gif, webp, max 5MB)
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
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
 *                     url:
 *                       type: string
 *                       description: URL to access the uploaded photo
 *                     filename:
 *                       type: string
 *       400:
 *         description: No file uploaded or invalid file type
 *       401:
 *         description: Not authenticated
 *       413:
 *         description: File too large (max 5MB)
 */
router.post('/pet-photo', authenticate, async (req: AuthRequest, res: Response) => {
  upload.single('photo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No photo uploaded' });
      return;
    }

    try {
      const petId = (req.query.petId as string) || (req.body?.petId as string) || undefined;

      if (petId) {
        const pet = await Pet.findOne({ _id: petId, ownerId: req.user!.id, deletedAt: null });
        if (!pet) {
          res.status(403).json({ success: false, error: 'You do not have permission to upload a photo for this pet' });
          return;
        }
      }

      const result = await uploadMedia(
        'pet-photo',
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype,
        { petId },
      );

      res.json({
        success: true,
        data: { url: result.url, filename: result.filename },
      });

      await auditUploadEvent(req, {
        action: 'upload_pet_photo',
        eventType: 'upload_pet_photo',
        eventCategory: 'FILE',
        operationType: 'CREATE',
        resourceType: 'Pet',
        resourceId: petId,
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: {
          file: result.filename,
          filename: result.filename,
          size: req.file.size,
          mimeType: req.file.mimetype,
          petId,
          url: result.url,
        },
      });
    } catch (uploadError) {
      logger.error({ err: uploadError }, 'Upload error');
      res.status(500).json({ success: false, error: 'Failed to upload photo' });
    }
  });
});

/**
 * @swagger
 * /api/upload/profile-picture:
 *   post:
 *     tags: [Upload]
 *     summary: Upload a profile picture
 *     description: Upload a profile picture for the authenticated user. Returns the URL to access the uploaded image.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Image file (jpg, png, gif, webp, max 5MB)
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
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
 *                     url:
 *                       type: string
 *                       description: URL to access the uploaded profile picture
 *       400:
 *         description: No file uploaded or invalid file type
 *       401:
 *         description: Not authenticated
 *       413:
 *         description: File too large (max 5MB)
 */
router.post('/profile-picture', authenticate, async (req: AuthRequest, res: Response) => {
  upload.single('photo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No photo uploaded' });
      return;
    }

    try {
      const result = await uploadMedia(
        'profile-picture',
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype,
        { userId: req.user!.id },
      );

      // Update user's profilePicture in database
      const user = await User.findByIdAndUpdate(
        req.user!.id,
        { profilePicture: result.url },
        { new: true }
      ).select('-passwordHash');

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        data: { url: result.url, user },
      });

      await auditUploadEvent(req, {
        action: 'upload_profile_picture',
        eventType: 'upload_profile_picture',
        eventCategory: 'FILE',
        operationType: 'CREATE',
        resourceType: 'User',
        resourceId: req.user!.id,
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: {
          filename: result.filename,
          size: req.file.size,
          mimeType: req.file.mimetype,
          url: result.url,
        },
      });
    } catch (uploadError) {
      logger.error({ err: uploadError }, 'Profile picture upload error');
      res.status(500).json({ success: false, error: 'Failed to upload profile picture' });
    }
  });
});

/**
 * @swagger
 * /api/upload/product-images:
 *   post:
 *     tags: [Upload]
 *     summary: Upload product images
 *     description: Upload one or more image files for a product. Returns URLs to access the uploaded images.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (jpg, png, gif, webp, max 5MB each, up to 5 files)
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: No files uploaded or invalid file type
 *       401:
 *         description: Not authenticated
 *       413:
 *         description: File too large
 */
router.post('/product-images', authenticate, requirePermission('product.update'), async (req: AuthRequest, res: Response) => {
  upload.array('images', 5)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ success: false, error: 'File too large. Maximum size is 5MB per image.' });
        return;
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({ success: false, error: 'Too many files. Maximum is 5 images per upload.' });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ success: false, error: 'No images uploaded' });
      return;
    }

    try {
      const productId = (req.query.productId as string) || (req.body?.productId as string) || undefined;
      const uploaded = [];

      for (const file of req.files) {
        const result = await uploadMedia(
          'product-image',
          file.originalname,
          file.buffer,
          file.mimetype,
          { productId },
        );
        uploaded.push({ url: result.url, filename: result.filename });
      }

      res.json({
        success: true,
        data: { images: uploaded },
      });

      await auditUploadEvent(req, {
        action: 'upload_product_image',
        eventType: 'upload_product_image',
        eventCategory: 'FILE',
        operationType: 'CREATE',
        resourceType: 'Product',
        resourceId: productId,
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: {
          files: uploaded.map((u) => u.filename),
          count: uploaded.length,
          sizes: req.files.map((f) => ({ filename: f.originalname, size: f.size, mimeType: f.mimetype })),
          productId,
        },
      });
    } catch (uploadError) {
      logger.error({ err: uploadError }, 'Upload error');
      res.status(500).json({ success: false, error: 'Failed to upload images' });
    }
  });
});

/**
 * @swagger
 * /api/upload/product-images/{filename}:
 *   delete:
 *     tags: [Upload]
 *     summary: Delete a product image
 *     description: Delete a product image file from the server.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The image filename to delete
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Image not found
 */
router.delete('/product-images/:filename', authenticate, requirePermission('product.update'), validate(deleteProductImageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;

    const productId = (req.query.productId as string) || (req.body?.productId as string) || undefined;

    await deleteMedia(`products/${filename}`);

    res.json({ success: true, data: { message: 'Image deleted' } });

    await auditUploadEvent(req, {
      action: 'upload_product_image_delete',
      eventType: 'upload_product_image_delete',
      eventCategory: 'FILE',
      operationType: 'DELETE',
      resourceType: 'Product',
      resourceId: productId || filename,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        filename,
        productId,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete image' });
  }
});

export default router;
