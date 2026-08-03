import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
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

// ═══════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════

describe('Integration: CMS Admin - Pages', () => {
  it('GET /api/admin/cms/pages returns empty array initially', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .get('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
  });

  it('POST /api/admin/cms/pages creates a page', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'about-us',
        title: 'About Us',
        description: 'Learn about PawTag',
        template: 'default',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('about-us');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.version).toBe(1);
  });

  it('POST /api/admin/cms/pages rejects missing slug/title', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No slug or title' });

    expect(res.status).toBe(400);
  });

  it('POST /api/admin/cms/pages rejects duplicate slug', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'about', title: 'About' });

    const res = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'about', title: 'About 2' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('GET /api/admin/cms/pages/:id returns specific page', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'contact', title: 'Contact' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .get(`/api/admin/cms/pages/${pageId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('contact');
  });

  it('PUT /api/admin/cms/pages/:id updates a page', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'faq', title: 'FAQ' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/pages/${pageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Frequently Asked Questions' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Frequently Asked Questions');
  });

  it('PUT /api/admin/cms/pages/:id/publish publishes a page', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'terms', title: 'Terms' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/pages/${pageId}/publish`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).toBeDefined();
  });

  it('DELETE /api/admin/cms/pages/:id soft-deletes a page', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'delete-me', title: 'Delete Me' });

    const pageId = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/pages/${pageId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Page deleted');

    const page = await mongoose.connection.collections.cmspages.findOne({ _id: new mongoose.Types.ObjectId(pageId) });
    expect(page?.deletedAt).toBeDefined();
  });

  it('GET /api/admin/cms/pages/:id/versions returns version history', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'versioned', title: 'Versioned' });

    const pageId = createRes.body.data._id;

    await request(app)
      .put(`/api/admin/cms/pages/${pageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Versioned Updated' });

    const res = await request(app)
      .get(`/api/admin/cms/pages/${pageId}/versions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('unauthenticated requests return 401', async () => {
    const res = await request(app).get('/api/admin/cms/pages');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════

describe('Integration: CMS Admin - Navigation', () => {
  it('POST /api/admin/cms/navigation creates navigation', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/navigation')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Main Nav',
        slug: 'main-nav',
        location: 'header',
        items: [
          { label: 'Home', url: '/', order: 0 },
          { label: 'Shop', url: '/shop', order: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Main Nav');
    expect(res.body.data.location).toBe('header');
  });

  it('POST /api/admin/cms/navigation rejects missing required fields', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/navigation')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nav' });

    expect(res.status).toBe(400);
  });

  it('GET /api/admin/cms/navigation returns all navigations', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/navigation')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Header', slug: 'header-nav', location: 'header' });

    const res = await request(app)
      .get('/api/admin/cms/navigation')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('PUT /api/admin/cms/navigation/:id updates navigation', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/navigation')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Footer Nav', slug: 'footer-nav', location: 'footer' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/navigation/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Footer' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Footer');
  });

  it('DELETE /api/admin/cms/navigation/:id soft-deletes navigation', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/navigation')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Delete Nav', slug: 'delete-nav', location: 'header' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/navigation/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Navigation deleted');
  });
});

// ═══════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════

describe('Integration: CMS Admin - Footer', () => {
  it('POST /api/admin/cms/footer creates footer', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/footer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Main Footer',
        copyright: '2026 PawTag',
        groups: [{ title: 'Links', links: [{ label: 'Home', url: '/', visible: true, order: 0 }] }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Main Footer');
  });

  it('POST /api/admin/cms/footer rejects missing name', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/footer')
      .set('Authorization', `Bearer ${token}`)
      .send({ copyright: '2026' });

    expect(res.status).toBe(400);
  });

  it('GET /api/admin/cms/footer returns all footers', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/footer')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Footer 1' });

    const res = await request(app)
      .get('/api/admin/cms/footer')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('PUT /api/admin/cms/footer/:id updates footer', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/footer')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Footer' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/footer/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Footer' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Footer');
  });

  it('DELETE /api/admin/cms/footer/:id soft-deletes footer', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/footer')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Delete Footer' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/footer/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Footer deleted');
  });
});

// ═══════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════

describe('Integration: CMS Admin - Announcements', () => {
  it('POST /api/admin/cms/announcements creates announcement', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Sale!',
        message: '50% off all tags',
        type: 'banner',
        priority: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Sale!');
    expect(res.body.data.type).toBe('banner');
  });

  it('POST /api/admin/cms/announcements rejects missing fields', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Incomplete' });

    expect(res.status).toBe(400);
  });

  it('GET /api/admin/cms/announcements returns paginated results', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Announce 1', message: 'Message 1', type: 'banner' });

    const res = await request(app)
      .get('/api/admin/cms/announcements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('PUT /api/admin/cms/announcements/:id updates announcement', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Old', message: 'Old msg', type: 'banner' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/announcements/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated');
  });

  it('DELETE /api/admin/cms/announcements/:id soft-deletes', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Delete Me', message: 'Bye', type: 'banner' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/announcements/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Announcement deleted');
  });
});

// ═══════════════════════════════════════════
// REDIRECTS
// ═══════════════════════════════════════════

describe('Integration: CMS Admin - Redirects', () => {
  it('POST /api/admin/cms/redirects creates redirect', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        from: '/old-page',
        to: '/new-page',
        type: 'permanent',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.from).toBe('/old-page');
    expect(res.body.data.to).toBe('/new-page');
  });

  it('POST /api/admin/cms/redirects rejects missing from/to', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '/old' });

    expect(res.status).toBe(400);
  });

  it('POST /api/admin/cms/redirects rejects duplicate from path', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '/dup', to: '/a' });

    const res = await request(app)
      .post('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '/dup', to: '/b' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('GET /api/admin/cms/redirects returns paginated results', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '/r1', to: '/r2' });

    const res = await request(app)
      .get('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('PUT /api/admin/cms/redirects/:id updates redirect', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '/old', to: '/new' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .put(`/api/admin/cms/redirects/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ to: '/updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.to).toBe('/updated');
  });

  it('DELETE /api/admin/cms/redirects/:id soft-deletes redirect', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post('/api/admin/cms/redirects')
      .set('Authorization', `Bearer ${token}`)
      .send({ from: '/del', to: '/dest' });

    const id = createRes.body.data._id;
    const res = await request(app)
      .delete(`/api/admin/cms/redirects/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Redirect deleted');
  });
});

// ═══════════════════════════════════════════
// MEDIA
// ═══════════════════════════════════════════

describe('Integration: CMS Admin - Media', () => {
  it('GET /api/admin/cms/media returns empty array initially', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .get('/api/admin/cms/media')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('GET /api/admin/cms/media/:id returns 404 for non-existent', async () => {
    const { token } = await createSuperAdmin();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/admin/cms/media/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/cms/media/:id returns 404 for non-existent', async () => {
    const { token } = await createSuperAdmin();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .put(`/api/admin/cms/media/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ alt: 'Updated alt' });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/admin/cms/media/:id returns 404 for non-existent', async () => {
    const { token } = await createSuperAdmin();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .delete(`/api/admin/cms/media/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// CMS PUBLIC ROUTES
// ═══════════════════════════════════════════

describe('Integration: CMS Public Routes', () => {
  it('GET /api/public/cms/pages/:slug returns published page by slug', async () => {
    const { token } = await createSuperAdmin();

    const createRes = await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'public-terms', title: 'Terms' });

    const pageId = createRes.body.data._id;
    await request(app)
      .put(`/api/admin/cms/pages/${pageId}/publish`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/public/cms/pages/public-terms');

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('public-terms');
  });

  it('GET /api/public/cms/pages/:slug returns 404 for unpublished page', async () => {
    const { token } = await createSuperAdmin();

    await request(app)
      .post('/api/admin/cms/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'draft-page', title: 'Draft' });

    const res = await request(app).get('/api/public/cms/pages/draft-page');

    expect(res.status).toBe(404);
  });

  it('GET /api/public/cms/footer returns published footers', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/footer')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Public Footer', status: 'published' });

    const res = await request(app).get('/api/public/cms/footer');

    expect(res.status).toBe(200);
  });

  it('GET /api/public/cms/announcements returns active announcements', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/cms/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Public Announce', message: 'Hello!', type: 'banner', status: 'published' });

    const res = await request(app).get('/api/public/cms/announcements');

    expect(res.status).toBe(200);
  });
});
