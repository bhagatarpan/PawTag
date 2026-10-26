// @vitest-environment happy-dom
/**
 * Orders list card redesign (implementation-package Phase 3, plan §5.2 list):
 * - one scannable card: number/date, state pills, item summary, progress,
 *   total + explicit "View order" affordance;
 * - secondary payment/address/invoice metadata demoted to order details;
 * - the card is a SINGLE link with nothing interactive nested inside it
 *   (the old CopyButton-inside-Link pattern is gone);
 * - status/refund/pending/cancelled families all render from real labels.
 */
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../apps/web/src/lib/api', () => ({ default: apiMock }));

import Orders from '../../apps/web/src/pages/account/Orders';

const baseOrder = {
  _id: 'ord1',
  orderNumber: 'PT-104328',
  status: 'paid',
  createdAt: '2026-08-29T02:51:00.000Z',
  items: [
    { productName: 'PawTag GPS Tracker', variantName: 'Forest Green', quantity: 1, image: 'https://img.example/tracker.png' },
    { productName: 'Silicone Holder', quantity: 1 },
  ],
  payment: { status: 'completed', amount: 49.0, cardBrand: 'visa', cardLast4: '4242' },
  shippingAddress: { city: 'Auckland', country: 'NZ' },
  latestInvoice: { invoiceNumber: 'INV-77' },
};

function makeOrder(overrides: any) {
  return { ...baseOrder, ...overrides };
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
});

function renderOrders(orders: any[]) {
  apiMock.get.mockResolvedValue({ data: { data: orders } });
  return render(
    <MemoryRouter initialEntries={['/account/orders']}>
      <Orders />
    </MemoryRouter>,
  );
}

describe('Orders list card', () => {
  it('renders number/date, state pill, item summary, progress and the total footer', async () => {
    renderOrders([makeOrder({})]);
    expect(await screen.findByText('PT-104328')).toBeDefined();
    expect(screen.getByText('Shipped', { selector: 'span' })).toBeDefined(); // status pill label
    expect(screen.getByText('PawTag GPS Tracker')).toBeDefined();
    expect(screen.getByText('Forest Green · Qty 1 · +1 more')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
    expect(screen.getByText('$49.00')).toBeDefined();
    expect(screen.getByText('View order')).toBeDefined();
    // Subtitle per the board/plan.
    expect(screen.getByText('Track your orders and see past purchases.')).toBeDefined();
  });

  it('demotes secondary metadata that now lives in order details', async () => {
    renderOrders([makeOrder({})]);
    await screen.findByText('PT-104328');
    expect(screen.queryByText(/Auckland/)).toBeNull();          // shipping city
    expect(screen.queryByText(/INV-77/)).toBeNull();            // invoice number
    expect(screen.queryByText(/4242/)).toBeNull();              // card last4
    expect(screen.queryByText('View Details')).toBeNull();
  });

  it('keeps each card a single link with no nested interactive controls', async () => {
    const { container } = renderOrders([makeOrder({}), makeOrder({ _id: 'ord2', orderNumber: 'PT-104017', status: 'delivered' })]);
    await screen.findByText('PT-104328');
    const cards = container.querySelectorAll('a[href^="/account/orders/"]');
    expect(cards).toHaveLength(2);
    for (const card of Array.from(cards)) {
      expect(card.querySelector('button')).toBeNull();
      expect(card.querySelector('a')).toBeNull();
      expect(card.textContent).toContain('View order');
    }
    // Both cards link to their detail routes.
    expect(cards[0].getAttribute('href')).toBe('/account/orders/ord1');
  });

  it('renders cancelled orders through the status banner, not the stepper', async () => {
    renderOrders([makeOrder({ _id: 'ord3', orderNumber: 'PT-9', status: 'cancelled', refundStatus: null })]);
    expect(await screen.findByText('This order has been cancelled')).toBeDefined();
    expect(screen.getByText('Cancelled')).toBeDefined();
  });

  it('keeps refund display distinct from order status on the card', async () => {
    renderOrders([makeOrder({ _id: 'ord4', orderNumber: 'PT-8', status: 'delivered', refundStatus: 'pending', refundAmount: 10 })]);
    expect(await screen.findByText('PT-8')).toBeDefined();
    // Order status pill AND refund pill both present — never conflated.
    expect(screen.getByText('Delivered')).toBeDefined();
    expect(screen.getByText('Partially refunded')).toBeDefined();
  });
});
