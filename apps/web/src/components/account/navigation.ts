import type { LucideIcon } from 'lucide-react';
import {
  PawPrint,
  User,
  ShoppingBag,
  Bell,
  Settings,
  CreditCard,
  QrCode,
  Gift,
  LayoutDashboard,
  Shield,
  Crown,
  FileText,
  Heart,
} from 'lucide-react';

/**
 * Single source of truth for customer account navigation.
 *
 * The sidebar (desktop), the slide-over drawer (phone) and the bottom tab bar
 * (phone) all read from ACCOUNT_NAV_ITEMS — destinations, labels and icons are
 * declared once so the three surfaces cannot drift apart.
 */

/**
 * Phone bottom-tab identities (Phase 08 app navigation model:
 * Home | Pets | Activate | Activity | Account).
 *
 * `activity` intentionally resolves to the notification centre: one
 * Activity/Notifications destination (mobile UX spec §6.10), not a new page.
 */
export type AccountTabId = 'home' | 'pets' | 'activate' | 'activity' | 'account';

export interface AccountNavItem {
  /** Customer route. */
  path: string;
  /** Label used in the sidebar and drawer. */
  label: string;
  icon: LucideIcon;
  /** Present only for destinations surfaced in the phone bottom tab bar. */
  tab?: {
    id: AccountTabId;
    /** Short label used in the tab bar. */
    label: string;
  };
}

export const ACCOUNT_NAV_ITEMS: AccountNavItem[] = [
  {
    path: '/account',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tab: { id: 'home', label: 'Home' },
  },
  { path: '/account/pets', label: 'My Pets', icon: PawPrint, tab: { id: 'pets', label: 'Pets' } },
  {
    path: '/account/profile',
    label: 'Profile',
    icon: User,
    tab: { id: 'account', label: 'Account' },
  },
  { path: '/account/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/account/invoices', label: 'Invoices', icon: FileText },
  { path: '/account/donations', label: 'My Donations', icon: Heart },
  { path: '/account/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { path: '/account/guardian', label: 'Guardian', icon: Shield },
  { path: '/account/membership', label: 'Membership', icon: Crown },
  {
    path: '/account/redeem-tag',
    label: 'Activate Tag',
    icon: QrCode,
    tab: { id: 'activate', label: 'Activate' },
  },
  {
    path: '/account/notifications',
    label: 'Notifications',
    icon: Bell,
    tab: { id: 'activity', label: 'Activity' },
  },
  { path: '/account/referrals', label: 'Referrals', icon: Gift },
  { path: '/account/settings', label: 'Settings', icon: Settings },
];

/** Display order of the bottom tab bar (spec: Home | Pets | Activate | Activity | Account). */
const TAB_ORDER: AccountTabId[] = ['home', 'pets', 'activate', 'activity', 'account'];

export interface AccountTabItem extends AccountNavItem {
  tab: { id: AccountTabId; label: string };
}

/**
 * Bottom tab bar entries in display order, derived from ACCOUNT_NAV_ITEMS.
 * A tab id without a matching nav entry is a config error and fails fast at
 * module load (surfaced by any test importing this module).
 */
export const ACCOUNT_TABS: AccountTabItem[] = TAB_ORDER.map((id): AccountTabItem => {
  const item = ACCOUNT_NAV_ITEMS.find((n) => n.tab?.id === id);
  if (!item?.tab) {
    throw new Error(`ACCOUNT_NAV_ITEMS has no entry with tab id "${id}"`);
  }
  return { ...item, tab: item.tab };
});

/**
 * Active-state rule shared by the sidebar, drawer and current-page label:
 * the dashboard matches exactly (it is the prefix of every other account
 * route); everything else matches by path prefix so nested detail pages
 * (e.g. /account/orders/123) keep their section highlighted.
 */
export function isAccountNavActive(path: string, pathname: string): boolean {
  return path === '/account' ? pathname === '/account' : pathname.startsWith(path);
}

/**
 * Route label + owning-section overrides (founder order mock 2026-10-26;
 * implementation-package Phase 1): detail and sub-page routes get their own
 * breadcrumb/header title AND resolve to their parent section, so the
 * sidebar, drawer and bottom tabs keep the right item highlighted even
 * though these routes are not nav entries themselves. Matched by prefix;
 * unlisted routes resolve to their section by path prefix.
 */
const ROUTE_OVERRIDES: ReadonlyArray<{ prefix?: string; suffix?: string; label: string; sectionPath: string }> = [
  { prefix: '/account/orders/', label: 'Order Details', sectionPath: '/account/orders' },
  { prefix: '/account/invoices/', label: 'Invoice Details', sectionPath: '/account/invoices' },
  { prefix: '/account/donations/', label: 'Donation Details', sectionPath: '/account/donations' },
  { prefix: '/account/notification-preferences', label: 'Notification Preferences', sectionPath: '/account/notifications' },
  { prefix: '/account/upgrade', label: 'Subscription Upgrade', sectionPath: '/account/subscriptions' },
  { prefix: '/account/tag-activation-fee', label: 'Tag Activation Fee', sectionPath: '/account/redeem-tag' },
  // Suffix match: /account/pets/:id/health carries a dynamic segment that no
  // static prefix can capture.
  { suffix: '/health', label: 'Health Records', sectionPath: '/account/pets' },
];

/**
 * Breadcrumb/header label + owning nav item for a route. The returned item
 * carries the override label and is the single source for ACTIVE STATES too
 * (sidebar, drawer, bottom tabs) — titles and highlights cannot disagree.
 * Falls back to section prefix matching; callers render 'Account' on undefined.
 */
export function accountNavItemForPath(pathname: string): AccountNavItem | undefined {
  const override = ROUTE_OVERRIDES.find(
    (o) =>
      (o.prefix !== undefined && pathname.startsWith(o.prefix)) ||
      (o.suffix !== undefined && pathname.endsWith(o.suffix)),
  );
  if (override) {
    const section = ACCOUNT_NAV_ITEMS.find((n) => n.path === override.sectionPath);
    return section ? { ...section, label: override.label } : undefined;
  }
  return ACCOUNT_NAV_ITEMS.find((n) => isAccountNavActive(n.path, pathname));
}
