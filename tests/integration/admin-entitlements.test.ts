import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { AuditEvent, MembershipTierBenefit } from '@pawtag/db';
import { createSuperAdmin } from './helpers';

/**
 * Admin entitlements CRUD (localhost:3001/membership/entitlements).
 *
 * Regression: every mutation used to 500 because the hand-rolled
 * AuditEvent.create omitted required fields (eventType/eventCategory/
 * operationType/actorType) — the ValidationError failed the whole save AFTER
 * the row itself had been written. Mutations now go through auditService.log
 * (canonical payload, request-derived context).
 */

beforeAll(async () => {
  await setupTestDb();
}, 30000);
afterAll(async () => {
  await teardownTestDb();
}, 10000);
beforeEach(async () => {
  await clearDb();
  // Paid-tier contexts require a MembershipTier doc (activation does not)
  await mongoose.connection.collections.membershiptiers.insertOne({
    tier: 'gold',
    displayName: 'Gold',
    price: 19.99,
    currency: 'NZD',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

async function auditCountFor(resourceId: string) {
  return AuditEvent.countDocuments({ resourceId });
}

describe('PUT /api/admin/entitlements/tiers/:tier/:benefitKey', () => {
  it('saves the cell AND records a complete audit event (the founder-reported 500)', async () => {
    const admin = await createSuperAdmin();

    // Exactly the call that returned 500: gold × tag_limit
    const res = await request(app)
      .put('/api/admin/entitlements/tiers/gold/tag_limit')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ enabled: true, value: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Row persisted
    const row = await MembershipTierBenefit.findOne({ tier: 'gold', benefitKey: 'tag_limit' });
    expect(row).toBeTruthy();
    expect(row!.value).toBe(5);
    expect(row!.enabled).toBe(true);

    // Audit event exists with the fields the model REQUIRES
    expect(await auditCountFor('gold:tag_limit')).toBe(1);
    const audit = await AuditEvent.findOne({ resourceId: 'gold:tag_limit' });
    expect(audit!.eventType).toBe('entitlement.tier_benefit_updated');
    expect(audit!.eventCategory).toBe('CONFIG');
    expect(audit!.operationType).toBe('UPDATE');
    expect(audit!.actorType).toBeTruthy();
    expect(audit!.metadata.value).toBe(5);
  });

  it('accepts the activation pseudo-tier through the same path', async () => {
    const admin = await createSuperAdmin();

    const res = await request(app)
      .put('/api/admin/entitlements/tiers/activation/pet_health_records')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ enabled: true, value: true });

    expect(res.status).toBe(200);
    const row = await MembershipTierBenefit.findOne({ tier: 'activation', benefitKey: 'pet_health_records' });
    expect(row!.value).toBe(true);
  });

  it('rejects unknown tier contexts with 400 (no write, no audit)', async () => {
    const admin = await createSuperAdmin();

    const res = await request(app)
      .put('/api/admin/entitlements/tiers/platinum-plus/tag_limit')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ enabled: true, value: 1 });

    expect(res.status).toBe(400);
    expect(await auditCountFor('platinum-plus:tag_limit')).toBe(0);
  });
});

describe('bulk tier PUT and benefit CRUD', () => {
  it('bulk-updates a tier with audit', async () => {
    const admin = await createSuperAdmin();

    const res = await request(app)
      .put('/api/admin/entitlements/tiers/gold')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ benefits: { tag_limit: { enabled: true, value: 7 } } });

    expect(res.status).toBe(200);
    const row = await MembershipTierBenefit.findOne({ tier: 'gold', benefitKey: 'tag_limit' });
    expect(row!.value).toBe(7);
    expect(await auditCountFor('tier:gold')).toBe(1);
  });

  it('creates then deletes a benefit with audits (full CRUD, no 500s)', async () => {
    const admin = await createSuperAdmin();

    const created = await request(app)
      .post('/api/admin/entitlements/benefits')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        key: 'tmp_test_benefit',
        name: 'Temp Test Benefit',
        type: 'boolean',
        category: 'general',
        defaultValue: false,
      });
    expect(created.status).toBe(201);
    expect(await auditCountFor('tmp_test_benefit')).toBe(1);

    // Activation column cell for the new benefit is auto-created (disabled)
    const activationCell = await MembershipTierBenefit
      .findOne({ benefitKey: 'tmp_test_benefit', tier: 'activation' });
    expect(activationCell).toBeTruthy();
    expect(activationCell!.enabled).toBe(false);

    const deleted = await request(app)
      .delete('/api/admin/entitlements/benefits/tmp_test_benefit')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleted.status).toBe(200);

    const audit = await AuditEvent.findOne({ resourceId: 'tmp_test_benefit', action: 'DELETE' });
    expect(audit).toBeTruthy();
    expect(audit!.severity).toBe('HIGH');
  });
});
