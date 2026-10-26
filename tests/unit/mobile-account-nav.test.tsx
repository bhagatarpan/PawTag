// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ACCOUNT_NAV_ITEMS, ACCOUNT_TABS, accountNavItemForPath } from '../../apps/web/src/components/account/navigation';
import BottomNav from '../../apps/web/src/components/account/BottomNav';

/**
 * Mobile UX packet (Phases A–B):
 * - the phone tab bar exposes exactly the five Phase 08 destinations, once,
 *   in order, off a single nav config shared with the sidebar/drawer;
 * - active state is exposed to assistive tech (aria-current), not just colour;
 * - the account shell renders the tab bar beside (not instead of) the desktop
 *   sidebar, and its account menu is reachable without hover.
 */

const authMock = vi.hoisted(() => ({
  logout: vi.fn(),
  refreshUser: vi.fn(),
}));

vi.mock('../../apps/web/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      fullName: 'Test Customer',
      email: 'customer@test.com',
      emailVerified: true,
      phoneVerified: true,
      onboardingCompleted: true,
    },
    logout: authMock.logout,
    refreshUser: authMock.refreshUser,
    isLoading: false,
  }),
}));

vi.mock('../../apps/web/src/hooks/useCms', () => ({
  useSiteSettings: () => ({ settings: {} }),
}));

vi.mock('../../apps/web/src/lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: { count: 0 } } }),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import AccountLayout from '../../apps/web/src/components/AccountLayout';

function renderTabs(initialPath = '/account') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('account nav config (single source of truth)', () => {
  it('exposes exactly the five Phase 08 tab destinations, in order', () => {
    expect(ACCOUNT_TABS.map((t) => t.tab.id)).toEqual([
      'home',
      'pets',
      'activate',
      'activity',
      'account',
    ]);
    expect(ACCOUNT_TABS.map((t) => t.path)).toEqual([
      '/account',
      '/account/pets',
      '/account/redeem-tag',
      // Activity intentionally resolves to the notification centre (spec §6.10)
      '/account/notifications',
      '/account/profile',
    ]);
  });

  it('never declares a tab without a sidebar/drawer entry', () => {
    const navPaths = new Set(ACCOUNT_NAV_ITEMS.map((n) => n.path));
    for (const tab of ACCOUNT_TABS) {
      expect(navPaths.has(tab.path)).toBe(true);
    }
  });

  it('gives detail routes their own breadcrumb labels from one config', () => {
    // Founder order mock: order/invoice detail pages show a specific title,
    // section routes keep their section names.
    expect(accountNavItemForPath('/account/orders/WO-000523')?.label).toBe('Order Details');
    expect(accountNavItemForPath('/account/invoices/INV-9')?.label).toBe('Invoice Details');
    expect(accountNavItemForPath('/account/orders')?.label).toBe('Orders');
    expect(accountNavItemForPath('/account/pets/pet1')?.label).toBe('My Pets');
    expect(accountNavItemForPath('/account/settings')?.label).toBe('Settings');
  });

  it('resolves sub-page routes to their owning section with a specific title (package Phase 1)', () => {
    // Before: these three fell back to a generic "Account" title with no
    // active sidebar/tab state anywhere.
    const cases: Array<[string, string, string]> = [
      ['/account/notification-preferences', 'Notification Preferences', '/account/notifications'],
      ['/account/upgrade', 'Subscription Upgrade', '/account/subscriptions'],
      ['/account/tag-activation-fee', 'Tag Activation Fee', '/account/redeem-tag'],
    ];
    for (const [route, label, sectionPath] of cases) {
      const item = accountNavItemForPath(route);
      expect(item?.label, route).toBe(label);
      expect(item?.path, route).toBe(sectionPath);
    }
  });
});

describe('BottomNav (phone tab bar)', () => {
  it('renders the five destinations as labelled links', () => {
    renderTabs();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Home', 'Pets', 'Activate', 'Activity', 'Account']);

    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/account');
    expect(within(nav).getByRole('link', { name: 'Activity' }).getAttribute('href')).toBe(
      '/account/notifications',
    );
  });

  it('marks only the current destination with aria-current', () => {
    renderTabs('/account/pets');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent?.trim())).toEqual(['Pets']);
  });

  it('does not mark the dashboard tab active on nested account routes', () => {
    renderTabs('/account/orders');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    // /account/orders is not a tab destination: no tab claims it.
    expect(current).toEqual([]);
  });

  it('lights the owning tab on sub-pages that are not tab destinations themselves', () => {
    // Notification preferences belongs to Activity; activation fee to the
    // Activate tab — both previously rendered with NO active tab.
    renderTabs('/account/notification-preferences');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent?.trim())).toEqual(['Activity']);
  });

  it('lights the Activate tab for the activation-fee step', () => {
    renderTabs('/account/tag-activation-fee');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent?.trim())).toEqual(['Activate']);
  });

  it('announces the unread count on the Activity tab and hides it at zero', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/account']}>
        <BottomNav unreadCount={7} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByText('7 unread notifications')).toBeTruthy();
    expect(within(nav).getByText('7')).toBeTruthy();
    unmount();

    render(
      <MemoryRouter initialEntries={['/account']}>
        <BottomNav unreadCount={0} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/unread notifications/)).toBeNull();
  });
});

describe('AccountLayout (tab bar + desktop sidebar coexist)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderLayout(initialPath = '/account') {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AccountLayout>
          <div>page content</div>
        </AccountLayout>
      </MemoryRouter>,
    );
  }

  it('renders the phone tab bar beside the desktop sidebar nav', () => {
    renderLayout();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    const sections = screen.getAllByRole('navigation', { name: 'Account sections' });
    expect(sections.length).toBeGreaterThanOrEqual(1);

    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Activity' }).getAttribute('href')).toBe(
      '/account/notifications',
    );
  });

  it('exposes the active section with aria-current in the sidebar list', () => {
    renderLayout('/account/pets');
    const sections = screen.getAllByRole('navigation', { name: 'Account sections' });
    const current = within(sections[0])
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toContain('My Pets');
    expect(current).toHaveLength(1);
  });

  it('keeps the owning sidebar section lit and titles the sub-page correctly (package Phase 1)', () => {
    renderLayout('/account/notification-preferences');
    const sections = screen.getAllByRole('navigation', { name: 'Account sections' });
    const current = within(sections[0])
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toContain('Notifications');
    expect(current).toHaveLength(1);
    // Header + breadcrumb both show the specific title (a fallback would
    // render neither — the bottom tab's own "Account" label is unrelated).
    expect(screen.getAllByText('Notification Preferences')).toHaveLength(2);
  });

  it('opens and closes the account menu by click and Escape (no hover needed)', () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: 'Account menu' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Sign out')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Sign out')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Sign out')).toBeNull();
  });
});
