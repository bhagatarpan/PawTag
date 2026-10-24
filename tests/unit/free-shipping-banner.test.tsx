// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Packet 3 (board 3, cart): free-shipping banner.
 * Money-display honesty: uses only the server-resolved threshold and renders
 * NOTHING when the server applies no threshold — the UI must never invent
 * one (shipping authority stays in server totals).
 */

const cart = vi.hoisted(() => ({
  totals: { subtotal: 0 },
  freeShippingThreshold: null as number | null,
}));

vi.mock('../../apps/web/src/context/CartContext', () => ({
  useCart: () => cart,
}));

import FreeShippingBanner from '../../apps/web/src/components/cart/FreeShippingBanner';

beforeEach(() => {
  cart.totals = { subtotal: 0 };
  cart.freeShippingThreshold = null;
});

describe('FreeShippingBanner', () => {
  it('renders nothing when the server applies no threshold', () => {
    cart.totals = { subtotal: 30 };
    cart.freeShippingThreshold = null;
    const { container } = render(<FreeShippingBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the remaining amount below the threshold', () => {
    cart.totals = { subtotal: 37.66 };
    cart.freeShippingThreshold = 50;
    render(<FreeShippingBanner />);
    expect(screen.getByText(/Add/)).toBeTruthy();
    expect(screen.getByText('$12.34')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/free-shipping threshold/)).toBeTruthy();
  });

  it('shows unlocked state at or above the threshold', () => {
    cart.totals = { subtotal: 55 };
    cart.freeShippingThreshold = 50;
    render(<FreeShippingBanner />);
    expect(screen.getByText('Free shipping unlocked')).toBeTruthy();
    expect(screen.queryByText(/more for/)).toBeNull();
  });
});
