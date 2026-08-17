import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn().mockReturnValue('event-id-123'),
  captureMessage: vi.fn().mockReturnValue('event-id-456'),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
}));

import { captureException, captureMessage, isMonitoringEnabled } from '../../packages/api/src/lib/monitoring';

describe('Monitoring', () => {
  it('captureException returns null when monitoring is not explicitly enabled', () => {
    const error = new Error('Test error');
    const eventId = captureException(error);
    // Returns null because no DSN was provided during module load
    expect(eventId).toBeNull();
  });

  it('captureMessage returns null when monitoring is not explicitly enabled', () => {
    const eventId = captureMessage('Test message');
    expect(eventId).toBeNull();
  });

  it('isMonitoringEnabled returns false when no DSN configured', () => {
    expect(isMonitoringEnabled()).toBe(false);
  });
});
