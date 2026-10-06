import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';

const WEBHOOK_SECRET = 'whsec_resend_test_secret';

function signResend(payload: string, secret: string) {
  const svixId = 'msg_test_123';
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedContent).digest('base64');
  return {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': `v1,${signature}`,
  };
}

describe('Integration: Resend Webhook Signature + Route', () => {
  beforeAll(async () => {
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    await setupTestDb();
  }, 30000);

  afterAll(async () => {
    await teardownTestDb();
    delete process.env.RESEND_WEBHOOK_SECRET;
  }, 10000);

  beforeEach(async () => {
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NODE_ENV = 'test';
    await clearDb();
  });

  it('rejects unsigned webhook when secret is configured', async () => {
    const payload = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'email_abc' },
    });

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/signature/i);
  });

  it('rejects invalid signature', async () => {
    const payload = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'email_abc' },
    });

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_bad')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,not-a-real-signature')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
  });

  it('accepts valid signed webhook at the correct mount path', async () => {
    const payload = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'email_signed_1' },
    });
    const headers = signResend(payload, WEBHOOK_SECRET);

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(payload);

    // Route is mounted at /api/webhooks/resend (not /resend/resend)
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects webhook in production when RESEND_WEBHOOK_SECRET is missing', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_WEBHOOK_SECRET;

    const payload = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'email_prod' },
    });

    const res = await request(app)
      .post('/api/webhooks/resend')
      .set('Content-Type', 'application/json')
      .send(payload);

    process.env.NODE_ENV = prev;
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
