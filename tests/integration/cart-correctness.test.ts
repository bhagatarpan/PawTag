/**
 * @module Cart Correctness Regression Suite
 * @description Integration tests for cart API correctness.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';

// --- Helpers ---

async function createCustomer(overrides: Partial<{ email: string; password: string }> = {}) {
  const email = overrides.email || `cart-test-${Date.now()}@example.com`;
  const password = overrides.password || 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: 'Cart Test User',
    phoneNumber: '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { userId: user.insertedId.toString(), email, password };
}

async function createProduct(overrides: Record<string, any> = {}) {
  const product = await mongoose.connection.collections.products.insertOne({
    name: overrides.name || 'PawTag Classic',
    slug: overrides.slug || `pawtag-classic-${Date.now()}`,
    sku: overrides.sku || `SKU-${Date.now()}`,
    price: overrides.price ?? 39.00,
    stock: overrides.stock ?? 10,
    reserved: 0,
    stockPolicy: overrides.stockPolicy || 'deny',
    status: 'active',
    category: 'tags',
    description: 'Test product',
    images: [],
    isActive: true,
    currency: 'NZD',
    ...overrides,
  });

  return product.insertedId.toString();
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.data?.token || '';
}

// --- Tests ---

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════
// AUTHENTICATED CART OPERATIONS
// ═══════════════════════════════════════════

describe('Integration: Cart - Authenticated Operations', () => {
  it('add item to cart', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cart.items).toHaveLength(1);
    expect(res.body.data.cart.items[0].quantity).toBe(2);
  });

  it('update item quantity', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    // Add item
    const addRes = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const itemId = addRes.body.data.cart.items[0]._id;

    // Update quantity
    const updateRes = await request(app)
      .put(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.cart.items[0].quantity).toBe(5);
  });

  it('remove item from cart', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    // Add item
    const addRes = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const itemId = addRes.body.data.cart.items[0]._id;

    // Remove item
    const removeRes = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.cart.items).toHaveLength(0);
  });

  it('clear entire cart', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    // Add item
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    // Clear cart
    const clearRes = await request(app)
      .delete('/api/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.cart.items).toHaveLength(0);
  });

  it('get cart returns correct totals', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    // Add 2 items
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    // Get cart
    const getRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.totals.subtotal).toBe(78.00);
    expect(getRes.body.data.totals.total).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// PROMO CODE OPERATIONS
// ═══════════════════════════════════════════

describe('Integration: Cart - Promo Code', () => {
  it('apply promo code to cart', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    // Add item
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    // Apply promo (may fail if no valid promo exists, but endpoint should respond)
    const promoRes = await request(app)
      .post('/api/cart/promo')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TESTCODE' });

    // Should return 200 or 400 (invalid code), not 500
    expect([200, 400]).toContain(promoRes.status);
  });

  it('remove promo code from cart', async () => {
    const { email, password } = await createCustomer();
    const token = await loginAs(email, password);

    const removeRes = await request(app)
      .delete('/api/cart/promo')
      .set('Authorization', `Bearer ${token}`);

    expect(removeRes.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// CART EDGE CASES
// ═══════════════════════════════════════════

describe('Integration: Cart - Edge Cases', () => {
  it('empty cart returns correct structure', async () => {
    const { email, password } = await createCustomer();
    const token = await loginAs(email, password);

    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.items).toEqual([]);
    expect(res.body.data.totals.subtotal).toBe(0);
    expect(res.body.data.totals.total).toBe(0);
  });

  it('cart persists across requests', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    // Add item
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    // Get cart in separate request
    const getRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.data.cart.items).toHaveLength(1);
    expect(getRes.body.data.cart.items[0].quantity).toBe(2);
  });

  it('add same product twice increments quantity', async () => {
    const { email, password } = await createCustomer();
    const productId = await createProduct({ name: 'PawTag QR', price: 39.00 });
    const token = await loginAs(email, password);

    // Add item twice
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    // Should have 1 item with quantity 3
    const getRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.data.cart.items).toHaveLength(1);
    expect(getRes.body.data.cart.items[0].quantity).toBe(3);
  });
});

// ═══════════════════════════════════════════
// UNAUTHORIZED ACCESS
// ═══════════════════════════════════════════

describe('Integration: Cart - Unauthorized Access', () => {
  it('cart endpoints require authentication', async () => {
    const getRes = await request(app).get('/api/cart');
    expect(getRes.status).toBe(401);

    const addRes = await request(app)
      .post('/api/cart/items')
      .send({ productId: 'test', quantity: 1 });
    expect(addRes.status).toBe(401);
  });
});
