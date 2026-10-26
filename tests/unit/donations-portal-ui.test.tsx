// @vitest-environment happy-dom
/**
 * Donation portal — invoice-structure packet (owner request 2026-10-26):
 *
 * 1. Shared status/frequency labels — raw enum text ("succeeded") never
 *    renders; pastDue keeps the portal's existing "Payment pending" wording.
 * 2. List = invoice-twin document cards: pills, full-label View details link
 *    + receipt-gated Download PDF, secondary Cancel, impact stats computed
 *    client-side (mixed currencies hide the total instead of summing).
 * 3. NEW detail route /account/donations/:id renders from the existing
 *    donations.me projection (no API change): summary + payment history +
 *    receipt actions (desktop sticky + mobile fixed bar) + not-found state.
 * 4. Receipt/cancel endpoint contracts unchanged.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { API } from '@pawtag/shared/api';
import {
  getDonationStatusLabel,
  getDonationStatusVariant,
  getInvoiceStatusLabel,
} from '@pawtag/shared';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../apps/web/src/lib/api', () => ({ default: apiMock }));
vi.mock('../../apps/web/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { fullName: 'Test Donor', email: 'donor@test.com' },
    isLoading: false,
  }),
}));

import MyDonations from '../../apps/web/src/pages/account/MyDonations';
import DonationDetail from '../../apps/web/src/pages/account/DonationDetail';
import { accountNavItemForPath } from '../../apps/web/src/components/account/navigation';

const monthly = {
  id: 'dn1',
  amountCents: 2500,
  currency: 'NZD',
  frequency: 'monthly',
  status: 'succeeded',
  pastDue: false,
  createdAt: '2026-03-15T00:00:00.000Z',
  receiptId: 'rc1',
  receiptNumber: 'RC-1',
  payments: [
    { id: 'p3', amountCents: 2500, status: 'succeeded', paidAt: '2026-03-15T00:00:00.000Z', receiptId: 'r3', receiptNumber: 'RC-3' },
    { id: 'p2', amountCents: 2500, status: 'succeeded', paidAt: '2026-02-15T00:00:00.000Z', receiptId: 'r2', receiptNumber: 'RC-2' },
  ],
};

const oneTimeNoReceipt = {
  id: 'dn2',
  amountCents: 10000,
  currency: 'NZD',
  frequency: 'one_time',
  status: 'succeeded',
  pastDue: false,
  createdAt: '2026-01-05T00:00:00.000Z',
  payments: [],
};

const cancelledMonthly = {
  id: 'dn3',
  amountCents: 2500,
  currency: 'NZD',
  frequency: 'monthly',
  status: 'cancelled',
  cancelledAt: '2026-02-01T00:00:00.000Z',
  createdAt: '2025-12-15T00:00:00.000Z',
  receiptId: 'rc3',
  receiptNumber: 'RC-9',
  payments: [],
};

function mockApi(items: any[]) {
  apiMock.get.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/receipt/') && u.endsWith('/html')) {
      return Promise.resolve({ data: '<html><body>receipt</body></html>' });
    }
    if (u === API.donations.me) {
      return Promise.resolve({ data: { data: items } });
    }
    return Promise.resolve({ data: { data: null } });
  });
  apiMock.post.mockResolvedValue({ data: { data: {} } });
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/account/donations']}>
      <Routes>
        <Route path="/account/donations" element={<MyDonations />} />
        <Route path="/account/donations/:id" element={<div data-testid="detail-page" />} />
        <Route path="/donate" element={<div />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/account/donations/${id}`]}>
      <Routes>
        <Route path="/account/donations/:id" element={<DonationDetail />} />
        <Route path="/account/donations" element={<div data-testid="list-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const readSrc = (rel: string) => readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  mockApi([monthly, oneTimeNoReceipt, cancelledMonthly]);
});

describe('donation status/frequency labels (shared config)', () => {
  it('covers every DB status with a human label; pastDue wins with existing wording', () => {
    expect(getDonationStatusLabel('pending')).toBe('Pending');
    expect(getDonationStatusLabel('processing')).toBe('Processing');
    expect(getDonationStatusLabel('succeeded')).toBe('Completed');
    expect(getDonationStatusLabel('failed')).toBe('Failed');
    expect(getDonationStatusLabel('cancelled')).toBe('Cancelled');
    expect(getDonationStatusLabel('partially_refunded')).toBe('Partially refunded');
    expect(getDonationStatusLabel('refunded')).toBe('Refunded');
    expect(getDonationStatusLabel('succeeded', true)).toBe('Payment pending');
    expect(getDonationStatusLabel('future_state')).toBe('future_state');
    expect(getDonationStatusVariant('succeeded')).toBe('success');
    expect(getDonationStatusVariant('failed')).toBe('danger');
    expect(getDonationStatusVariant('succeeded', true)).toBe('warning');
  });

  it('invoice labels still resolve (no cross-package regression)', () => {
    expect(getInvoiceStatusLabel('uncollectible')).toBe('Uncollectible');
  });
});

describe('My Donations list', () => {
  it('renders invoice-twin cards with pills, no raw enum text, and full-label controls', async () => {
    renderList();
    expect(await screen.findByText('Receipt RC-1')).toBeDefined();
    // Configured pills, never raw enum text.
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('succeeded')).toBeNull();
    expect(screen.getByText('One-time')).toBeDefined();
    expect(screen.getByText('Cancelled')).toBeDefined();
    // Both monthly fixtures carry the frequency pill.
    expect(screen.getAllByText('Monthly').length).toBeGreaterThanOrEqual(1);
    // Subtitle per the board.
    expect(screen.getByText(/Thank you for making a kinder world/)).toBeDefined();
    // Valid semantics: no button-like rows.
    expect(document.querySelectorAll('[role="button"][tabindex]')).toHaveLength(0);
    const links = screen.getAllByRole('link', { name: /View details/ });
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute('href')).toBe('/account/donations/dn1');
  });

  it('gates Download PDF by receipt eligibility and keeps Cancel secondary', async () => {
    renderList();
    await screen.findByText('Receipt RC-1');
    // dn1 has a receipt → Download present; dn2 has none and cancelled dn3 is
    // excluded by the unchanged `status === 'succeeded'` gate → exactly one.
    expect(screen.getAllByRole('button', { name: /Download PDF/ })).toHaveLength(1);
    // Cancel only for the active monthly donation — not the cancelled one.
    expect(screen.getAllByRole('button', { name: /Cancel monthly/ })).toHaveLength(1);
  });

  it('computes impact stats client-side (succeeded payments + fallback amount)', async () => {
    renderList();
    await screen.findByText('Receipt RC-1');
    // 2×2500 (succeeded payments) + 10000 (completed donation without rows) = 125.00
    expect(screen.getByText(/150\.00/)).toBeDefined();
    expect(screen.getByText('Total Donated')).toBeDefined();
    expect(screen.getByText('lives supported')).toBeDefined();
    expect(screen.getByText('Donation History')).toBeDefined();
  });

  it('hides the total for mixed-currency histories instead of summing across currencies', async () => {
    mockApi([
      monthly,
      { ...oneTimeNoReceipt, id: 'dnX', currency: 'USD', payments: [{ id: 'px', amountCents: 500, status: 'succeeded' }] },
    ]);
    renderList();
    await screen.findByText('Receipt RC-1');
    expect(screen.queryByText('Total Donated')).toBeNull();
    expect(screen.getByText('Donation History')).toBeDefined();
  });

  it('shows the empty state with a real donate CTA', async () => {
    mockApi([]);
    renderList();
    expect(await screen.findByText('You have not made a donation yet.')).toBeDefined();
    expect(screen.getByRole('link', { name: /Donate now/ }).getAttribute('href')).toBe('/donate');
  });

  it('cancel posts to the existing endpoint', async () => {
    renderList();
    await screen.findByText('Receipt RC-1');
    (window as any).confirm = vi.fn().mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Cancel monthly/ }));
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith(API.donations.cancel('dn1')));
  });
});

describe('Donation detail page', () => {
  it('renders the summary, payment history and receipt actions from the list projection', async () => {
    renderDetail('dn1');
    expect(await screen.findByRole('heading', { level: 1, name: 'RC-1' })).toBeDefined();
    // Summary: type line, big amount, status pill, date, cancelled note absent.
    expect(screen.getByText(/Monthly donation · Receipt RC-1/)).toBeDefined();
    // Summary pill + one pill per payment row.
    expect(screen.getAllByText('Completed')).toHaveLength(3);
    // Summary amount + both payment rows + the mobile fixed bar.
    expect(screen.getAllByText('NZ$25.00')).toHaveLength(4);
    expect(screen.getByText(/Given 15 March 2026/)).toBeDefined();
    // Payment history (demoted from the list).
    expect(screen.getByRole('heading', { name: 'Payments (2)' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /View receipt/ }).length).toBeGreaterThanOrEqual(1);
    // Desktop sticky + mobile fixed bar contracts.
    expect(document.querySelector('.sticky')).not.toBeNull();
    expect(document.querySelector('.fixed.bottom-\\[var\\(--app-bottom-nav-height\\)\\]')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Back to donations/ })).toBeDefined();
  });

  it('View Receipt fetches the receipt HTML endpoint', async () => {
    renderDetail('dn1');
    await screen.findByRole('heading', { level: 1, name: 'RC-1' });
    fireEvent.click(screen.getAllByRole('button', { name: /View Receipt/ })[0]);
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(API.donations.receiptHtml('rc1')),
    );
  });

  it('Download hits the server PDF endpoint', async () => {
    renderDetail('dn1');
    await screen.findByRole('heading', { level: 1, name: 'RC-1' });
    fireEvent.click(screen.getAllByRole('button', { name: /Download PDF/ })[0]);
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(
        API.donations.receiptDownload('rc1'),
        expect.objectContaining({ responseType: 'blob' }),
      ),
    );
  });

  it('shows a recoverable not-found state for unknown ids (no crash)', async () => {
    renderDetail('nope');
    expect(await screen.findByText('Donation not found')).toBeDefined();
    expect(screen.getByRole('link', { name: /Back to donations/ })).toBeDefined();
  });

  it('omits receipt actions for a completed donation without a receipt', async () => {
    renderDetail('dn2');
    expect(await screen.findByText(/One-time donation/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /View Receipt/ })).toBeNull();
    expect(screen.queryByText('Payments (')).toBeNull();
    // No fixed bar when there are no actions to reach.
    expect(document.querySelector('.fixed.bottom-\\[var\\(--app-bottom-nav-height\\)\\]')).toBeNull();
  });
});

describe('route + navigation wiring (source guards)', () => {
  it('App registers the detail route inside the shell', () => {
    const src = readSrc('apps/web/src/App.tsx');
    expect(src).toContain('path="/account/donations/:id"');
    expect(src).toContain('<AccountLayout><DonationDetail />');
  });

  it('detail route resolves the Donation Details breadcrumb label', () => {
    const item = accountNavItemForPath('/account/donations/dn1');
    expect(item?.label).toBe('Donation Details');
    expect(item?.path).toBe('/account/donations');
    // List keeps its section label.
    expect(accountNavItemForPath('/account/donations')?.label).toBe('My Donations');
  });
});
