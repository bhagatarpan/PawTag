import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Setting: {
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
  },
}));

import { SiteAvailabilityStatus } from '@pawtag/shared';
import { getSiteAvailabilityStatus, getSiteAvailability, clearSiteAvailabilityCache } from '../../packages/api/src/lib/site-availability.service';

describe('Site Availability Service', () => {
  beforeEach(() => {
    clearSiteAvailabilityCache();
    vi.clearAllMocks();
  });

  describe('getSiteAvailabilityStatus', () => {
    it('returns ONLINE when both settings are false', async () => {
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'false' },
          { key: 'site.offlineMode', value: 'false' },
        ]),
      });
      clearSiteAvailabilityCache();

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.ONLINE);
    });

    it('returns MAINTENANCE when maintenance is true and offline is false', async () => {
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'true' },
          { key: 'site.offlineMode', value: 'false' },
        ]),
      });
      clearSiteAvailabilityCache();

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.MAINTENANCE);
    });

    it('returns OFFLINE when offline is true', async () => {
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'false' },
          { key: 'site.offlineMode', value: 'true' },
        ]),
      });
      clearSiteAvailabilityCache();

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.OFFLINE);
    });

    it('returns OFFLINE when both are true (offline takes precedence)', async () => {
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'true' },
          { key: 'site.offlineMode', value: 'true' },
        ]),
      });
      clearSiteAvailabilityCache();

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.OFFLINE);
    });

    it('defaults to ONLINE when settings are missing', async () => {
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      clearSiteAvailabilityCache();

      const status = await getSiteAvailabilityStatus();
      expect(status).toBe(SiteAvailabilityStatus.ONLINE);
    });

    it('returns MAINTENANCE after offline is disabled while maintenance remains on', async () => {
      const { Setting } = await import('@pawtag/db');

      // First: both ON → OFFLINE
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'true' },
          { key: 'site.offlineMode', value: 'true' },
        ]),
      });
      clearSiteAvailabilityCache();
      const status1 = await getSiteAvailabilityStatus();
      expect(status1).toBe(SiteAvailabilityStatus.OFFLINE);

      // Then: offline OFF, maintenance ON → MAINTENANCE
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'true' },
          { key: 'site.offlineMode', value: 'false' },
        ]),
      });
      clearSiteAvailabilityCache();
      const status2 = await getSiteAvailabilityStatus();
      expect(status2).toBe(SiteAvailabilityStatus.MAINTENANCE);
    });

    it('returns ONLINE after both are disabled', async () => {
      const { Setting } = await import('@pawtag/db');

      // First: maintenance ON
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'true' },
          { key: 'site.offlineMode', value: 'false' },
        ]),
      });
      clearSiteAvailabilityCache();
      const status1 = await getSiteAvailabilityStatus();
      expect(status1).toBe(SiteAvailabilityStatus.MAINTENANCE);

      // Then: both OFF → ONLINE
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'false' },
          { key: 'site.offlineMode', value: 'false' },
        ]),
      });
      clearSiteAvailabilityCache();
      const status2 = await getSiteAvailabilityStatus();
      expect(status2).toBe(SiteAvailabilityStatus.ONLINE);
    });
  });

  describe('getSiteAvailability', () => {
    it('returns full availability data including messages', async () => {
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'false' },
          { key: 'site.offlineMode', value: 'false' },
          { key: 'site.maintenanceTitle', value: 'Custom Maintenance Title' },
          { key: 'site.maintenanceMessage', value: 'Custom maintenance message' },
          { key: 'site.offlineTitle', value: 'Custom Offline Title' },
          { key: 'site.offlineMessage', value: 'Custom offline message' },
          { key: 'site.availabilityPollingInterval', value: '60' },
        ]),
      });
      clearSiteAvailabilityCache();

      const data = await getSiteAvailability();
      expect(data.status).toBe(SiteAvailabilityStatus.ONLINE);
      expect(data.maintenanceMode).toBe(false);
      expect(data.offlineMode).toBe(false);
      expect(data.messages.maintenanceTitle).toBe('Custom Maintenance Title');
      expect(data.messages.offlineTitle).toBe('Custom Offline Title');
      expect(data.pollingInterval).toBe(60);
    });
  });

  describe('clearSiteAvailabilityCache', () => {
    it('forces a fresh DB read on next call', async () => {
      const { Setting } = await import('@pawtag/db');
      const findMock = vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'site.maintenanceMode', value: 'false' },
          { key: 'site.offlineMode', value: 'false' },
        ]),
      });
      (Setting.find as ReturnType<typeof vi.fn>) = findMock;

      await getSiteAvailabilityStatus();
      await getSiteAvailabilityStatus(); // should use cache
      expect(findMock).toHaveBeenCalledTimes(1);

      clearSiteAvailabilityCache();
      await getSiteAvailabilityStatus(); // should query again
      expect(findMock).toHaveBeenCalledTimes(2);
    });
  });
});
