// @vitest-environment happy-dom
/**
 * Customer invoice portal — mobile UX packet (2026-10-26) regressions:
 *
 * 1. Keyboard: Enter pressed on an inner View/Download button must NOT also
 *    trigger the row's navigation handler (the row guard), while Enter on the
 *    row itself still opens details.
 * 2. Status copy comes from the shared INVOICE_STATUS_LABELS config — the raw
 *    enum ("uncollectible") must never render to customers.
 * 3. Account shell owns page chrome: no inner max-w wrapper, no duplicate
 *    "Back to Account" link on the list (breadcrumb + header already cover it).
 * 4. Credit note is a chip (StatusBadge), not inline date text.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { API } from '@pawtag/shared/api';
import { getInvoiceStatusLabel, INVOICE_STATUS_LABELS } from '@pawtag/shared';

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
  apiMock.get.mockImplementation((url: string) => {
    if (url.includes('/html')) {
      return Promise.resolve({ data: '<html><body>invoice doc</body></html>' });
    }
    return Promise.resolve({
      data: { data: { data: [listItem], total: 1, hasMore: false } },
    });
  });
});

describe('invoice status labels (shared config)', () => {
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
});

describe('invoice list page', () => {
  it('renders configured status labels and the credit-note chip, not raw enum text', async () => {
    renderList();
    const number = await screen.findByText('INV-0001');
    const row = number.closest('[role="button"]')!;
    expect(within(row).getByText('Uncollectible')).toBeDefined();
    expect(within(row).queryByText('uncollectible')).toBeNull();
    expect(within(row).getByText('Credit note')).toBeDefined();
  });

  it('does not re-declare page chrome the account shell already provides', async () => {
    renderList();
    await screen.findByText('INV-0001');
    expect(screen.queryByText('Back to Account')).toBeNull();
    expect(document.querySelector('.max-w-3xl')).toBeNull();
  });

  it('Enter on an inner action button does not also navigate to details (regression)', async () => {
    renderList();
    await screen.findByText('INV-0001');
    const viewButton = screen.getByLabelText('View INV-0001');

    fireEvent.keyDown(viewButton, { key: 'Enter' });
    // Pre-fix the row's onKeyDown caught the bubbled key and navigated away.
    expect(screen.getByTestId('loc').textContent).toBe('/account/invoices');

    // The click path still works: document opens, navigation still suppressed.
    fireEvent.click(viewButton);
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(API.customer.invoices.html('inv1')),
    );
    expect(screen.getByTestId('loc').textContent).toBe('/account/invoices');
  });

  it('Enter on the row itself still opens the detail route', async () => {
    renderList();
    const number = await screen.findByText('INV-0001');
    const row = number.closest('[role="button"]')!;
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(screen.getByTestId('loc').textContent).toBe('/account/invoices/inv1');
    expect(screen.getByTestId('detail-page')).toBeDefined();
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
