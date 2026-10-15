import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createSuperAdmin, createCustomerWithRBAC } from './helpers';
import { CmsHomepageSection, AuditEvent } from '@pawtag/db';

/**
 * Hero slide CMS contract: server-side validation (unsafe URLs, required
 * headline, duration bounds), legacy-record compatibility, publish/order
 * behavior, RBAC, the trimmed public projection, and mutation audit logging.
 */

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

const VALID_HERO = {
  sectionType: 'hero_slide',
  title: 'Hero — Pet Safety',
  content: {
    eyebrow: 'PET SAFETY, SIMPLIFIED',
    headline: "They can't tell someone where they live. Their tag can.",
    sub: 'Supporting copy.',
    ctaText: 'Shop PawTag',
    ctaUrl: '/shop',
    secondaryCtaText: 'How PawTag Works',
    secondaryCtaUrl: '/about',
    duration: 7,
    desktopImageUrl: '',
    mobileImageUrl: '',
    imageAlt: '',
    imageFocalPoint: 'center',
  },
  order: 0,
  isActive: true,
};

describe('CMS homepage hero slides — admin CRUD with validation', () => {
  let adminToken: string;

  beforeEach(async () => {
    adminToken = (await createSuperAdmin()).token;
  });

  it('creates a valid hero slide', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_HERO);

    expect(res.status).toBe(201);
    expect(res.body.data.content.eyebrow).toBe('PET SAFETY, SIMPLIFIED');
    expect(res.body.data.content.secondaryCtaUrl).toBe('/about');
    expect(res.body.data.isActive).toBe(true);
  });

  it('accepts legacy slide content (tag, visualType, imageUrl, stats)', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionType: 'hero_slide',
        title: 'Legacy Slide',
        content: {
          tag: 'Emotional',
          headline: 'Legacy headline',
          ctaText: 'Protect Your Pet',
          ctaUrl: '/shop',
          bg: 'from-primary-700 via-primary-600 to-primary-800',
          visualType: 'stats',
          stats: [{ number: '2×', label: 'Points' }],
          imageUrl: '/api/uploads/legacy.jpg',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.content.tag).toBe('Emotional');
    expect(res.body.data.content.imageUrl).toBe('/api/uploads/legacy.jpg');
  });

  it('rejects an unsafe javascript: CTA link', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...VALID_HERO,
        content: { ...VALID_HERO.content, ctaUrl: 'javascript:alert(1)' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.some((d: { field: string }) => d.field === 'content.ctaUrl')).toBe(true);
  });

  it('rejects a protocol-relative URL', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...VALID_HERO,
        content: { ...VALID_HERO.content, secondaryCtaUrl: '//evil.com' },
      });

    expect(res.status).toBe(400);
  });

  it('rejects a slide without a headline', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...VALID_HERO,
        content: { ...VALID_HERO.content, headline: '' },
      });

    expect(res.status).toBe(400);
  });

  it('rejects a duration outside 3–30 seconds', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...VALID_HERO,
        content: { ...VALID_HERO.content, duration: 2 },
      });

    expect(res.status).toBe(400);
  });

  it('accepts an external https CTA link', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...VALID_HERO,
        content: { ...VALID_HERO.content, ctaUrl: 'https://example.com/partner' },
      });

    expect(res.status).toBe(201);
  });

  it('saves and projects a separate mobile focal point', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...VALID_HERO,
        content: {
          ...VALID_HERO.content,
          imageFocalPoint: 'right',
          imageMobileFocalPoint: 'top',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.content.imageMobileFocalPoint).toBe('top');

    const pub = await request(app).get('/api/public/cms/homepage/sections?sectionType=hero_slide');
    expect(pub.body.data[0].content.imageMobileFocalPoint).toBe('top');
  });

  it('rejects an invalid mobile focal point value', async () => {
    const res = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...VALID_HERO,
        content: { ...VALID_HERO.content, imageMobileFocalPoint: 'somewhere' },
      });

    expect(res.status).toBe(400);
    expect(res.body.details.some((d: { field: string }) => d.field === 'content.imageMobileFocalPoint')).toBe(true);
  });

  it('updates a slide and validates the new content', async () => {
    const created = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_HERO);
    const id = created.body.data._id;

    const bad = await request(app)
      .put(`/api/admin/cms/homepage/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { ...VALID_HERO.content, ctaUrl: 'data:text/html,x' } });
    expect(bad.status).toBe(400);

    const good = await request(app)
      .put(`/api/admin/cms/homepage/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { ...VALID_HERO.content, headline: 'Updated headline' } });
    expect(good.status).toBe(200);
    expect(good.body.data.content.headline).toBe('Updated headline');
  });

  it('toggles publish state without deleting the record', async () => {
    const created = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_HERO);
    const id = created.body.data._id;

    const toggled = await request(app)
      .put(`/api/admin/cms/homepage/${id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(toggled.status).toBe(200);
    expect(toggled.body.data.isActive).toBe(false);
    expect(await CmsHomepageSection.countDocuments({ _id: id, deletedAt: null })).toBe(1);
  });

  it('records an audit event for hero mutations', async () => {
    await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_HERO);

    const audit = await AuditEvent.findOne({ action: 'cms_homepage_section_created' }).lean();
    expect(audit).toBeTruthy();
    expect(audit?.resourceType).toBe('CmsHomepageSection');
  });

  it('requires authentication and permissions', async () => {
    const unauth = await request(app)
      .post('/api/admin/cms/homepage')
      .send(VALID_HERO);
    expect(unauth.status).toBe(401);

    const customer = await createCustomerWithRBAC();
    const forbidden = await request(app)
      .post('/api/admin/cms/homepage')
      .set('Authorization', `Bearer ${customer.token}`)
      .send(VALID_HERO);
    expect(forbidden.status).toBe(403);
  });
});

describe('Public homepage sections endpoint', () => {
  let adminToken: string;

  beforeEach(async () => {
    adminToken = (await createSuperAdmin()).token;
  });

  it('returns active hero slides in order with internals stripped and content projected', async () => {
    await CmsHomepageSection.create({
      sectionType: 'hero_slide',
      title: 'Second',
      content: { headline: 'Second headline', junkKey: 'should not leak' },
      order: 1,
      isActive: true,
    });
    await CmsHomepageSection.create({
      sectionType: 'hero_slide',
      title: 'First',
      content: { headline: 'First headline', eyebrow: 'LABEL', duration: 9 },
      order: 0,
      isActive: true,
    });

    const res = await request(app).get('/api/public/cms/homepage/sections?sectionType=hero_slide');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].content.headline).toBe('First headline');
    // Internals never reach visitors
    expect(res.body.data[0].__v).toBeUndefined();
    expect(res.body.data[0].updatedAt).toBeUndefined();
    expect(res.body.data[0].deletedAt).toBeUndefined();
    // Unknown content keys are not projected for hero slides
    expect(res.body.data[1].content.junkKey).toBeUndefined();
  });

  it('excludes inactive and soft-deleted slides', async () => {
    await CmsHomepageSection.create({
      sectionType: 'hero_slide', title: 'Hidden', content: { headline: 'Hidden' }, order: 0, isActive: false,
    });
    await CmsHomepageSection.create({
      sectionType: 'hero_slide', title: 'Deleted', content: { headline: 'Deleted' }, order: 1, isActive: true,
      deletedAt: new Date(),
    });
    await CmsHomepageSection.create({
      sectionType: 'hero_slide', title: 'Live', content: { headline: 'Live' }, order: 2, isActive: true,
    });

    const res = await request(app).get('/api/public/cms/homepage/sections?sectionType=hero_slide');

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Live');
  });

  it('still serves non-hero section content unchanged', async () => {
    await CmsHomepageSection.create({
      sectionType: 'how_it_works', title: 'Step', content: { icon: 'Tag', title: 'Get a tag', desc: 'x' }, order: 0, isActive: true,
    });

    const res = await request(app).get('/api/public/cms/homepage/sections?sectionType=how_it_works');

    expect(res.status).toBe(200);
    expect(res.body.data[0].content.icon).toBe('Tag');
  });
});
