// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TagUsageIndicator } from '../../packages/ui/src/components/TagUsageIndicator';

/**
 * Tag limit widget red rule (founder): the indicator turns red once the
 * customer is AT their activation limit, and the suffix tells them what
 * unlocks the next activation (pay-or-upgrade at the limit, upgrade beyond
 * the paid slot). Display only — the server enforces the cap.
 */
describe('TagUsageIndicator', () => {
  it('below the limit: neutral gray, counts shown', () => {
    const { container } = render(<TagUsageIndicator activeCount={1} limit={2} ownedCount={3} variant="block" />);
    expect(screen.getByText(/1 active · limit 2 · 3 owned/)).toBeTruthy();
    expect(container.querySelector('.text-red-600')).toBeNull();
    expect(container.querySelector('.text-gray-500')).toBeTruthy();
  });

  it('AT the limit: red + pay-or-upgrade suffix', () => {
    const { container } = render(<TagUsageIndicator activeCount={3} limit={3} variant="block" />);
    expect(screen.getByText(/3 active · limit 3 — pay or upgrade to activate more/)).toBeTruthy();
    expect(container.querySelector('.text-red-600')).toBeTruthy();
  });

  it('beyond the paid slot: red + upgrade-only suffix (founder: limit 3, 4 active)', () => {
    const { container } = render(<TagUsageIndicator activeCount={4} limit={3} variant="block" />);
    expect(screen.getByText(/4 active · limit 3 — upgrade to activate more/)).toBeTruthy();
    expect(container.querySelector('.text-red-600')).toBeTruthy();
  });
});
