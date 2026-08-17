import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Setting: {
    findOne: vi.fn(),
  },
}));

import { getSiteAvailabilityStatus, checkMutationAllowed, clearSiteAvailabilityCache } from '../../packages/api/src/lib/site-availability';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { Setting } from '@pawtag/db';

describe('Site Availability', () => {
  beforeEach(() => {
    clearSiteAvailabilityCache();
    vi.clearAllMocks();
  });

  describe('getSiteAvailabilityStatus', () => {
    it('returns ONLINE when both settings are false', async () => {
      (Setting.findOne as ReturnType<typeof vi.fn>).mockImplementation(({ key }: { key: string }) => ({
        lean: vi.fn().mockResolvedValue({ key, value: 'false' }),
      }));

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.ONLINE);
    });

    it('returns MAINTENANCE when maintenance is true and offline is false', async () => {
      (Setting.findOne as ReturnType<typeof vi.fn>).mockImplementation(({ key }: { key: string }) => ({
        lean: vi.fn().mockResolvedValue({ key, value: key === 'site.maintenanceMode' ? 'true' : 'false' }),
      }));

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.MAINTENANCE);
    });

    it('returns OFFLINE when offline is true (even if maintenance is true)', async () => {
      (Setting.findOne as ReturnType<typeof vi.fn>).mockImplementation(({ key }: { key: string }) => ({
        lean: vi.fn().mockResolvedValue({ key, value: 'true' }),
      }));

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.OFFLINE);
    });

    it('returns OFFLINE when offline is true and maintenance is false', async () => {
      (Setting.findOne as ReturnType<typeof vi.fn>).mockImplementation(({ key }: { key: string }) => ({
        lean: vi.fn().mockResolvedValue({ key, value: key === 'site.offlineMode' ? 'true' : 'false' }),
      }));

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.OFFLINE);
    });

    it('defaults to ONLINE when settings are missing', async () => {
      (Setting.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.ONLINE);
    });
  });

  describe('checkMutationAllowed', () => {
    it('allows mutations when status is ONLINE', () => {
      const result = checkMutationAllowed(SiteAvailabilityStatus.ONLINE, false);
      expect(result).toBeNull();
    });

    it('allows admin mutations when status is OFFLINE', () => {
      const result = checkMutationAllowed(SiteAvailabilityStatus.OFFLINE, true);
      expect(result).toBeNull();
    });

    it('blocks non-admin mutations when status is OFFLINE', () => {
      const result = checkMutationAllowed(SiteAvailabilityStatus.OFFLINE, false);
      expect(result).not.toBeNull();
      expect(result?.blocked).toBe(true);
      expect(result?.statusCode).toBe(503);
      expect(result?.body.code).toBe('SITE_OFFLINE');
    });

    it('blocks non-admin mutations when status is MAINTENANCE', () => {
      const result = checkMutationAllowed(SiteAvailabilityStatus.MAINTENANCE, false);
      expect(result).not.toBeNull();
      expect(result?.blocked).toBe(true);
      expect(result?.statusCode).toBe(503);
      expect(result?.body.code).toBe('SITE_MAINTENANCE');
    });

    it('allows admin mutations when status is MAINTENANCE', () => {
      const result = checkMutationAllowed(SiteAvailabilityStatus.MAINTENANCE, true);
      expect(result).toBeNull();
    });
  });
});
