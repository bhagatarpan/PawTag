// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';

/**
 * Checkout CPF disclosure regression (founder manual test 2026-10-20):
 * the Payment step summary showed a pre-fee total ($9.99 while Stripe
 * charged $10.55) because it was a separate render block the fee row
 * was never wired into.
 *
 * Guards:
 * 1. OrderSummaryCard renders the fee row + payable total.
 * 2. SOURCE GUARD: every "Estimated Total" render site in Checkout.tsx
 *    must use `payableTotal` (never the raw pre-fee total), and every
 *    inline summary block must render the fee row — a new summary block
 *    wired to the raw total can never ship silently again.
 */

import OrderSummaryCard from '../../apps/web/src/components/checkout/OrderSummaryCard';

describe('OrderSummaryCard CPF disclosure', () => {
  it('renders the card payment fee row and the payable total', () => {
    render(
      <OrderSummaryCard
        items={[{ productName: 'PawTag Scan', quantity: 1, unitPrice: 9.99 }]}
        subtotal={9.99}
        shipping={0}
        total={10.55}
        cpfFee={{ amount: 0.56, gst: 0.07 }}
      />,
    );

    expect(screen.getByText(/Card payment fee/)).toBeTruthy();
    expect(screen.getByText(/\(incl\. GST NZ\$0\.07\)/)).toBeTruthy();
    expect(screen.getByText('NZ$10.55')).toBeTruthy(); // payable total, not 9.99
  });

  it('renders nothing fee-related when no fee applies', () => {
    render(
      <OrderSummaryCard
        items={[{ productName: 'PawTag Scan', quantity: 1, unitPrice: 9.99 }]}
        subtotal={9.99}
        shipping={0}
        total={9.99}
        cpfFee={null}
      />,
    );

    expect(screen.queryByText(/Card payment fee/)).toBeNull();
    // $9.99 appears on the item line AND the total — both must be pre-fee
    expect(screen.getAllByText('NZ$9.99').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Checkout.tsx source guard — every totals display includes the fee', () => {
  const source = readFileSync(
    path.resolve(__dirname, '../../apps/web/src/pages/Checkout.tsx'),
    'utf8',
  );

  it('every "Estimated Total" render uses payableTotal (never the raw pre-fee total)', () => {
    const occurrences = [...source.matchAll(/Estimated Total/g)].map((m) => m.index ?? 0);
    // At least the review + payment inline summaries
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    for (const index of occurrences) {
      const window = source.slice(index, index + 220);
      expect(window, `Estimated Total at offset ${index} must render payableTotal`).toContain(
        'payableTotal',
      );
      expect(window, `Estimated Total at offset ${index} must not fall back to raw orderTotal first`).not.toMatch(
        /\$\{orderTotal\.toFixed/,
      );
    }
  });

  it('inline summaries + order summary card render the fee row', () => {
    const feeRows = [...source.matchAll(/Card payment fee/g)].length;
    // OrderSummaryCard prop + review block + payment block
    expect(feeRows).toBeGreaterThanOrEqual(2);
  });

  it('mobile sticky bar uses payableTotal', () => {
    const stickyIndex = source.indexOf('Estimated total');
    expect(stickyIndex).toBeGreaterThan(0);
    const window = source.slice(stickyIndex, stickyIndex + 220);
    expect(window).toContain('payableTotal');
  });
});
