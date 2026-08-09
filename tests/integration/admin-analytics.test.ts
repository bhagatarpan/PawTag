import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, Tag, FinderScan, Pet, Product, Setting } from '@pawtag/db';
import { createSuperAdmin } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

const shippingAddress = { line1: '123 Test St', city: 'Auckland', state: 'Auckland', zip: '1010' };

describe('Phase 18 — Admin Analytics Dashboard', () => {
  describe('GET /api/admin/analytics/overview', () => {
    it('should return correct revenue and order counts for different time periods', async () => {
      const { token } = await createSuperAdmin();

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Mirror the analytics route's window boundaries (week starts Sunday, per getDay()).
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      await Order.create([
        {
          orderNumber: 'PT-ANALYTICS-001',
          userId: new mongoose.Types.ObjectId(),
          items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Tag 1', quantity: 1, unitPrice: 19.99, totalPrice: 19.99 }],
          status: 'paid',
          payment: { method: 'card', status: 'completed', amount: 19.99, currency: 'NZD', paidAt: now },
          shippingAddress,
          createdAt: today,
        },
        {
          orderNumber: 'PT-ANALYTICS-002',
          userId: new mongoose.Types.ObjectId(),
          items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Tag 2', quantity: 1, unitPrice: 29.99, totalPrice: 29.99 }],
          status: 'paid',
          payment: { method: 'card', status: 'completed', amount: 29.99, currency: 'NZD', paidAt: now },
          shippingAddress,
          createdAt: today,
        },
        {
          orderNumber: 'PT-ANALYTICS-003',
          userId: new mongoose.Types.ObjectId(),
          items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Tag 3', quantity: 1, unitPrice: 9.99, totalPrice: 9.99 }],
          status: 'paid',
          payment: { method: 'card', status: 'completed', amount: 9.99, currency: 'NZD', paidAt: yesterday },
          shippingAddress,
          createdAt: yesterday,
        },
      ]);

      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;

      expect(data.orders.today).toBe(2);
      expect(data.revenue.today).toBeCloseTo(49.98, 1);
      // Yesterday's order may or may not fall inside the current week/month
      // depending on the day of the week the suite runs on (week starts Sunday).
      const expectedThisWeek = yesterday >= startOfWeek ? 3 : 2;
      const expectedThisWeekRevenue = yesterday >= startOfWeek ? 59.97 : 49.98;
      const expectedThisMonth = yesterday >= startOfMonth ? 3 : 2;
      const expectedThisMonthRevenue = yesterday >= startOfMonth ? 59.97 : 49.98;
      expect(data.orders.thisWeek).toBe(expectedThisWeek);
      expect(data.revenue.thisWeek).toBeCloseTo(expectedThisWeekRevenue, 1);
      expect(data.orders.thisMonth).toBe(expectedThisMonth);
      expect(data.revenue.thisMonth).toBeCloseTo(expectedThisMonthRevenue, 1);
    });

    it('should return correct tag counts', async () => {
      const { token } = await createSuperAdmin();

      await Tag.create([
        { tagId: 'PT-TAG-001', tagType: 'qr', status: 'active', subscriptionStatus: 'active' },
        { tagId: 'PT-TAG-002', tagType: 'qr', status: 'active', subscriptionStatus: 'active' },
        { tagId: 'PT-TAG-003', tagType: 'qr', status: 'active', subscriptionStatus: 'grace_period' },
        { tagId: 'PT-TAG-004', tagType: 'qr', status: 'inactive', subscriptionStatus: 'expired' },
      ]);

      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.tags.active).toBe(3);
      expect(data.tags.gracePeriod).toBe(1);
      expect(data.tags.expired).toBe(1);
      expect(data.tags.total).toBe(4);
    });

    it('should return scan count for this week', async () => {
      const { token } = await createSuperAdmin();
      const tagId = new mongoose.Types.ObjectId();
      const petId = new mongoose.Types.ObjectId();

      await FinderScan.create([
        { tagId, petId, deviceInfo: 'Chrome/Android', scannedBy: 'visitor' },
        { tagId, petId, deviceInfo: 'Safari/iOS', scannedBy: 'visitor' },
      ]);

      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.scansThisWeek).toBe(2);
    });

    it('should return reunion count for this week', async () => {
      const { token } = await createSuperAdmin();

      await Pet.create({
        name: 'Found Dog',
        ownerId: new mongoose.Types.ObjectId(),
        petType: 'Dog',
        species: 'Canine',
        breed: 'Labrador',
        color: 'Golden',
        status: 'found',
      });

      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reunionsThisWeek).toBe(1);
    });

    it('should return low stock products', async () => {
      const { token } = await createSuperAdmin();

      await Setting.create({
        key: 'lowStockThreshold',
        value: '10',
        category: 'inventory',
        description: 'Low stock alert threshold',
        updatedBy: new mongoose.Types.ObjectId(),
      });

      await Product.create([
        { name: 'Low Stock Tag', price: 9.99, stock: 3, category: 'tags', sku: 'LOW-001', description: 'Low stock' },
        { name: 'OK Stock Tag', price: 9.99, stock: 50, category: 'tags', sku: 'OK-001', description: 'OK stock' },
        { name: 'Out of Stock Tag', price: 9.99, stock: 0, category: 'tags', sku: 'OOS-001', description: 'Out of stock' },
      ]);

      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const lowStock = res.body.data.lowStockProducts;
      expect(lowStock).toHaveLength(2);
      expect(lowStock.map((p: any) => p.name)).toContain('Low Stock Tag');
      expect(lowStock.map((p: any) => p.name)).toContain('Out of Stock Tag');
    });

    it('should require admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview');

      expect(res.status).toBe(401);
    });
  });
});
