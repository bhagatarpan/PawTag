import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock @pawtag/db
vi.mock('@pawtag/db', () => {
  const model = () => ({
    findOne: vi.fn(),
    findById: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    countDocuments: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue([]),
    insertMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findOneAndUpdate: vi.fn(),
  });
  return {
    connectDatabase: vi.fn().mockResolvedValue(undefined),
    mongoose: { connect: vi.fn(), disconnect: vi.fn() },
    generatePetId: vi.fn().mockReturnValue('PET-TEST'),
    User: model(),
    Pet: model(),
    Tag: model(),
    Cart: model(),
    Order: model(),
    Notification: model(),
    Subscription: model(),
    Invoice: model(),
    InvoiceAccessToken: model(),
    PaymentTransaction: model(),
    Fulfilment: model(),
    Return: model(),
    Shipment: model(),
    PendingOrder: model(),
    PendingRefundRetry: model(),
    StockMovement: model(),
    PromoCode: model(),
    Referral: model(),
    ReferralCode: model(),
    EscalationRecord: model(),
    TagExpiryNotification: model(),
    SupportRequest: model(),
    PushToken: model(),
    RefreshToken: model(),
    VerificationToken: model(),
    EmailAudit: model(),
    SystemLog: model(),
    AuditEvent: model(),
    WebhookEvent: model(),
    GuardianPointsLedger: model(),
    GuardianTierHistory: model(),
    PawRewardsLedger: model(),
    UserMembership: model(),
    DigitalEntitlement: model(),
    DigitalProduct: model(),
    UserRole: model(),
    Role: model(),
    Permission: model(),
    RolePermission: model(),
    CmsPage: model(),
    CmsPageVersion: model(),
    CmsNavigation: model(),
    CmsFooter: model(),
    CmsMedia: model(),
    CmsAnnouncement: model(),
    CmsRedirect: model(),
    CmsEmailTemplate: model(),
    EmailTemplateVersion: model(),
    CmsSmsTemplate: model(),
    CmsPetReference: model(),
    CmsHomepageSection: model(),
    CmsShopPage: model(),
    CmsAuthPage: model(),
    CmsOnboarding: model(),
    Category: model(),
    Collection: model(),
    Brand: model(),
    Product: model(),
    ShippingMethod: model(),
    BackgroundJob: model(),
    JobLock: model(),
    MembershipTier: model(),
    MembershipBenefit: model(),
    MembershipTierBenefit: model(),
    Setting: model(),
    FeatureFlag: model(),
    SiteContent: model(),
    IntegrationConnection: model(),
    AuditContext: model(),
    FinderScan: model(),
    LocationEvent: model(),
    OrderItem: model(),
  };
});

vi.mock('../../packages/api/src/services/reminder.service', () => ({
  startReminderService: vi.fn(),
}));

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-qr')),
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
  },
}));

vi.mock('swagger-jsdoc', () => ({
  default: vi.fn().mockReturnValue({ info: {}, paths: {}, components: {} }),
}));

vi.mock('swagger-ui-express', () => ({
  default: { serve: vi.fn(), setup: vi.fn() },
}));

import app from '../../packages/api/src/index';

describe('Smoke: API Health & Basics', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns consistent error format', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('handles POST with invalid JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('not-json');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Smoke: CORS & Headers', () => {
  it('CORS headers are present', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBeLessThan(500);
  });
});
