import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { createSuperAdmin, createCustomerWithRBAC } from './helpers';
import { CmsHomepageSection } from '@pawtag/db';

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
// CMS PAGES (Admin-Protected)
// ═══════════════════════════════════════════

describe('CMS Pages - Admin CRUD', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('POST /api/admin/cms/pages creates a page', async () => {
    const res = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'about-us', title: 'About Us', description: 'About PawTag' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('about-us');
    expect(res.body.data.title).toBe('About Us');
    expect(res.body.data.status).toBe('draft');
  });

  it('POST /api/admin/cms/pages rejects missing slug/title', async () => {
    const res = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Missing required fields' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/admin/cms/pages rejects duplicate slug', async () => {
    await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'dup-page', title: 'First' });

    const res = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'dup-page', title: 'Second' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('GET /api/admin/cms/pages lists pages with pagination', async () => {
    await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'page-1', title: 'Page 1' });
    await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'page-2', title: 'Page 2' });

    const res = await request(app)
      .get('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.totalPages).toBe(1);
  });

  it('GET /api/admin/cms/pages/:id returns a specific page', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'detail-page', title: 'Detail Page' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .get(`/api/admin/cms/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('detail-page');
  });

  it('GET /api/admin/cms/pages/:id returns 404 for non-existent page', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/admin/cms/pages/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/admin/cms/pages/:id updates a page', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'update-page', title: 'Old Title' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('New Title');
  });

  it('PUT /api/admin/cms/pages/:id/publish sets status to published', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'publish-me', title: 'Publish Me' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/pages/${pageId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).toBeDefined();
  });

  it('DELETE /api/admin/cms/pages/:id soft-deletes a page', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'delete-me', title: 'Delete Me' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Page deleted');

    // Verify soft-deleted
    const page = await mongoose.connection.collections.cmspages.findOne({ _id: new mongoose.Types.ObjectId(pageId) });
    expect(page?.deletedAt).toBeDefined();
  });

  it('unauthenticated requests to admin pages return 401', async () => {
    const res = await request(app).get('/api/admin/cms/pages');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// CMS PAGES (Public)
// ═══════════════════════════════════════════

describe('CMS Pages - Public Access', () => {
  it('GET /api/public/cms/pages/:slug returns published page without auth', async () => {
    const { token } = await createSuperAdmin();

    // Create and publish a page
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'public-page', title: 'Public Page' });

    const pageId = createRes.body.data._id;
    await request(app)
      .put(`/api/admin/cms/pages/${pageId}/publish`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/public/cms/pages/public-page');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('public-page');
  });

  it('GET /api/public/cms/pages/:slug returns 404 for unpublished page', async () => {
    const { token } = await createSuperAdmin();

    await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'draft-only', title: 'Draft Page' });

    const res = await request(app).get('/api/public/cms/pages/draft-only');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/public/cms/pages/:slug returns 404 for non-existent slug', async () => {
    const res = await request(app).get('/api/public/cms/pages/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// CMS HOMEPAGE SECTIONS — TESTIMONIALS
// ═══════════════════════════════════════════

describe('CMS Testimonials (Homepage Sections)', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('POST /api/admin/cms/homepage creates a testimonial section', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionType: 'testimonial',
        title: 'Happy Customer',
        subtitle: 'What pet owners say',
        content: { quote: 'Great product!', author: 'Jane Doe' },
        order: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sectionType).toBe('testimonial');
    expect(res.body.data.title).toBe('Happy Customer');
  });

  it('POST /api/admin/cms/homepage rejects missing sectionType/title', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { quote: 'Missing fields' } });

    expect(res.status).toBe(400);
  });

  it('GET /api/admin/cms/homepage lists sections filtered by type', async () => {
    await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'testimonial', title: 'Testimonial 1' });
    await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'hero_slide', title: 'Hero Slide' });

    const res = await request(app)
      .get('/api/admin/cms/homepage?sectionType=testimonial')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sectionType).toBe('testimonial');
  });

  it('PUT /api/admin/cms/homepage/:id updates a testimonial', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'testimonial', title: 'Old Title' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/homepage/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('DELETE /api/admin/cms/homepage/:id soft-deletes a testimonial', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'testimonial', title: 'Delete Testimonial' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/homepage/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const section = await CmsHomepageSection.findOne({ _id: id });
    expect(section?.deletedAt).toBeDefined();
  });

  it('GET /api/public/cms/homepage/sections returns active testimonials publicly', async () => {
    await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'testimonial', title: 'Public Testimonial', isActive: true });

    const res = await request(app).get('/api/public/cms/homepage/sections?sectionType=testimonial');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════
// CMS HOMEPAGE SECTIONS — FAQs
// ═══════════════════════════════════════════

describe('CMS FAQs (Homepage Sections)', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('POST /api/admin/cms/homepage creates an FAQ section', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionType: 'faq',
        title: 'Frequently Asked Questions',
        content: { items: [{ q: 'What is PawTag?', a: 'A pet recovery platform.' }] },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sectionType).toBe('faq');
  });

  it('GET /api/admin/cms/homepage lists FAQ sections', async () => {
    await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'faq', title: 'FAQ 1' });
    await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'faq', title: 'FAQ 2' });

    const res = await request(app)
      .get('/api/admin/cms/homepage?sectionType=faq')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('PUT /api/admin/cms/homepage/:id updates an FAQ', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'faq', title: 'Old FAQ' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/homepage/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated FAQ' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated FAQ');
  });

  it('DELETE /api/admin/cms/homepage/:id soft-deletes an FAQ', async () => {
    const createRes = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'faq', title: 'Delete FAQ' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/homepage/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const section = await CmsHomepageSection.findOne({ _id: id });
    expect(section?.deletedAt).toBeDefined();
  });

  it('GET /api/public/cms/homepage/sections returns active FAQs publicly', async () => {
    await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectionType: 'faq', title: 'Public FAQ', isActive: true });

    const res = await request(app).get('/api/public/cms/homepage/sections?sectionType=faq');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════
// CUSTOMER NOTIFICATIONS
// ═══════════════════════════════════════════

describe('Customer Notifications', () => {
  let customerToken: string;
  let customerUserId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC();
    customerToken = customer.token;
    customerUserId = customer.userId;
  });

  it('GET /api/customer/notifications returns empty array initially', async () => {
    const res = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/customer/notifications returns user notifications', async () => {
    await mongoose.connection.collections.notifications.insertOne({
      userId: new mongoose.Types.ObjectId(customerUserId),
      audience: 'customer',
      type: 'pet_found',
      title: 'Pet Found!',
      message: 'Your pet was found by a kind stranger.',
      read: false,
      priority: 'high',
      channel: 'alert',
      data: { petId: 'test-pet-id' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('pet_found');
  });

  it('PUT /api/customer/notifications/:id/read marks notification as read', async () => {
    const notifRes = await mongoose.connection.collections.notifications.insertOne({
      userId: new mongoose.Types.ObjectId(customerUserId),
      audience: 'customer',
      type: 'order_update',
      title: 'Order Shipped',
      message: 'Your order has been shipped.',
      read: false,
      priority: 'normal',
      channel: 'info',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const notifId = notifRes.insertedId.toString();
    const res = await request(app)
      .put(`/api/customer/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await mongoose.connection.collections.notifications.findOne({ _id: new mongoose.Types.ObjectId(notifId) });
    expect(updated?.read).toBe(true);
  });

  it('GET /api/customer/notifications/unread-count returns correct count', async () => {
    await mongoose.connection.collections.notifications.insertMany([
      {
        userId: new mongoose.Types.ObjectId(customerUserId),
        audience: 'customer', type: 'pet_found', title: 'Unread 1', message: 'msg',
        read: false, priority: 'normal', channel: 'info', createdAt: new Date(), updatedAt: new Date(),
      },
      {
        userId: new mongoose.Types.ObjectId(customerUserId),
        audience: 'customer', type: 'pet_found', title: 'Unread 2', message: 'msg',
        read: false, priority: 'normal', channel: 'info', createdAt: new Date(), updatedAt: new Date(),
      },
      {
        userId: new mongoose.Types.ObjectId(customerUserId),
        audience: 'customer', type: 'pet_found', title: 'Read', message: 'msg',
        read: true, priority: 'normal', channel: 'info', createdAt: new Date(), updatedAt: new Date(),
      },
    ]);

    const res = await request(app)
      .get('/api/customer/notifications/unread-count')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });

  it('PUT /api/customer/notifications/mark-all-read marks all as read', async () => {
    await mongoose.connection.collections.notifications.insertMany([
      {
        userId: new mongoose.Types.ObjectId(customerUserId),
        audience: 'customer', type: 'pet_found', title: 'N1', message: 'msg',
        read: false, priority: 'normal', channel: 'info', createdAt: new Date(), updatedAt: new Date(),
      },
      {
        userId: new mongoose.Types.ObjectId(customerUserId),
        audience: 'customer', type: 'pet_found', title: 'N2', message: 'msg',
        read: false, priority: 'normal', channel: 'info', createdAt: new Date(), updatedAt: new Date(),
      },
    ]);

    const res = await request(app)
      .put('/api/customer/notifications/mark-all-read')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);

    const unread = await mongoose.connection.collections.notifications.countDocuments({
      userId: new mongoose.Types.ObjectId(customerUserId),
      read: false,
    });
    expect(unread).toBe(0);
  });

  it('unauthenticated requests return 401', async () => {
    const res = await request(app).get('/api/customer/notifications');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// CUSTOMER SUBSCRIPTIONS
// ═══════════════════════════════════════════

describe('Customer Subscriptions', () => {
  let customerToken: string;
  let customerUserId: string;
  let tagId: string;
  let subscriptionId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC();
    customerToken = customer.token;
    customerUserId = customer.userId;

    // Create pet
    const petRes = await mongoose.connection.collections.pets.insertOne({
      ownerId: new mongoose.Types.ObjectId(customerUserId),
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
    const petId = petRes.insertedId.toString();

    // Create tag
    const tagRes = await mongoose.connection.collections.tags.insertOne({
      tagId: 'PT-SUB-TEST',
      petId: new mongoose.Types.ObjectId(petId),
      ownerId: new mongoose.Types.ObjectId(customerUserId),
      status: 'active',
      tagType: 'qr',
      subscriptionStatus: 'none',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tagId = tagRes.insertedId.toString();

    // Create subscription
    const subRes = await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(customerUserId),
      tagId: new mongoose.Types.ObjectId(tagId),
      planName: 'Annual Plan',
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

    // Link tag to subscription
    await mongoose.connection.collections.tags.updateOne(
      { _id: new mongoose.Types.ObjectId(tagId) },
      { $set: { subscriptionStatus: 'active', subscriptionId: new mongoose.Types.ObjectId(subscriptionId) } },
    );
  });

  it('GET /api/customer/subscriptions returns user subscriptions', async () => {
    const res = await request(app)
      .get('/api/customer/subscriptions')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('active');
    expect(res.body.data[0].planType).toBe('annual');
  });

  it('GET /api/customer/subscriptions returns empty for user with no subs', async () => {
    const email = `empty-${Date.now()}@example.com`;
    const passwordHash = await (await import('bcryptjs')).hash('Password123!', 12);
    const userRes = await mongoose.connection.collections.users.insertOne({
      email, passwordHash, fullName: 'Empty User', phoneNumber: '+64210000001',
      role: 'customer', status: 'active', emailVerified: true, phoneVerified: true,
      responsibilityScore: 0, createdAt: new Date(), updatedAt: new Date(),
    });
    const otherUserId = userRes.insertedId.toString();
    const otherRoleId = new mongoose.Types.ObjectId();
    await mongoose.connection.collections.roles.insertOne({
      _id: otherRoleId, name: `CUSTOMER_EMPTY_${Date.now()}`, displayName: 'Customer Empty',
      description: 'Test', roleType: 'system', isSystemRole: true, isSuperAdmin: false,
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    await mongoose.connection.collections.userroles.insertOne({
      userId: new mongoose.Types.ObjectId(otherUserId), roleId: otherRoleId,
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    // Find existing customer.read permission (created by first createCustomerWithRBAC)
    const perm = await mongoose.connection.collections.permissions.findOne({ name: 'customer.read' });
    if (perm) {
      await mongoose.connection.collections.rolepermissions.insertOne({
        roleId: otherRoleId, permissionId: perm._id, createdAt: new Date(), updatedAt: new Date(),
      });
    }

    const otherToken = jwt.sign({ id: otherUserId, email, role: 'customer' }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/customer/subscriptions')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/customer/subscriptions/:id returns subscription detail', async () => {
    const res = await request(app)
      .get(`/api/customer/subscriptions/${subscriptionId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.planName).toBe('Annual Plan');
    expect(res.body.data.status).toBe('active');
  });

  it('GET /api/customer/subscriptions/:id returns 404 for non-existent', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/customer/subscriptions/${fakeId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/customer/subscriptions/:id returns 404 for other users subscription', async () => {
    const email = `other-${Date.now()}@example.com`;
    const passwordHash = await (await import('bcryptjs')).hash('Password123!', 12);
    const userRes = await mongoose.connection.collections.users.insertOne({
      email, passwordHash, fullName: 'Other User', phoneNumber: '+64210000002',
      role: 'customer', status: 'active', emailVerified: true, phoneVerified: true,
      responsibilityScore: 0, createdAt: new Date(), updatedAt: new Date(),
    });
    const otherUserId = userRes.insertedId.toString();
    const otherRoleId = new mongoose.Types.ObjectId();
    await mongoose.connection.collections.roles.insertOne({
      _id: otherRoleId, name: `CUSTOMER_OTHER_${Date.now()}`, displayName: 'Customer Other',
      description: 'Test', roleType: 'system', isSystemRole: true, isSuperAdmin: false,
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    await mongoose.connection.collections.userroles.insertOne({
      userId: new mongoose.Types.ObjectId(otherUserId), roleId: otherRoleId,
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });
    const perm = await mongoose.connection.collections.permissions.findOne({ name: 'customer.read' });
    if (perm) {
      await mongoose.connection.collections.rolepermissions.insertOne({
        roleId: otherRoleId, permissionId: perm._id, createdAt: new Date(), updatedAt: new Date(),
      });
    }

    const otherToken = jwt.sign({ id: otherUserId, email, role: 'customer' }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(app)
      .get(`/api/customer/subscriptions/${subscriptionId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('unauthenticated requests return 401', async () => {
    const res = await request(app).get('/api/customer/subscriptions');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// ADMIN SUBSCRIPTIONS
// ═══════════════════════════════════════════

describe('Admin Subscriptions', () => {
  let adminToken: string;
  let adminUserId: string;
  let customerUserId: string;
  let tagId: string;
  let subscriptionId: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
    adminUserId = admin.userId;

    // Create a customer
    const customer = await createCustomerWithRBAC({ email: 'sub-customer@example.com' });
    customerUserId = customer.userId;

    // Create pet
    const petRes = await mongoose.connection.collections.pets.insertOne({
      ownerId: new mongoose.Types.ObjectId(customerUserId),
      petId: 'PET-ADMIN-SUB',
      name: 'Rex',
      species: 'dog',
      breed: 'German Shepherd',
      color: 'Black',
      gender: 'male',
      status: 'safe',
      lostCount: 0,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const petId = petRes.insertedId.toString();

    // Create tag
    const tagRes = await mongoose.connection.collections.tags.insertOne({
      tagId: 'PT-ADMIN-SUB',
      petId: new mongoose.Types.ObjectId(petId),
      ownerId: new mongoose.Types.ObjectId(customerUserId),
      status: 'active',
      tagType: 'qr',
      subscriptionStatus: 'active',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tagId = tagRes.insertedId.toString();

    // Create subscription
    const subRes = await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(customerUserId),
      tagId: new mongoose.Types.ObjectId(tagId),
      planName: 'Annual Plan',
      planType: 'annual',
      status: 'active',
      price: 0.99,
      currency: 'NZD',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      renewalMethod: 'annual',
      totalScans: 5,
      reminderStates: { graceWeeklySentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    subscriptionId = subRes.insertedId.toString();
  });

  it('GET /api/admin/subscriptions lists all subscriptions', async () => {
    const res = await request(app)
      .get('/api/admin/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('GET /api/admin/subscriptions filters by status', async () => {
    const res = await request(app)
      .get('/api/admin/subscriptions?status=active')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('GET /api/admin/subscriptions/:id returns subscription detail with invoices', async () => {
    const res = await request(app)
      .get(`/api/admin/subscriptions/${subscriptionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.subscription).toBeDefined();
    expect(res.body.data.subscription.planName).toBe('Annual Plan');
    expect(res.body.data.invoices).toBeDefined();
  });

  it('GET /api/admin/subscriptions/:id returns 404 for non-existent', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/admin/subscriptions/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/subscriptions/:id/status updates subscription status', async () => {
    const res = await request(app)
      .put(`/api/admin/subscriptions/${subscriptionId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'expired', reason: 'Testing expiry' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('expired');
    expect(res.body.message).toMatch(/expired/);
  });

  it('PUT /api/admin/subscriptions/:id/status rejects invalid status', async () => {
    const res = await request(app)
      .put(`/api/admin/subscriptions/${subscriptionId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
  });

  it('POST /api/admin/subscriptions/:id/extend extends subscription', async () => {
    const subBefore = await mongoose.connection.collections.subscriptions.findOne({ _id: new mongoose.Types.ObjectId(subscriptionId) });
    const endBefore = subBefore?.currentPeriodEnd;

    const res = await request(app)
      .post(`/api/admin/subscriptions/${subscriptionId}/extend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ days: 30, reason: 'Customer support' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.message).toMatch(/30 days/);

    const subAfter = await mongoose.connection.collections.subscriptions.findOne({ _id: new mongoose.Types.ObjectId(subscriptionId) });
    expect(new Date(subAfter!.currentPeriodEnd).getTime()).toBeGreaterThan(new Date(endBefore!).getTime());
  });

  it('POST /api/admin/subscriptions/:id/extend rejects invalid days', async () => {
    const res = await request(app)
      .post(`/api/admin/subscriptions/${subscriptionId}/extend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ days: 0 });

    expect(res.status).toBe(400);
  });

  it('unauthenticated requests return 401', async () => {
    const res = await request(app).get('/api/admin/subscriptions');
    expect(res.status).toBe(401);
  });
});
