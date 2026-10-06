import { describe, it, expect } from 'vitest';
import { formatSavedAddressLines } from '../../apps/web/src/lib/checkout-address';

describe('formatSavedAddressLines', () => {
  it('shows each saved address’s own lines (not a shared form value)', () => {
    const home = formatSavedAddressLines({
      line1: '10 Queen Street',
      line2: 'Level 2',
      city: 'Auckland',
      zip: '1010',
    });
    const work = formatSavedAddressLines({
      line1: '20 Customs Street',
      city: 'Auckland',
      zip: '1010',
    });

    expect(home.lineA).toBe('10 Queen Street, Level 2');
    expect(home.lineB).toBe('Auckland 1010');
    expect(work.lineA).toBe('20 Customs Street');
    expect(work.lineB).toBe('Auckland 1010');
  });

  it('handles missing optional fields', () => {
    const lines = formatSavedAddressLines({ line1: '5 Test Rd', city: 'Wellington' });
    expect(lines.lineA).toBe('5 Test Rd');
    expect(lines.lineB).toBe('Wellington');
  });
});
