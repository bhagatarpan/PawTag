/**
 * @module Product Routes (Public)
 * @description Public API routes for product catalogue.
 *
 * These routes serve the shop page and product detail pages.
 * No authentication required — products are public information.
 *
 * Routes:
 * - GET /api/products          — List active, published products
 * - GET /api/products/:id      — Get product by ID
 * - GET /api/products/sku/:sku — Get product by SKU
 *
 * All responses use the standard { success, data, error } format.
 */

import { Router, Request, Response } from 'express';
import { productService } from '../commerce/services';
import logger from '../lib/logger';

const router = Router();

/**
 * GET /api/products
 *
 * List all active, published products for the shop.
 * Supports filtering and pagination.
 *
 * Query params:
 * - page (default: 1)
 * - limit (default: 20)
 * - search (optional)
 * - category (optional)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;

    const result = await productService.list(
      {
        search: search as string,
        category: category as string,
        isActive: true,
        isPublished: true,
      },
      {
        page: Number(page),
        limit: Math.min(Number(limit), 100), // Cap at 100
        sortBy: 'sortOrder',
        sortDir: 'asc',
      },
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list products');
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 *
 * Get a single product by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await productService.getById(req.params.id);

    // Only return active, published products to public
    if (!product.isActive || !product.isPublished) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    logger.error({ err }, 'Failed to fetch product');
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

/**
   * GET /api/products/sku/:sku
   *
   * Get a product by SKU (e.g., 'PT-SCAN').
   */
  router.get('/sku/:sku', async (req: Request, res: Response) => {
    try {
      const product = await productService.getBySku(req.params.sku);

      if (!product.isActive || !product.isPublished) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      logger.error({ err }, 'Failed to fetch product by SKU');
      res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
  });

  /**
   * GET /api/products/slug/:slug
   *
   * Get a product by slug (e.g., 'pawtag-scan').
   */
  router.get('/slug/:slug', async (req: Request, res: Response) => {
    try {
      const product = await productService.getBySlug(req.params.slug);

      if (!product.isActive || !product.isPublished) {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        res.status(404).json({ success: false, error: 'Product not found' });
        return;
      }
      logger.error({ err }, 'Failed to fetch product by slug');
      res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
  });

export default router;
