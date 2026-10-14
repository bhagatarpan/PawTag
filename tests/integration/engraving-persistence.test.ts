/**
 * @module Engraving Persistence Regression Suite
 * @description Pet-name engraving must survive the full cart API chain:
 * add-with-texts → edit-texts → totals. Guards against the July-era class of
 * bugs where engraving UI/data was dropped (checkout UI removed in
 * b0694f5; guest→login sync dropped texts in CartContext).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';

async function createCustomer() {
  const email = `engrave-test-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: 'Engrave Test User',
    phoneNumber: '+64218888888',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { userId: user.insertedId.toString(), email, password: 'Password123!' };
}

async function createEngravableProduct() {
  const product = await mongoose.connection.collections.products.insertOne({
    name: 'PawTag Classic',
    slug: `pawtag-classic-${Date.now()}`,
    sku: `SKU-ENG-${Date.now()}`,
    price: 39.0,
    stock: 10,
    reserved: 0,
    stockPolicy: 'deny',
    status: 'active',
    category: 'tags',
    description: 'Engravable tag',
    images: [],
    isActive: true,
    currency: 'NZD',
    customizable: true,
    customizationLabel: 'Pet name',
    customizationPrice: 5.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return product.insertedId.toString();
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token as string;
}

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Pet-name engraving persistence', () => {
  it('accepts an item WITH engraving texts and snapshots the product engraving config', async () => {
    const { email, password } = await createCustomer();
    const token = await loginAs(email, password);
    const productId = await createEngravableProduct();

    const add = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 1,
        customisation: true,
        customisationTexts: ['Buddy'],
        customizable: true,
        customizationLabel: 'Pet name',
        customizationPrice: 5,
      });

    expect(add.status).toBe(200);
    const item = add.body.data.cart.items[0];
    expect(item.customisation).toBe(true);
    expect(item.customisationTexts).toEqual(['Buddy']);
    expect(item.customizationLabel).toBe('Pet name');
    expect(item.customizationTotal).toBe(5);
  });

  it('edits engraving texts through PUT and keeps them retrievable', async () => {
    const { email, password } = await createCustomer();
    const token = await loginAs(email, password);
    const productId = await createEngravableProduct();

    const add = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2, customisation: true, customisationTexts: ['Buddy'] });
    const itemId = add.body.data.cart.items[0]._id;

    const edit = await request(app)
      .put(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customisationTexts: ['Buddy', 'Max'] });
    expect(edit.status).toBe(200);
    expect(edit.body.data.cart.items[0].customisationTexts).toEqual(['Buddy', 'Max']);

    const fetch = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);
    expect(fetch.body.data.cart.items[0].customisationTexts).toEqual(['Buddy', 'Max']);
  });

  it('includes the engraving surcharge in server totals', async () => {
    const { email, password } = await createCustomer();
    const token = await loginAs(email, password);
    const productId = await createEngravableProduct();

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2, customisation: true, customisationTexts: ['Buddy', 'Max'] });

    const fetch = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);

    // 2 × (39.00 base + 5.00 engraving)
    expect(fetch.body.data.totals.subtotal).toBe(88);
  });

  it('keeps a non-engraved line separate from an engraved line of the same product', async () => {
    const { email, password } = await createCustomer();
    const token = await loginAs(email, password);
    const productId = await createEngravableProduct();

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1, customisation: false });
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1, customisation: true, customisationTexts: ['Buddy'] });

    const fetch = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(fetch.body.data.cart.items).toHaveLength(2);
    const engraved = fetch.body.data.cart.items.find((i: { customisation: boolean }) => i.customisation);
    expect(engraved.customisationTexts).toEqual(['Buddy']);
    // 1 × 39 + 1 × (39 + 5)
    expect(fetch.body.data.totals.subtotal).toBe(83);
  });
});
