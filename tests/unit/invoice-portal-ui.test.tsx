// @vitest-environment happy-dom
/**
 * Customer invoice portal — package Phase 4 (plan §5.3) regressions:
 *
 * 1. List = document cards (article) with type label + full-label "View
 *    details" link and "Download PDF" button — NO button-like rows and no
 *    interactive controls nested inside a link.
 * 2. Status copy comes from the shared INVOICE_STATUS_LABELS config; credit
 *    notes render as money coming back (invoiceDisplayAmount).
 * 3. Account shell owns page chrome: no inner max-w wrapper, no duplicate
 *    "Back to Account" link (breadcrumb + header already cover it).
 * 4. Detail leads with the compact document summary (type/number/status pill).
 * 5. Download still serves the server-generated PDF endpoint.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { API } from '@pawtag/shared/api';
import { getInvoiceStatusLabel, INVOICE_STATUS_LABELS, invoiceDisplayAmount } from '@pawtag/shared';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn() } }));
vi.mock('../../apps/web/src/lib/api', () => ({ default: apiMock }));

import Invoices from '../../apps/web/src/pages/account/Invoices';
import InvoiceDetail from '../../apps/web/src/pages/account/InvoiceDetail';

const listItem = {
  _id: 'inv1',
  invoiceNumber: 'INV-0001',
  amount: 24.99,
  currency: 'NZD',
  status: 'uncollectible',
  type: 'credit_note' as const,
  createdAt: '2026-08-01T00:00:00.000Z',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname}</div>;
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/account/invoices']}>
      <Routes>
        <Route
          path="/account/invoices"
          element={<Invoices />}
        />
        <Route path="/account/invoices/:id" element={<div data-testid="detail-page">detail</div>} />
      </Routes>
      {/* Outside Routes so it survives the navigation it is asserting. */}
      <LocationProbe />
    </MemoryRouter>,
  );
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/account/invoices/inv1']}>
      <Routes>
        <Route path="/account/invoices/:id" element={<InvoiceDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: { data: { data: [listItem], total: 1, hasMore: false } },
    }),
  );
});

describe('invoice status labels + display amount (shared config)', () => {
  it('covers every DB status with a human label', () => {
    expect(getInvoiceStatusLabel('paid')).toBe('Paid');
    expect(getInvoiceStatusLabel('pending')).toBe('Pending');
    expect(getInvoiceStatusLabel('failed')).toBe('Failed');
    expect(getInvoiceStatusLabel('refunded')).toBe('Refunded');
    expect(getInvoiceStatusLabel('void')).toBe('Void');
    expect(getInvoiceStatusLabel('uncollectible')).toBe('Uncollectible');
    // Unknown future values fall back to raw text instead of blanking out.
    expect(getInvoiceStatusLabel('something_new')).toBe('something_new');
    expect(Object.keys(INVOICE_STATUS_LABELS)).toHaveLength(6);
  });

  it('signs credit notes for display without double-minusing stored values', () => {
    expect(invoiceDisplayAmount('credit_note', 24.99)).toBe(-24.99);
    expect(invoiceDisplayAmount('credit_note', -12.5)).toBe(-12.5); // future negative payload
    expect(invoiceDisplayAmount('invoice', 99)).toBe(99);
  });
});

describe('invoice list page', () => {
  it('renders document cards with type label, configured status and signed credit amount', async () => {
    renderList();
    const number = await screen.findByText('INV-0001');
    const card = number.closest('article')!;
    expect(within(card).getByText('Uncollectible')).toBeDefined();
    expect(within(card).queryByText('uncollectible')).toBeNull();
    expect(within(card).getByText('Credit note')).toBeDefined(); // document type label
    // formatCurrency renders NZ$-24.99 — sign present, stored value untouched.
    expect(within(card).getByText(/NZ\$-24\.99/)).toBeDefined();
  });

  it('does not re-declare page chrome the account shell already provides', async () => {
    renderList();
    await screen.findByText('INV-0001');
    expect(screen.queryByText('Back to Account')).toBeNull();
    expect(document.querySelector('.max-w-3xl')).toBeNull();
  });

  it('uses valid card semantics — no button-like rows — and View details navigates', async () => {
    renderList();
    await screen.findByText('INV-0001');
    // The old pattern (role="button" row wrapping the controls) is gone.
    expect(document.querySelectorAll('[role="button"][tabindex]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('link', { name: /View details/ }));
    expect(screen.getByTestId('loc').textContent).toBe('/account/invoices/inv1');
    expect(screen.getByTestId('detail-page')).toBeDefined();
  });

  it('Download PDF still serves the server-generated endpoint (real file path)', async () => {
    renderList();
    await screen.findByText('INV-0001');
    fireEvent.click(screen.getByRole('button', { name: /Download PDF/ }));
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(
        API.customer.invoices.pdf('inv1'),
        expect.objectContaining({ responseType: 'blob' }),
      ),
    );
  });
});

describe('invoice detail page', () => {
  it('renders the configured status label in the summary', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          _id: 'inv1',
          invoiceNumber: 'INV-0001',
          amount: 24.99,
          currency: 'NZD',
          status: 'void',
          type: 'invoice',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      },
    });
    renderDetail();
    expect(await screen.findByText('Void')).toBeDefined();
    expect(screen.queryByText('void')).toBeNull();
  });

  // The credit-scope / fee rendering strings are source-guarded by
  // tests/unit/checkout-cpf-disclosure.test.tsx (runs in the same suite) —
  // not duplicated here.
});
