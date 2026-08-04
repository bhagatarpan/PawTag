import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { Product, Setting, User, Notification } from '@pawtag/db';
import { checkLowStock } from '../../packages/api/src/jobs/lowStockCheck';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Phase 19A — Low-Stock Check', () => {
  describe('checkLowStock() detection logic', () => {
    it('should return alerted=false when no products are below threshold', async () => {
      await Setting.create({
        key: 'lowStockThreshold',
        value: '5',
        category: 'inventory',
        description: 'Low stock alert threshold',
        updatedBy: new mongoose.Types.ObjectId(),
      });

      await Product.create([
        { name: 'High Stock', price: 9.99, stock: 50, category: 'tags', sku: 'HS-001', description: 'High stock product' },
        { name: 'At Threshold', price: 9.99, stock: 6, category: 'tags', sku: 'AT-001', description: 'At threshold' },
      ]);

      const result = await checkLowStock();
      expect(result.alerted).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should return alerted=true with correct count when products are below threshold', async () => {
      await Setting.create({
        key: 'lowStockThreshold',
        value: '10',
        category: 'inventory',
        description: 'Low stock alert threshold',
        updatedBy: new mongoose.Types.ObjectId(),
      });

      await Product.create([
        { name: 'Low Stock', price: 9.99, stock: 3, category: 'tags', sku: 'LS-001', description: 'Low stock' },
        { name: 'Out of Stock', price: 9.99, stock: 0, category: 'tags', sku: 'OOS-001', description: 'Out of stock' },
        { name: 'OK Stock', price: 9.99, stock: 20, category: 'tags', sku: 'OK-001', description: 'OK stock' },
      ]);

      const result = await checkLowStock();
      expect(result.alerted).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should default to threshold of 10 when no setting exists', async () => {
      await Product.create([
        { name: 'Low', price: 9.99, stock: 5, category: 'tags', sku: 'L-001', description: 'Low' },
        { name: 'OK', price: 9.99, stock: 15, category: 'tags', sku: 'OK-002', description: 'OK' },
      ]);

      const result = await checkLowStock();
      expect(result.alerted).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should create an admin notification when products are low', async () => {
      await Setting.create({
        key: 'lowStockThreshold',
        value: '5',
        category: 'inventory',
        description: 'Low stock alert threshold',
        updatedBy: new mongoose.Types.ObjectId(),
      });

      const admin = await User.create({
        email: 'admin@test.com',
        passwordHash: 'hashed_password',
        phoneNumber: '+64210000001',
        fullName: 'Admin User',
        role: 'admin',
      });

      await Product.create([
        { name: 'Critical Item', price: 19.99, stock: 1, category: 'tags', sku: 'CRIT-001', description: 'Critical' },
      ]);

      await checkLowStock();

      const notif = await Notification.findOne({ audience: 'admin', type: 'system', title: 'Low Stock Alert' });
      expect(notif).toBeTruthy();
      expect(notif!.message).toContain('Critical Item');
      expect(notif!.userId.toString()).toBe(admin._id.toString());
    });

    it('should include products at exactly the threshold', async () => {
      await Setting.create({
        key: 'lowStockThreshold',
        value: '5',
        category: 'inventory',
        description: 'Low stock alert threshold',
        updatedBy: new mongoose.Types.ObjectId(),
      });

      await Product.create([
        { name: 'Exactly At', price: 9.99, stock: 5, category: 'tags', sku: 'EA-001', description: 'Exactly at threshold' },
      ]);

      const result = await checkLowStock();
      expect(result.alerted).toBe(true);
      expect(result.count).toBe(1);
    });
  });
});
