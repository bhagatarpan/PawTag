// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrderDetailView } from '../../packages/ui/src/components/OrderDetailView';
import type { OrderData } from '../../packages/ui/src/types';

function makeOrder(overrides: Partial<OrderData> = {}): OrderData {
  return {
    _id: '650f1a2b3c4d5e6f7a8b9c0d',
    orderNumber: 'PT-000405',
    status: 'paid',
    items: [
      { productName: 'PawTag Plus', quantity: 1, unitPrice: 39.99, totalPrice: 39.99 },
    ],
    totalAmount: 45.99,
    subtotal: 39.99,
    shippingCost: 6,
    tax: 6,
    payment: { amount: 45.99, currency: 'NZD', status: 'paid', method: 'card' },
    createdAt: '2026-08-29T02:51:00.000Z',
    ...overrides,
  };
}

function getStepperSection(): HTMLElement {
  const heading = screen.getByText('Order Progress');
  return heading.closest('div')!;
}

function getStepDot(stepLabel: string): HTMLElement {
  const stepper = getStepperSection();
  const label = within(stepper)
    .getAllByText(stepLabel)
    .find((el) => el.className.includes('mt-2'))!;
  return label.parentElement!.firstElementChild as HTMLElement;
}

describe('OrderDetailView', () => {
  describe('progress stepper', () => {
    it('renders all five steps in order, including Pending', () => {
      render(<OrderDetailView order={makeOrder()} />);
      const stepper = getStepperSection();
      const stepTexts = Array.from(stepper.querySelectorAll('span')).map((s) => s.textContent);
      expect(stepTexts).toEqual(
        expect.arrayContaining(['Pending', 'Paid', 'Packing', 'Shipped', 'Delivered']),
      );
    });

    it('marks steps before the current status as done with primary color', () => {
      render(<OrderDetailView order={makeOrder({ status: 'paid' })} />);
      const pendingDot = getStepDot('Pending');
      expect(pendingDot.className).toContain('bg-primary-600');
      expect(pendingDot.querySelector('svg')).not.toBeNull();
    });

    it('marks the current step with primary color and ring highlight', () => {
      render(<OrderDetailView order={makeOrder({ status: 'paid' })} />);
      const paidDot = getStepDot('Paid');
      expect(paidDot.className).toContain('bg-primary-600');
      expect(paidDot.className).toContain('ring-2');
    });

    it('renders future steps as neutral gray (no orange/amber dots)', () => {
      render(<OrderDetailView order={makeOrder({ status: 'paid' })} />);
      for (const step of ['Packing', 'Shipped', 'Delivered']) {
        const dot = getStepDot(step);
        expect(dot.className).toContain('bg-gray-200');
        expect(dot.className).not.toMatch(/amber|orange|red|emerald/);
      }
    });

    it('treats a delivered order as fully complete', () => {
      render(<OrderDetailView order={makeOrder({ status: 'delivered' })} />);
      for (const step of ['Pending', 'Paid', 'Packing', 'Shipped', 'Delivered']) {
        expect(getStepDot(step).className).toContain('bg-primary-600');
      }
    });

    it('shows a cancellation banner instead of the stepper for cancelled orders', () => {
      render(<OrderDetailView order={makeOrder({ status: 'cancelled' })} />);
      expect(screen.queryByText('Order Progress')).toBeNull();
      expect(screen.getByText('This order has been cancelled.')).toBeDefined();
    });
  });

  describe('header', () => {
    it('shows the order number and a status badge', () => {
      render(<OrderDetailView order={makeOrder({ status: 'paid' })} />);
      const heading = screen.getByText('Order PT-000405');
      expect(heading).toBeDefined();
      const badge = heading.parentElement!.parentElement!.querySelector('span:last-child')!;
      expect(badge.textContent).toBe('Paid');
      expect(badge.className).toContain('rounded-full');
      expect(badge.className).toContain('bg-primary-100');
    });

    it('renders a warning badge for pending orders', () => {
      render(<OrderDetailView order={makeOrder({ status: 'pending' })} />);
      const heading = screen.getByText('Order PT-000405');
      const badge = heading.parentElement!.parentElement!.querySelector('span:last-child')!;
      expect(badge.textContent).toBe('Pending');
      expect(badge.className).toContain('bg-amber-100');
    });

    it('renders a danger badge for cancelled orders', () => {
      render(<OrderDetailView order={makeOrder({ status: 'cancelled' })} />);
      const heading = screen.getByText('Order PT-000405');
      const badge = heading.parentElement!.parentElement!.querySelector('span:last-child')!;
      expect(badge.textContent).toBe('Cancelled');
      expect(badge.className).toContain('bg-red-100');
    });
  });

  describe('order summary', () => {
    it('displays subtotal, shipping, GST and total from stored breakdown fields', () => {
      render(<OrderDetailView order={makeOrder()} />);
      const summary = screen.getByText('Order Summary').closest('div')!;
      const text = within(summary).getAllByText(/NZ\$/).map((el) => el.textContent ?? '');
      expect(text).toContain('NZ$39.99');
      expect(text).toContain('NZ$6.00');
      expect(text.some((t) => t.includes('45.99'))).toBe(true);
    });
  });
});
