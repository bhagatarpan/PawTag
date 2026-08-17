import { describe, it, expect } from 'vitest';
import {
  LEVEL_COLORS,
  LEVEL_DOT_COLORS,
  CATEGORY_COLORS,
  LEVEL_ICONS,
  CATEGORY_ICONS,
  LEVEL_DESCRIPTIONS,
  CATEGORY_DESCRIPTIONS,
  formatDuration,
  truncateMessage,
} from '../../apps/admin/src/lib/system-log-utils';

describe('System Log Utils', () => {
  describe('LEVEL_COLORS', () => {
    it('has colors for all levels', () => {
      expect(LEVEL_COLORS.debug).toBeDefined();
      expect(LEVEL_COLORS.info).toBeDefined();
      expect(LEVEL_COLORS.warn).toBeDefined();
      expect(LEVEL_COLORS.error).toBeDefined();
      expect(LEVEL_COLORS.fatal).toBeDefined();
    });
  });

  describe('LEVEL_DOT_COLORS', () => {
    it('has dot colors for all levels', () => {
      expect(LEVEL_DOT_COLORS.debug).toBeDefined();
      expect(LEVEL_DOT_COLORS.info).toBeDefined();
      expect(LEVEL_DOT_COLORS.warn).toBeDefined();
      expect(LEVEL_DOT_COLORS.error).toBeDefined();
      expect(LEVEL_DOT_COLORS.fatal).toBeDefined();
    });
  });

  describe('CATEGORY_COLORS', () => {
    it('has colors for all categories', () => {
      const categories = ['HTTP', 'DATABASE', 'AUTH', 'INTEGRATION', 'JOB', 'SECURITY', 'NOTIFICATION', 'CONFIG', 'GENERAL'];
      for (const cat of categories) {
        expect(CATEGORY_COLORS[cat]).toBeDefined();
      }
    });
  });

  describe('LEVEL_ICONS', () => {
    it('has icons for all levels', () => {
      expect(LEVEL_ICONS.debug).toBeDefined();
      expect(LEVEL_ICONS.info).toBeDefined();
      expect(LEVEL_ICONS.warn).toBeDefined();
      expect(LEVEL_ICONS.error).toBeDefined();
      expect(LEVEL_ICONS.fatal).toBeDefined();
    });
  });

  describe('CATEGORY_ICONS', () => {
    it('has icons for all categories', () => {
      const categories = ['HTTP', 'DATABASE', 'AUTH', 'INTEGRATION', 'JOB', 'SECURITY', 'NOTIFICATION', 'CONFIG', 'GENERAL'];
      for (const cat of categories) {
        expect(CATEGORY_ICONS[cat]).toBeDefined();
      }
    });
  });

  describe('LEVEL_DESCRIPTIONS', () => {
    it('has descriptions for all levels', () => {
      expect(LEVEL_DESCRIPTIONS.debug).toBeDefined();
      expect(LEVEL_DESCRIPTIONS.info).toBeDefined();
      expect(LEVEL_DESCRIPTIONS.warn).toBeDefined();
      expect(LEVEL_DESCRIPTIONS.error).toBeDefined();
      expect(LEVEL_DESCRIPTIONS.fatal).toBeDefined();
    });
  });

  describe('CATEGORY_DESCRIPTIONS', () => {
    it('has descriptions for all categories', () => {
      const categories = ['HTTP', 'DATABASE', 'AUTH', 'INTEGRATION', 'JOB', 'SECURITY', 'NOTIFICATION', 'CONFIG', 'GENERAL'];
      for (const cat of categories) {
        expect(CATEGORY_DESCRIPTIONS[cat]).toBeDefined();
      }
    });
  });

  describe('formatDuration', () => {
    it('formats sub-millisecond', () => {
      expect(formatDuration(0.5)).toBe('<1ms');
    });

    it('formats milliseconds', () => {
      expect(formatDuration(100)).toBe('100ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('formats seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('formats minutes', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(120000)).toBe('2.0m');
    });
  });

  describe('truncateMessage', () => {
    it('returns short messages unchanged', () => {
      expect(truncateMessage('hello')).toBe('hello');
    });

    it('truncates long messages', () => {
      const long = 'a'.repeat(200);
      const result = truncateMessage(long, 120);
      expect(result.length).toBeLessThanOrEqual(123); // 120 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('handles empty string', () => {
      expect(truncateMessage('')).toBe('');
    });

    it('respects custom max length', () => {
      expect(truncateMessage('hello world', 5)).toBe('hello...');
    });
  });
});
