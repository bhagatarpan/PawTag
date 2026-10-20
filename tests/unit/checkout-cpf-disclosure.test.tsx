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

describe('multi-surface source guards (founder manual test round 2 — every totals surface)', () => {
  const read = (rel: string) =>
    readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');

  it('confirmation step derives charged amounts from the order (cpf + captured total)', () => {
    const src = read('apps/web/src/components/checkout/CheckoutConfirmationStep.tsx');
    expect(src).toContain('orderCpf(');
    expect(src).toContain('orderPayableTotal(');
    expect(src).toContain('Card payment fee');
    // Totals must not fall back to the raw client total when the fee exists
    expect(src).toContain('payableTotal');
  });

  it('Checkout passes the captured order amount and quote fee fallback to confirmation', () => {
    const src = read('apps/web/src/pages/Checkout.tsx');
    expect(src).toContain('orderPayableTotal(pawtagOrder)');
    expect(src).toContain('fallbackCpf={serverQuote?.cpf');
  });

  it('customer order detail shows the card payment fee row', () => {
    const src = read('packages/ui/src/components/OrderDetailView.tsx');
    expect(src).toContain('Card payment fee');
    expect(src).toContain('order.payment?.cpf');
  });

  it('admin order drawer shows the fee on BOTH summary surfaces (Order Info + Items tabs)', () => {
    const src = read('apps/admin/src/pages/Orders.tsx');
    const feeRows = [...src.matchAll(/Card payment fee/g)].length;
    expect(feeRows).toBeGreaterThanOrEqual(2);
  });
});

describe('round-3 source guards (founder manual test: credit-note page, refund display, returns columns)', () => {
  const read = (rel: string) =>
    readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');

  it('customer invoice detail: fee row for invoices + CREDITED scope for credit notes', () => {
    const src = read('apps/web/src/pages/account/InvoiceDetail.tsx');
    expect(src).toContain('Card payment fee');
    // Credit notes must render the breakdown scope, never the original order items
    expect(src).toContain('refundScope');
    expect(src).toContain('Credited items');
    expect(src).toContain('Total credited');
  });

  it('invoice projection supplies cpf + the customer-safe refund scope (retained stripped)', () => {
    const src = read('packages/api/src/routes/invoice-access.ts');
    expect(src).toContain('cpf:');
    expect(src).toContain('refundScope');
    // Customer channel must never project retained charges
    expect(src).not.toMatch(/refundScope[\s\S]{0,400}retained/i);
  });

  it('customer order page refund amount prefers the actual refunded sum', () => {
    const src = read('packages/ui/src/components/OrderDetailView.tsx');
    expect(src).toMatch(/refundedAmount \?\? order\.payment\?\.amount/);
    // The old hardwired capture display must not return
    expect(src).not.toMatch(/const refundAmount = order\.payment\?\.amount/);
  });

  it('customer order API computes refundedAmount from refund transactions', () => {
    const src = read('packages/api/src/routes/customer.ts');
    expect(src).toContain('refundedAmount');
    expect(src).toMatch(/type: 'refund'[\s\S]{0,120}succeeded/, 'must sum refund PaymentTransactions');
  });

  it('returns list shows Return Tracking + Requested + Refunded columns', () => {
    const src = read('apps/admin/src/pages/Returns.tsx');
    expect(src).toContain('>Return Tracking<');
    expect(src).toContain('>Requested<');
    expect(src).toContain('>Refunded<');
    expect(src).toContain('requestedRefundAmount');
    expect(src).toContain('actualRefundedAmount');
    expect(src).toContain('returnTrackingNumber');
  });

  it('returns list API joins refund transactions + preserves the requested snapshot', () => {
    const adminReturns = read('packages/api/src/routes/admin-returns.ts');
    expect(adminReturns).toContain('actualRefundedAmount');
    expect(adminReturns).toContain('providerTransactionId: { $in: refundIds }');
    // Processing must not destroy the customer-quoted amount
    const model = read('packages/db/src/models/Return.ts');
    expect(model).toContain('requestedRefundAmount');
  });
});
