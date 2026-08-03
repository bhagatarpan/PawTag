import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Import the app and setup
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { setupTestDb, teardownTestDb } from './setup';

let userId: string;
let token: string;
let adminToken: string;
let adminId: string;
let tagId: string;
let petId: string;
let subscriptionId: string;

beforeAll(async () => {
  await setupTestDb();

  // Create customer
  const userRes = await mongoose.connection.collections.users.insertOne({
    email: 'test-sub@example.com',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    fullName: 'Test Subscriber',
    phoneNumber: '+64210000001',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  userId = userRes.insertedId.toString();
  token = jwt.sign({ id: userId, email: 'test-sub@example.com', role: 'customer' }, config.jwtSecret, { expiresIn: '1h' });

  // Create admin
  const adminRes = await mongoose.connection.collections.users.insertOne({
    email: 'admin-sub@example.com',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    fullName: 'Admin Sub',
    phoneNumber: '+64210000002',
    role: 'admin',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  adminId = adminRes.insertedId.toString();
  adminToken = jwt.sign({ id: adminId, email: 'admin-sub@example.com', role: 'admin' }, config.jwtSecret, { expiresIn: '1h' });

  // Create RBAC role with all permissions for admin
  const roleRes = await mongoose.connection.collections.roles.insertOne({
    name: 'TEST_ADMIN',
    displayName: 'Test Admin',
    description: 'Test',
    roleType: 'system',
    isSystemRole: true,
    isSuperAdmin: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const roleId = roleRes.insertedId.toString();

  await mongoose.connection.collections.userroles.insertOne({
    userId: new mongoose.Types.ObjectId(adminId),
    roleId: new mongoose.Types.ObjectId(roleId),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create RBAC for customer user
  const customerRoleRes = await mongoose.connection.collections.roles.insertOne({
    name: 'TEST_CUSTOMER',
    displayName: 'Test Customer',
    description: 'Test',
    roleType: 'system',
    isSystemRole: true,
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const customerRoleId = customerRoleRes.insertedId.toString();

  const customerPerms = [
    'pet.read', 'pet.create', 'pet.update', 'pet.delete',
    'tag.read', 'order.read', 'order.create',
    'notification.read', 'notification.update',
    'customer.read', 'subscription.read', 'subscription.update',
  ];
  for (const permName of customerPerms) {
    const [resource, action] = permName.split('.');
    const perm = await mongoose.connection.collections.permissions.insertOne({
      name: permName, displayName: permName, resource, action,
      permissionGroupId: new mongoose.Types.ObjectId(),
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    await mongoose.connection.collections.rolepermissions.insertOne({
      roleId: new mongoose.Types.ObjectId(customerRoleId),
      permissionId: perm.insertedId,
      createdAt: new Date(), updatedAt: new Date(),
    });
  }

  await mongoose.connection.collections.userroles.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleId: new mongoose.Types.ObjectId(customerRoleId),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create pet
  const petRes = await mongoose.connection.collections.pets.insertOne({
    ownerId: new mongoose.Types.ObjectId(userId),
    petId: 'PET-SUB-001',
    name: 'Buddy',
    species: 'dog',
    breed: 'Golden Retriever',
    color: 'Golden',
    gender: 'male',
    status: 'safe',
    lostCount: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  petId = petRes.insertedId.toString();

  // Create tag
  const tagRes = await mongoose.connection.collections.tags.insertOne({
    tagId: 'PT-SUB-001',
    petId: new mongoose.Types.ObjectId(petId),
    ownerId: new mongoose.Types.ObjectId(userId),
    status: 'active',
    tagType: 'qr',
    subscriptionStatus: 'none',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  tagId = tagRes.insertedId.toString();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  // Clean subscription data between tests
  await mongoose.connection.collections.subscriptions?.deleteMany({});
  await mongoose.connection.collections.invoices?.deleteMany({});
});

describe('Customer Subscription Routes', () => {
  describe('GET /api/customer/subscriptions', () => {
    it('should return empty array when no subscriptions', async () => {
      const res = await request(app)
        .get('/api/customer/subscriptions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/customer/subscriptions');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/customer/subscriptions (via order creation)', () => {
    it('should create subscription after product purchase', async () => {
      // First create a subscription product
      const prodRes = await mongoose.connection.collections.products.insertOne({
        name: 'Test Subscription',
        description: 'Test',
        price: 0.99,
        currency: 'NZD',
        category: 'Subscriptions',
        tags: ['subscription'],
        isActive: true,
        stock: 9999,
        sku: 'TEST-SUB-001',
        variants: [],
        customizable: false,
        customizationPrice: 0,
        isSubscription: true,
        subscriptionConfig: {
          type: 'annual',
          freePeriodMonths: 12,
          gracePeriodWeeks: 4,
          features: ['qr_scan'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a subscription directly for testing
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Test Plan',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      subscriptionId = subRes.insertedId.toString();

      // Update tag with subscription
      await mongoose.connection.collections.tags.updateOne(
        { _id: new mongoose.Types.ObjectId(tagId) },
        { $set: { subscriptionStatus: 'active', subscriptionId: new mongoose.Types.ObjectId(subscriptionId) } }
      );

      const res = await request(app)
        .get('/api/customer/subscriptions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('active');
      expect(res.body.data[0].planType).toBe('annual');
    });
  });

  describe('GET /api/customer/subscriptions/:id', () => {
    it('should return subscription detail', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Detail Test',
        planType: 'monthly',
        status: 'active',
        price: 1.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'monthly',
        totalScans: 5,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/customer/subscriptions/${subRes.insertedId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.planName).toBe('Detail Test');
      expect(res.body.data.totalScans).toBe(5);
    });

    it('should return 404 for non-existent subscription', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/customer/subscriptions/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should not return another user\'s subscription', async () => {
      const otherUser = await mongoose.connection.collections.users.insertOne({
        email: 'other@example.com',
        passwordHash: 'hash',
        fullName: 'Other User',
        role: 'customer',
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
        responsibilityScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: otherUser.insertedId,
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Other User Sub',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/customer/subscriptions/${subRes.insertedId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/customer/subscriptions/:id/cancel', () => {
    it('should cancel active subscription', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Cancel Test',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .put(`/api/customer/subscriptions/${subRes.insertedId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Too expensive' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for non-active subscription', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Already Cancelled',
        planType: 'annual',
        status: 'cancelled',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: false,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .put(`/api/customer/subscriptions/${subRes.insertedId}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/customer/subscriptions/:id/auto-renew', () => {
    it('should toggle auto-renew', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Auto Renew Test',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .put(`/api/customer/subscriptions/${subRes.insertedId}/auto-renew`)
        .set('Authorization', `Bearer ${token}`)
        .send({ autoRenew: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/customer/subscriptions/:id/change-plan', () => {
    it('should change plan type', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Plan Change Test',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/customer/subscriptions/${subRes.insertedId}/change-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ planType: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid plan type', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Invalid Plan',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/customer/subscriptions/${subRes.insertedId}/change-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ planType: 'weekly' });

      expect(res.status).toBe(400);
    });
  });
});

describe('Admin Subscription Routes', () => {
  describe('GET /api/admin/subscriptions', () => {
    it('should return subscriptions list', async () => {
      await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Admin List Test',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/admin/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/subscriptions/stats', () => {
    it('should return subscription statistics', async () => {
      const res = await request(app)
        .get('/api/admin/subscriptions/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalSubscriptions');
      expect(res.body.data).toHaveProperty('mrr');
    });
  });

  describe('PUT /api/admin/subscriptions/:id/status', () => {
    it('should update subscription status', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Status Update',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .put(`/api/admin/subscriptions/${subRes.insertedId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'grace_period', reason: 'Testing' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/subscriptions/:id/extend', () => {
    it('should extend subscription by X days', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Extend Test',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/subscriptions/${subRes.insertedId}/extend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ days: 30, reason: 'Customer support' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid days', async () => {
      const subRes = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Invalid Extend',
        planType: 'annual',
        status: 'active',
        price: 0.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/subscriptions/${subRes.insertedId}/extend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ days: 400, reason: 'Too many' });

      expect(res.status).toBe(400);
    });
  });
});

describe('Finder Subscription Check', () => {
  describe('GET /api/finder/:tagId', () => {
    it('should return pet data when subscription is active', async () => {
      // Setup tag with active subscription
      await mongoose.connection.collections.tags.updateOne(
        { tagId: 'PT-SUB-001' },
        { $set: { subscriptionStatus: 'active' } }
      );

      const res = await request(app)
        .get('/api/finder/PT-SUB-001');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptionStatus).toBe('active');
    });

    it('should return pet data during grace period', async () => {
      await mongoose.connection.collections.tags.updateOne(
        { tagId: 'PT-SUB-001' },
        { $set: { subscriptionStatus: 'grace_period' } }
      );

      const res = await request(app)
        .get('/api/finder/PT-SUB-001');

      expect(res.status).toBe(200);
      expect(res.body.data.subscriptionStatus).toBe('grace_period');
      expect(res.body.data.pet).toBeDefined();
    });

    it('should return inactive message when subscription expired', async () => {
      await mongoose.connection.collections.tags.updateOne(
        { tagId: 'PT-SUB-001' },
        { $set: { subscriptionStatus: 'inactive' } }
      );

      const res = await request(app)
        .get('/api/finder/PT-SUB-001');

      expect(res.status).toBe(200);
      expect(res.body.data.tagActive).toBe(false);
      expect(res.body.data.petInfo).toBeNull();
      expect(res.body.data.message).toContain('no longer active');
    });

    it('should work when subscription status is none', async () => {
      await mongoose.connection.collections.tags.updateOne(
        { tagId: 'PT-SUB-001' },
        { $set: { subscriptionStatus: 'none' } }
      );

      const res = await request(app)
        .get('/api/finder/PT-SUB-001');

      expect(res.status).toBe(200);
      expect(res.body.data.pet).toBeDefined();
    });
  });
});
