import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/pets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `pet-${uniqueSuffix}${ext}`);
  },
});

// Configure multer for product image uploads
const productStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const productUpload = multer({
  storage: productStorage,
  fileFilter,
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
router.post('/pet-photo', authenticate, (req: AuthRequest, res: Response) => {
  upload.single('photo')(req, res, (err) => {
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

    const photoUrl = `${req.protocol}://${req.get('host')}/api/uploads/pets/${req.file.filename}`;
    res.json({
      success: true,
      data: { url: photoUrl, filename: req.file.filename },
    });
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
router.post('/product-images', authenticate, requirePermission('product.update'), (req: AuthRequest, res: Response) => {
  productUpload.array('images', 5)(req, res, (err) => {
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

    const baseUrl = `${req.protocol}://${req.get('host')}/api/uploads/products`;
    const uploaded = req.files.map((file) => ({
      url: `${baseUrl}/${file.filename}`,
      filename: file.filename,
    }));

    res.json({
      success: true,
      data: { images: uploaded },
    });
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
router.delete('/product-images/:filename', authenticate, requirePermission('product.update'), (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/products', filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Image not found' });
      return;
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, data: { message: 'Image deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete image' });
  }
});

export default router;
