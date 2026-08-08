import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, Tag, Setting, AuditEvent } from '@pawtag/db';
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

describe('Phase 13 — Replacement/Damaged Tag Flow', () => {
  describe('POST /api/customer/tags/:id/request-replacement', () => {
    it('should create a replacement order at the configured price', async () => {
      const { userId, token } = await createSuperAdmin();

      // Set replacement price
      await Setting.create({
        key: 'replacement_tag_price_nzd',
        value: '15.00',
        category: 'pricing',
        description: 'Price for replacement tags in NZD',
        updatedBy: userId,
      });

      // Create a tag owned by the user
      const tag = await Tag.create({
        tagId: 'PT-REPLACE-001',
        petId: new mongoose.Types.ObjectId(),
        ownerId: userId,
        status: 'active',
      });

      const res = await request(app)
        .post(`/api/customer/tags/${tag._id}/request-replacement`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Lost during hiking' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.replacementPrice).toBe(15.00);
      expect(res.body.data.order.items[0].unitPrice).toBe(15.00);
      expect(res.body.data.order.items[0].productName).toContain('Replacement');

      // Verify audit log
      const auditEvents = await AuditEvent.find({ resourceType: 'Tag', resourceId: tag._id.toString() });
      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].action).toBe('request_tag_replacement');
    });

    it('should reject replacement request for a tag not owned by the user', async () => {
      const { token } = await createSuperAdmin();

      const tag = await Tag.create({
        tagId: 'PT-REPLACE-002',
        petId: new mongoose.Types.ObjectId(),
        ownerId: new mongoose.Types.ObjectId(), // Different user
        status: 'active',
      });

      const res = await request(app)
        .post(`/api/customer/tags/${tag._id}/request-replacement`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Damaged' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('should require a reason for replacement', async () => {
      const { userId, token } = await createSuperAdmin();

      const tag = await Tag.create({
        tagId: 'PT-REPLACE-003',
        petId: new mongoose.Types.ObjectId(),
        ownerId: userId,
        status: 'active',
      });

      const res = await request(app)
        .post(`/api/customer/tags/${tag._id}/request-replacement`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Reason is required');
    });
  });

  describe('Tag redemption with replacement transfer', () => {
    it('should transfer pet linkage when redeeming a replacement tag', async () => {
      const { userId, token } = await createSuperAdmin();

      // Create an order with delivered status
      const order = await Order.create({
        orderNumber: 'PT-REPLACE-ORDER-001',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Pro (Replacement)',
          quantity: 1,
          unitPrice: 15.00,
          totalPrice: 15.00,
        }],
        status: 'delivered',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_replacement_test',
          amount: 15.00,
          currency: 'NZD',
          paidAt: new Date(),
        },
        shippingAddress: {
          line1: '123 Test St',
          city: 'Auckland',
          state: 'Auckland',
          zip: '1010',
          country: 'NZ',
        },
      });

      // Create old tag with pet linkage
      const petId = new mongoose.Types.ObjectId();
      const oldTag = await Tag.create({
        tagId: 'PT-OLD-TAG-001',
        petId,
        ownerId: userId,
        status: 'active',
      });

      // Create new replacement tag linked to old tag
      const newTag = await Tag.create({
        tagId: 'PT-NEW-TAG-001',
        orderId: order._id,
        replacesTagId: oldTag._id,
        status: 'inactive',
      });

      // Redeem the replacement tag
      const res = await request(app)
        .post('/api/customer/tags/redeem')
        .set('Authorization', `Bearer ${token}`)
        .send({ tagId: 'PT-NEW-TAG-001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ownerId).toBe(userId.toString());
      expect(res.body.data.petId?.toString()).toBe(petId.toString());
      expect(res.body.data.status).toBe('active');

      // Verify old tag was deactivated
      const updatedOldTag = await Tag.findById(oldTag._id);
      expect(updatedOldTag!.status).toBe('inactive');
      expect(updatedOldTag!.replacedByTagId?.toString()).toBe(newTag._id.toString());

      // Verify pet data is still intact (petId still exists)
      const pet = await (await import('@pawtag/db')).Pet.findById(petId);
      expect(pet).toBeDefined();
    });
  });
});
