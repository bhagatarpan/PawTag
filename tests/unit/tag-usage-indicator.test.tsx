// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TagUsageIndicator } from '../../packages/ui/src/components/TagUsageIndicator';

/**
 * Tag limit widget (founder rules): quota pattern — count + usage bar +
 * status chip. Red (bar + chip) once the customer is AT their activation
 * limit; the chip differentiates "Limit reached" (pay-or-upgrade escape
 * hatch) from "Upgrade required" (past the paid slot). Display only — the
 * server enforces the cap.
 */
describe('TagUsageIndicator', () => {
  it('below the limit: neutral count + partial primary bar, no status chip, no red', () => {
    const { container } = render(<TagUsageIndicator activeCount={1} limit={3} ownedCount={6} variant="block" />);

    expect(screen.getByText('1 of 3 active')).toBeTruthy();
    expect(screen.getByText('6 owned')).toBeTruthy();

    const fill = container.querySelector('.bg-primary-500') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe('33%');
    expect(container.querySelector('.bg-red-500')).toBeNull();
    expect(container.querySelector('.text-red-600')).toBeNull();
  });

  it('AT the limit: red full bar + warning chip (founder: change to red at limit)', () => {
    const { container } = render(<TagUsageIndicator activeCount={3} limit={3} variant="block" />);

    expect(screen.getByText('3 of 3 active')).toBeTruthy();
    expect(screen.getByText('Limit reached')).toBeTruthy();

    const fill = container.querySelector('.bg-red-500') as HTMLElement;
    expect(fill.style.width).toBe('100%');
    expect(container.querySelector('.text-red-600')).toBeTruthy();
  });

  it('beyond the paid slot: upgrade-only chip, bar clamped (founder: limit 3, 4 active)', () => {
    const { container } = render(<TagUsageIndicator activeCount={4} limit={3} variant="block" />);

    expect(screen.getByText('4 of 3 active')).toBeTruthy();
    expect(screen.getByText('Upgrade required')).toBeTruthy();

    const fill = container.querySelector('.bg-red-500') as HTMLElement;
    expect(fill.style.width).toBe('100%'); // clamped — never overflows the track
  });

  it('inline variant renders the compact drawer-header pill with bar + chip', () => {
    const { container } = render(<TagUsageIndicator activeCount={2} limit={2} variant="inline" />);

    expect(screen.getByText('2 of 2 active')).toBeTruthy();
    expect(screen.getByText('Limit reached')).toBeTruthy();
    expect(container.querySelector('.rounded-full')).toBeTruthy();
    expect(container.querySelector('.w-14')).toBeTruthy(); // fixed-width bar slot keeps the pill stable
  });
});
