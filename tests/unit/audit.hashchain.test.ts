import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

const mockFind = vi.fn();
const mockAggregate = vi.fn();

vi.mock('@pawtag/db', () => ({
  AuditEvent: {
    find: (...args: unknown[]) => mockFind(...args),
    aggregate: (...args: unknown[]) => mockAggregate(...args),
    findOne: vi.fn(),
  },
  createAuditEventId: () => 'audit-event-' + Math.random().toString(36).slice(2),
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { verifyHashChain, computeHash } from '../../packages/api/src/services/audit';

function sha256(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data, Object.keys(data as object).sort())).digest('hex');
}

function buildEvent(overrides: Record<string, any> = {}) {
  return {
    auditEventId: overrides.auditEventId || 'evt-1',
    occurredAt: overrides.occurredAt || new Date('2026-01-01T00:00:00Z'),
    recordedAt: overrides.recordedAt || new Date('2026-01-01T00:00:01Z'),
    eventSequenceNumber: overrides.eventSequenceNumber || 0,
    actorType: overrides.actorType || 'ADMIN',
    resourceType: overrides.resourceType || 'User',
    resourceId: overrides.resourceId || 'usr-1',
    action: overrides.action || 'user_create',
    eventType: overrides.eventType || 'user.created',
    outcome: overrides.outcome || 'SUCCESS',
    previousEventHash: overrides.previousEventHash || '',
    schemaVersion: 1,
    ...overrides,
  };
}

function eventHash(event: Record<string, any>): string {
  const hashData = {
    auditEventId: event.auditEventId,
    transactionId: event.transactionId,
    correlationId: event.correlationId,
    occurredAt: event.occurredAt,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    eventType: event.eventType,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    outcome: event.outcome,
    beforeStateHash: event.beforeStateHash,
    afterStateHash: event.afterStateHash,
    previousEventHash: event.previousEventHash,
    schemaVersion: event.schemaVersion,
  };
  return sha256(hashData);
}

// Sort helper matching the service's per-stream sort order in verifyStream
function sortForStream(sorted: any[]) {
  return sorted;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('audit hash chain verification', () => {
  it('returns valid when a single stream hashes chain correctly (per-stream semantics)', async () => {
    const e1 = buildEvent({ auditEventId: 'evt-1', action: 'user_create' });
    e1.eventHash = eventHash(e1);

    const e2 = buildEvent({ auditEventId: 'evt-2', action: 'user_update', previousEventHash: e1.eventHash });
    e2.eventHash = eventHash(e2);

    mockAggregate.mockResolvedValue([{ _id: { actorType: 'ADMIN', resourceType: 'User', resourceId: 'usr-1' } }]);
    mockFind.mockImplementation(() => ({
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve(sortForStream([e1, e2])),
        }),
      }),
    }));

    const result = await verifyHashChain();
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(2);
  });

  it('detects a broken chain when a hash is tampered (hash mismatch)', async () => {
    const e1 = buildEvent({ auditEventId: 'evt-1', action: 'user_create' });
    e1.eventHash = eventHash(e1);

    // Tampered: action changed after hash was computed
    const e2 = buildEvent({
      auditEventId: 'evt-2',
      action: 'user_update_CHANGED', // tampered field
      previousEventHash: e1.eventHash,
    });
    e2.eventHash = eventHash({ ...e2, action: 'user_update' });

    mockAggregate.mockResolvedValue([{ _id: { actorType: 'ADMIN', resourceType: 'User', resourceId: 'usr-1' } }]);
    mockFind.mockImplementation(() => ({
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve([e1, e2]),
        }),
      }),
    }));

    const result = await verifyHashChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe('evt-2');
  });

  it('detects a broken previous-hash link (event removed or reordered)', async () => {
    const e1 = buildEvent({ auditEventId: 'evt-1', action: 'user_create' });
    e1.eventHash = eventHash(e1);

    // e2's previousEventHash does not match e1's hash
    const e2 = buildEvent({
      auditEventId: 'evt-2',
      action: 'user_update',
      previousEventHash: '0000000000000000000000000000000000000000000000000000000000000000',
    });
    e2.eventHash = eventHash(e2);

    mockAggregate.mockResolvedValue([{ _id: { actorType: 'ADMIN', resourceType: 'User', resourceId: 'usr-1' } }]);
    mockFind.mockImplementation(() => ({
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve([e1, e2]),
        }),
      }),
    }));

    const result = await verifyHashChain();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('broken');
  });

  it('accepts a specific streamKey restricted query', async () => {
    const e1 = buildEvent({ auditEventId: 'evt-1', resourceType: 'Pet', resourceId: 'pet-9' });
    e1.eventHash = eventHash(e1);

    mockAggregate.mockResolvedValue([]);
    mockFind.mockImplementation(() => ({
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve([e1]),
        }),
      }),
    }));

    const result = await verifyHashChain('ADMIN|Pet|pet-9');
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(1);
  });

  it('persists across "restart" — check is driven from DB not in-memory (stream buckets from aggregate)', async () => {
    // Even with no in-memory state, aggregate discovers streams from DB
    mockAggregate.mockResolvedValue([
      {
        _id: { actorType: 'SYSTEM', resourceType: 'Subscription', resourceId: 'sub-1' },
      },
    ]);

    const e1 = buildEvent({ auditEventId: 'evt-x', actorType: 'SYSTEM', resourceType: 'Subscription', resourceId: 'sub-1', action: 'renew' });
    e1.eventHash = eventHash(e1);

    mockFind.mockImplementation(() => ({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([e1]) }) }),
    }));

    const result = await verifyHashChain();
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(1);
  });
});

function sortForFirst(list: any[]) {
  return list.sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt - b.occurredAt;
    if (a.recordedAt !== b.recordedAt) return a.recordedAt - b.recordedAt;
    return a.eventSequenceNumber - b.eventSequenceNumber;
  });
}

function fixtureEvent() {
  return buildEvent();
}