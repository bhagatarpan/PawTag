import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Setting: {
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
  },
  SystemLog: {
    insertMany: vi.fn().mockResolvedValue([]),
  },
}));

import { shouldStoreLog, getRetentionDays, getAllSystemLogSettings, invalidateSystemLogSettingsCache } from '../../packages/api/src/lib/system-log-settings';

describe('System Log Settings', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    invalidateSystemLogSettingsCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('shouldStoreLog', () => {
    it('returns false in test environment', async () => {
      process.env.NODE_ENV = 'test';
      const result = await shouldStoreLog('info', 'HTTP');
      expect(result).toBe(false);
    });

    it('returns true for enabled levels and categories in dev', async () => {
      process.env.NODE_ENV = 'development';
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'systemLog.enabled', value: 'true' },
          { key: 'systemLog.level.info', value: 'true' },
          { key: 'systemLog.category.HTTP', value: 'true' },
          { key: 'systemLog.sampling.info', value: '100' },
        ]),
      });
      invalidateSystemLogSettingsCache();

      const result = await shouldStoreLog('info', 'HTTP');
      expect(result).toBe(true);
    });

    it('returns false when master toggle is disabled', async () => {
      process.env.NODE_ENV = 'development';
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'systemLog.enabled', value: 'false' },
        ]),
      });
      invalidateSystemLogSettingsCache();

      const result = await shouldStoreLog('info', 'HTTP');
      expect(result).toBe(false);
    });

    it('returns false when level is disabled', async () => {
      process.env.NODE_ENV = 'development';
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'systemLog.enabled', value: 'true' },
          { key: 'systemLog.level.debug', value: 'false' },
          { key: 'systemLog.category.HTTP', value: 'true' },
        ]),
      });
      invalidateSystemLogSettingsCache();

      const result = await shouldStoreLog('debug', 'HTTP');
      expect(result).toBe(false);
    });

    it('returns false when category is disabled', async () => {
      process.env.NODE_ENV = 'development';
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'systemLog.enabled', value: 'true' },
          { key: 'systemLog.level.info', value: 'true' },
          { key: 'systemLog.category.DATABASE', value: 'false' },
        ]),
      });
      invalidateSystemLogSettingsCache();

      const result = await shouldStoreLog('info', 'DATABASE');
      expect(result).toBe(false);
    });
  });

  describe('getRetentionDays', () => {
    it('returns default 30 when no setting exists', async () => {
      process.env.NODE_ENV = 'development';
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      invalidateSystemLogSettingsCache();

      const result = await getRetentionDays();
      expect(result).toBe(30);
    });

    it('returns configured retention days', async () => {
      process.env.NODE_ENV = 'development';
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { key: 'systemLog.retentionDays', value: '60' },
        ]),
      });
      invalidateSystemLogSettingsCache();

      const result = await getRetentionDays();
      expect(result).toBe(60);
    });
  });

  describe('getAllSystemLogSettings', () => {
    it('returns default settings when DB is empty', async () => {
      process.env.NODE_ENV = 'development';
      const { Setting } = await import('@pawtag/db');
      (Setting.find as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      invalidateSystemLogSettingsCache();

      const result = await getAllSystemLogSettings();
      expect(result.enabled).toBe(true);
      expect(result.levels.info).toBe(true);
      expect(result.levels.debug).toBe(false);
      expect(result.retentionDays).toBe(30);
    });
  });

  describe('invalidateSystemLogSettingsCache', () => {
    it('does not throw', () => {
      expect(() => invalidateSystemLogSettingsCache()).not.toThrow();
    });
  });
});
