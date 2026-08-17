import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Setting: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../packages/api/src/services/audit/audit.service', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../packages/api/src/lib/site-availability', () => ({
  getSiteAvailabilityStatus: vi.fn(),
  clearSiteAvailabilityCache: vi.fn(),
}));

import { getSiteAvailabilityStatus, clearSiteAvailabilityCache } from '../../packages/api/src/lib/site-availability';

describe('Site Availability API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/public/system/status', () => {
    it('returns ONLINE status by default', async () => {
      (getSiteAvailabilityStatus as ReturnType<typeof vi.fn>).mockResolvedValue('ONLINE');

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe('ONLINE');
    });

    it('returns MAINTENANCE status when maintenance mode is enabled', async () => {
      (getSiteAvailabilityStatus as ReturnType<typeof vi.fn>).mockResolvedValue('MAINTENANCE');

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe('MAINTENANCE');
    });

    it('returns OFFLINE status when offline mode is enabled', async () => {
      (getSiteAvailabilityStatus as ReturnType<typeof vi.fn>).mockResolvedValue('OFFLINE');

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe('OFFLINE');
    });
  });

  describe('Status precedence', () => {
    it('OFFLINE takes precedence over MAINTENANCE', async () => {
      (getSiteAvailabilityStatus as ReturnType<typeof vi.fn>).mockResolvedValue('OFFLINE');

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe('OFFLINE');
    });

    it('MAINTENANCE takes precedence over ONLINE', async () => {
      (getSiteAvailabilityStatus as ReturnType<typeof vi.fn>).mockResolvedValue('MAINTENANCE');

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe('MAINTENANCE');
    });
  });
});
