import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const originalEnv = { ...process.env };

describe('Phase 03 — Email audit idempotency', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('recordEmailAudit returns existing id when idempotencyKey already recorded', async () => {
    const created: any[] = [];
    vi.doMock('@pawtag/db', () => ({
      EmailAudit: {
        findOne: vi.fn().mockImplementation(({ idempotencyKey }: any) => ({
          lean: async () => created.find((c) => c.idempotencyKey === idempotencyKey) || null,
        })),
        create: vi.fn().mockImplementation(async (doc: any) => {
          if (doc.idempotencyKey && created.some((c) => c.idempotencyKey === doc.idempotencyKey)) {
            const err: any = new Error('dup');
            err.code = 11000;
            throw err;
          }
          const row = { _id: { toString: () => `audit_${created.length + 1}` }, ...doc };
          created.push(row);
          return row;
        }),
      },
    }));

    const { recordEmailAudit } = await import('../../packages/api/src/services/email-audit.service');

    const base = {
      templateSlug: 'order-confirmation',
      recipientEmail: 'a@example.com',
      senderEmail: 'from@example.com',
      senderName: 'PawTag',
      subject: 'Order confirmed',
      htmlContent: '<p>hi</p>',
      providerMessageId: 'msg_1',
      idempotencyKey: 'order-confirmation:ORD-1',
    };

    const first = await recordEmailAudit(base);
    const second = await recordEmailAudit({ ...base, providerMessageId: 'msg_retry' });

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(created.length).toBe(1);
  });

  it('updateEmailAuditStatus does not duplicate timeline entries for same status', async () => {
    const timeline: any[] = [{ event: 'sent', timestamp: new Date() }];
    const doc: any = {
      _id: 'audit_1',
      providerMessageId: 'msg_1',
      deliveryTimeline: timeline,
    };

    vi.doMock('@pawtag/db', () => ({
      EmailAudit: {
        findOne: vi.fn().mockReturnValue({ lean: async () => doc }),
        findOneAndUpdate: vi.fn().mockImplementation(async (_q: any, update: any) => {
          if (update.$push?.deliveryTimeline) {
            timeline.push(update.$push.deliveryTimeline);
          }
          return doc;
        }),
      },
    }));

    const { updateEmailAuditStatus } = await import('../../packages/api/src/services/email-audit.service');

    await updateEmailAuditStatus('msg_1', 'delivered', {});
    await updateEmailAuditStatus('msg_1', 'delivered', {});

    const deliveredCount = timeline.filter((t) => t.event === 'delivered').length;
    expect(deliveredCount).toBe(1);
  });
});
