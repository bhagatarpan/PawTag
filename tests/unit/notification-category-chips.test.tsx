// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Packet 1d (board 2, screen 2): All / Orders / Pets / Account filter chips.
 * The category mapping is grounded in the Notification model's real type
 * enum — this test pins representative real types to the right bucket.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() }));

vi.mock('../../apps/web/src/lib/api', () => ({ default: api }));

import Notifications from '../../apps/web/src/pages/account/Notifications';

const NOTIFICATIONS = [
  { _id: 'n1', type: 'order_update', title: 'Order shipped', message: 'PT-10483 is on the way', read: false, createdAt: new Date().toISOString(), priority: 'normal' },
  { _id: 'n2', type: 'pet_lost', title: 'Buddy is missing', message: 'Lost Mode started', read: false, createdAt: new Date().toISOString(), priority: 'high' },
  { _id: 'n3', type: 'finder_scan', title: 'Tag scanned', message: 'Someone scanned Buddy’s tag', read: true, createdAt: new Date().toISOString(), priority: 'normal' },
  { _id: 'n4', type: 'system', title: 'Scheduled maintenance', message: 'Sunday 2am', read: true, createdAt: new Date().toISOString(), priority: 'low' },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: NOTIFICATIONS } });
  api.put.mockResolvedValue({ data: {} });
});

function renderPage() {
  return render(<Notifications />);
}

describe('Notification category chips', () => {
  it('shows All/Orders/Pets/Account with live counts from real types', async () => {
    renderPage();
    const group = await screen.findByRole('group', { name: 'Filter notifications' });
    const labels = Array.from(group.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(['All (4)', 'Orders (1)', 'Pets (2)', 'Account (1)']);
  });

  it('filters to order-type notifications only', async () => {
    renderPage();
    const group = await screen.findByRole('group', { name: 'Filter notifications' });
    fireEvent.click(screen.getByRole('button', { name: 'Orders (1)' }));
    expect(screen.getByText('Order shipped')).toBeTruthy();
    expect(screen.queryByText('Buddy is missing')).toBeNull();
    expect(screen.queryByText('Tag scanned')).toBeNull();
    expect(screen.queryByText('Scheduled maintenance')).toBeNull();
    expect(group).toBeTruthy();
  });

  it('filters to pet-type notifications only (lost + finder scan)', async () => {
    renderPage();
    await screen.findByRole('group', { name: 'Filter notifications' });
    fireEvent.click(screen.getByRole('button', { name: 'Pets (2)' }));
    expect(screen.getByText('Buddy is missing')).toBeTruthy();
    expect(screen.getByText('Tag scanned')).toBeTruthy();
    expect(screen.queryByText('Order shipped')).toBeNull();
    expect(screen.queryByText('Scheduled maintenance')).toBeNull();
  });

  it('account bucket catches the rest, and All restores everything', async () => {
    renderPage();
    await screen.findByRole('group', { name: 'Filter notifications' });
    fireEvent.click(screen.getByRole('button', { name: 'Account (1)' }));
    expect(screen.getByText('Scheduled maintenance')).toBeTruthy();
    expect(screen.queryByText('Order shipped')).toBeNull();
    expect(screen.queryByText('Buddy is missing')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All (4)' }));
    expect(screen.getByText('Order shipped')).toBeTruthy();
    expect(screen.getByText('Buddy is missing')).toBeTruthy();
    expect(screen.getByText('Scheduled maintenance')).toBeTruthy();
  });
});
