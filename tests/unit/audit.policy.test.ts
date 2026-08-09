import { beforeEach, describe, expect, it, vi } from 'vitest';

const { find } = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock('@pawtag/db', () => ({ Setting: { find } }));

import { getAuditPolicy, invalidateAuditPolicyCache, isAuditEnabled } from '../../packages/api/src/services/audit/audit.policy';

describe('audit policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    find.mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });
    invalidateAuditPolicyCache();
  });

  it('defaults every supported category and actor to enabled', async () => {
    const policy = await getAuditPolicy(true);

    expect(policy.categories.READ).toBe(true);
    expect(policy.categories.SECURITY).toBe(true);
    expect(policy.actors.USER).toBe(true);
    expect(policy.actors.FINDER).toBe(true);
  });

  it('honors disabled category and actor settings', async () => {
    find.mockReturnValue({
      select: () => ({
        lean: async () => [
          { key: 'audit.policy.category.read', value: 'false' },
          { key: 'audit.policy.actor.user', value: 'false' },
        ],
      }),
    });

    expect(await isAuditEnabled('READ', 'ADMIN')).toBe(false);
    expect(await isAuditEnabled('UPDATE', 'USER')).toBe(false);
    expect(await isAuditEnabled('UPDATE', 'ADMIN')).toBe(true);
  });

  it('fails open when policy storage is unavailable', async () => {
    find.mockImplementation(() => { throw new Error('database unavailable'); });

    expect(await isAuditEnabled('SECURITY', 'SYSTEM')).toBe(true);
  });
});
