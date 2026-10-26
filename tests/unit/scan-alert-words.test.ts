import { describe, it, expect } from 'vitest';
import { PET_HISTORY_LABELS } from '../../apps/web/src/pages/account/PetHistorySection';
import { describeIpArea } from '../../packages/api/src/lib/lost-pet-alerts';
import type { PetHistoryEventType } from '../../packages/db/src/models/PetHistoryEvent';

describe('pet history labels', () => {
  const REQUIRED: PetHistoryEventType[] = [
    'scan_received',
    'owner_prompted',
    'owner_prompt_dismissed',
    'finder_notified',
    'finder_location_shared',
    'finder_location_declined',
    'notification_attempted',
    'lost_activated',
    'reunion_confirmed',
  ];

  it('labels every event type the server can emit', () => {
    for (const type of REQUIRED) {
      expect(PET_HISTORY_LABELS[type], `missing label for ${type}`).toBeTruthy();
    }
  });

  it('never leaks raw enum values in labels', () => {
    for (const [type, label] of Object.entries(PET_HISTORY_LABELS)) {
      expect(label).not.toBe(type);
      expect(label).not.toContain('_');
    }
  });
});

describe('scan alert area wording', () => {
  it('builds a human locality from city + region', () => {
    expect(describeIpArea({ city: 'Blockhouse Bay', region: 'Auckland' })).toBe('Blockhouse Bay, Auckland');
  });

  it('does not repeat the same city twice', () => {
    expect(describeIpArea({ city: 'Auckland', region: 'Auckland' })).toBe('Auckland');
  });

  it('falls back to country, then null (workflow continues without location)', () => {
    expect(describeIpArea({ country: 'New Zealand' })).toBe('New Zealand');
    expect(describeIpArea(null)).toBeNull();
    expect(describeIpArea(undefined)).toBeNull();
  });
});
