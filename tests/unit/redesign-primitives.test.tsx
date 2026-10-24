// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Button, buttonClassName } from '../../packages/ui/src/components/Button';
import { InfoCard } from '../../packages/ui/src/components/InfoCard';
import { MetaRow } from '../../packages/ui/src/components/MetaRow';
import { PhotoHero } from '../../packages/ui/src/components/PhotoHero';
import { SelectChips } from '../../packages/ui/src/components/SelectChips';
import BottomNav from '../../apps/web/src/components/account/BottomNav';

/**
 * Batch 0 of the visual redesign: the shared primitives every redesigned
 * screen will compose. Asserts accessible behavior and the touch-target /
 * focus contracts — not markup snapshots.
 */

describe('Button / buttonClassName', () => {
  it('renders an accessible button with icon and label', () => {
    render(<Button icon={<span data-testid="icon" />}>Save changes</Button>);
    const btn = screen.getByRole('button', { name: 'Save changes' });
    expect(btn.getAttribute('type')).toBe('button'); // never submits by accident
    expect(btn.querySelector('[data-testid="icon"]')).toBeTruthy();
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('exposes disabled state and full-width option', () => {
    render(
      <Button disabled full>
        Processing
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Processing' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(buttonClassName({ full: true })).toContain('w-full');
  });

  it('keeps touch-target minimums and a focus ring on every variant', () => {
    expect(buttonClassName({ size: 'md' })).toContain('min-h-11'); // 44px
    expect(buttonClassName({ size: 'lg' })).toContain('min-h-12'); // 48px
    for (const variant of ['primary', 'secondary', 'danger', 'ghost'] as const) {
      expect(buttonClassName({ variant })).toContain('focus-visible:ring-2');
    }
    expect(buttonClassName({ variant: 'primary' })).toContain('bg-primary-600');
    expect(buttonClassName({ variant: 'danger' })).toContain('bg-red-600');
  });
});

describe('InfoCard', () => {
  it('renders icon well, title and body in the chosen tone', () => {
    render(
      <InfoCard tone="success" icon={<span data-testid="ic" />} title="On the way">
        Tracking arrives soon.
      </InfoCard>,
    );
    expect(screen.getByText('On the way')).toBeTruthy();
    expect(screen.getByText('Tracking arrives soon.')).toBeTruthy();
    expect(screen.getByTestId('ic')).toBeTruthy();
  });
});

describe('MetaRow', () => {
  it('renders title, subtitle and right value', () => {
    const { unmount } = render(
      <MetaRow title="Care reminders" subtitle="Vet visit" value="Next: Apr 12" chevron />,
    );
    expect(screen.getByText('Care reminders')).toBeTruthy();
    expect(screen.getByText('Vet visit')).toBeTruthy();
    expect(screen.getByText('Next: Apr 12')).toBeTruthy();
    unmount();

    render(<MetaRow title="Plain row" />);
    expect(screen.getByText('Plain row')).toBeTruthy();
  });
});

describe('PhotoHero', () => {
  it('shows the photo with alt text and overlay title', () => {
    render(
      <PhotoHero src="/pets/buddy.jpg" alt="Buddy the golden retriever" title="Good morning!" />,
    );
    const img = screen.getByAltText('Buddy the golden retriever');
    expect(img.getAttribute('src')).toBe('/pets/buddy.jpg');
    expect(screen.getByText('Good morning!')).toBeTruthy();
  });
});

describe('SelectChips', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'orders', label: 'Orders' },
    { value: 'pets', label: 'Pets' },
  ];

  it('exposes selection through aria-pressed and reports changes', () => {
    const onChange = vi.fn();
    render(<SelectChips options={options} value="all" onChange={onChange} ariaLabel="Filter" />);

    const group = screen.getByRole('group', { name: 'Filter' });
    const all = screen.getByRole('button', { name: 'All' });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Orders' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Orders' }));
    expect(onChange).toHaveBeenCalledWith('orders');
    expect(group).toBeTruthy();
  });
});

describe('BottomNav elevated Activate treatment', () => {
  it('renders the raised center circle while keeping the five destinations', () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <BottomNav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Home', 'Pets', 'Activate', 'Activity', 'Account']);

    const activate = screen.getByRole('link', { name: 'Activate' });
    expect(activate.getAttribute('href')).toBe('/account/redeem-tag');
    // The circle is decorative; the accessible name stays the text label.
    expect(activate.getAttribute('aria-current')).toBeNull();
    screen.getByRole('link', { name: 'Home' }); // smoke: other tabs still render
  });
});
