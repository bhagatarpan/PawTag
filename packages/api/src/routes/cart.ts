/**
 * @module Cart Routes
 * @description API routes for shopping cart operations.
 *
 * All routes require authentication (JWT).
 * Cart operations are user-scoped — each user has one active cart.
 *
 * Routes:
 * - GET    /api/cart              — Get current cart
 * - POST   /api/cart/items        — Add item to cart
 * - PUT    /api/cart/items/:id    — Update item quantity
 * - DELETE /api/cart/items/:id    — Remove item from cart
 * - DELETE /api/cart              — Clear cart
 * - POST   /api/cart/promo        — Apply promo code
 * - DELETE /api/cart/promo        — Remove promo code
 * - POST   /api/cart/shipping     — Set shipping method
 * - GET    /api/cart/totals       — Calculate cart totals
 *
 * All responses use { success, data?, error? } format.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { cartService } from '../commerce/services/cart.service';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

/**
 * GET /api/cart
 *
 * Get the current user's cart.
 * Creates one if it doesn't exist.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const cart = await cartService.getOrCreate(req.user!.id);
    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to get cart');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/cart/items
 *
 * Add an item to the cart.
 * Body: { productId, quantity, customisation?, variantName? }
 */
router.post('/items', async (req: AuthRequest, res: Response) => {
  try {
    const { productId, quantity, customisation, variantName } = req.body;

    if (!productId || !quantity || quantity < 1) {
      res.status(400).json({ success: false, error: 'productId and quantity (>= 1) are required' });
      return;
    }

    const cart = await cartService.addItem(req.user!.id, {
      productId,
      quantity,
      customisation,
      variantName,
    });

    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to add item to cart');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * PUT /api/cart/items/:id
 *
 * Update item quantity.
 * Body: { quantity }
 */
router.put('/items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { quantity } = req.body;

    if (quantity === undefined) {
      res.status(400).json({ success: false, error: 'quantity is required' });
      return;
    }

    const cart = await cartService.updateItem(req.user!.id, {
      itemId: req.params.id,
      quantity,
    });

    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to update cart item');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * DELETE /api/cart/items/:id
 *
 * Remove an item from the cart.
 */
router.delete('/items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cart = await cartService.removeItem(req.user!.id, req.params.id);
    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to remove cart item');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * DELETE /api/cart
 *
 * Clear all items from the cart.
 */
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const cart = await cartService.clearCart(req.user!.id);
    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to clear cart');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/cart/promo
 *
 * Apply a promo code to the cart.
 * Body: { code }
 */
router.post('/promo', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ success: false, error: 'Promo code is required' });
      return;
    }

    const cart = await cartService.applyPromoCode(req.user!.id, code);
    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to apply promo code');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * DELETE /api/cart/promo
 *
 * Remove promo code from cart.
 */
router.delete('/promo', async (req: AuthRequest, res: Response) => {
  try {
    const cart = await cartService.removePromoCode(req.user!.id);
    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to remove promo code');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/cart/shipping
 *
 * Set shipping method on cart.
 * Body: { methodId, methodName, cost }
 */
router.post('/shipping', async (req: AuthRequest, res: Response) => {
  try {
    const { methodId, methodName, cost } = req.body;

    if (!methodId || !methodName) {
      res.status(400).json({ success: false, error: 'methodId and methodName are required' });
      return;
    }

    const cart = await cartService.setShipping(req.user!.id, methodId, methodName, cost ?? 0);
    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: { cart, totals },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to set shipping');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/cart/totals
 *
 * Calculate and return cart totals.
 */
router.get('/totals', async (req: AuthRequest, res: Response) => {
  try {
    const totals = await cartService.calculateTotals(req.user!.id);

    res.json({
      success: true,
      data: totals,
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to calculate totals');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;
