import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent: boolean;
}

const ROUTE_MAP: Record<string, { section: string; page: string }> = {
  '/': { section: '', page: 'Dashboard' },
  // Users & Pets
  '/users/customers': { section: 'Users & Pets', page: 'Customers' },
  '/users/admin': { section: 'Users & Pets', page: 'Admin Users' },
  '/pets': { section: 'Users & Pets', page: 'Pets' },
  // Catalog
  '/products': { section: 'Catalog', page: 'Products' },
  '/categories': { section: 'Catalog', page: 'Categories' },
  '/collections': { section: 'Catalog', page: 'Collections' },
  '/brands': { section: 'Catalog', page: 'Brands' },
  '/tags': { section: 'Catalog', page: 'Tags' },
  // Inventory
  '/inventory': { section: 'Inventory', page: 'Stock' },
  '/inventory/adjustments': { section: 'Inventory', page: 'Adjustments' },
  '/inventory/history': { section: 'Inventory', page: 'Stock History' },
  // Orders & Fulfilment
  '/orders': { section: 'Orders & Fulfilment', page: 'All Orders' },
  '/orders/pending': { section: 'Orders & Fulfilment', page: 'Pending' },
  '/orders/processing': { section: 'Orders & Fulfilment', page: 'Processing' },
  '/invoices': { section: 'Orders & Fulfilment', page: 'Invoices' },
  '/shipping/shipments': { section: 'Orders & Fulfilment', page: 'Shipments' },
  '/returns': { section: 'Orders & Fulfilment', page: 'Returns' },
  // Payments & Refunds
  '/payments': { section: 'Payments & Refunds', page: 'Transactions' },
  '/refunds': { section: 'Payments & Refunds', page: 'Refunds' },
  '/refund-report': { section: 'Payments & Refunds', page: 'Refund Report' },
  '/payments/reconciliation': { section: 'Payments & Refunds', page: 'Reconciliation' },
  '/shipping/methods': { section: 'Payments & Refunds', page: 'Shipping Methods' },
  '/stripe-report': { section: 'Payments & Refunds', page: 'Stripe Report' },
  // Tag Subscriptions
  '/subscription-plans': { section: 'Tag Subscriptions', page: 'Subscription Plans' },
  '/customer-subscriptions': { section: 'Tag Subscriptions', page: 'Customer Subscriptions' },
  // Guardian Loyalty
  '/guardian': { section: 'Guardian Loyalty', page: 'Guardian Dashboard' },
  '/guardian/members': { section: 'Guardian Loyalty', page: 'Members' },
  '/guardian/analytics': { section: 'Guardian Loyalty', page: 'Analytics' },
  '/guardian/settings': { section: 'Guardian Loyalty', page: 'Guardian Settings' },
  // Discounts & Promotions
  '/discounts': { section: 'Discounts & Promotions', page: 'Discount Codes' },
  '/referrals': { section: 'Discounts & Promotions', page: 'Referral Program' },
  // Communication
  '/notifications': { section: 'Communication', page: 'Notifications' },
  '/support-requests': { section: 'Communication', page: 'Support Requests' },
  '/tag-expiry-notifications': { section: 'Communication', page: 'Tag Expiry Alerts' },
  // Content (CMS)
  '/cms/pages': { section: 'Content (CMS)', page: 'Pages' },
  '/cms/navigation': { section: 'Content (CMS)', page: 'Navigation' },
  '/cms/footer': { section: 'Content (CMS)', page: 'Footer' },
  '/cms/media': { section: 'Content (CMS)', page: 'Media Library' },
  '/cms/announcements': { section: 'Content (CMS)', page: 'Announcements' },
  '/cms/redirects': { section: 'Content (CMS)', page: 'Redirects' },
  '/cms/email-templates': { section: 'Content (CMS)', page: 'Email Templates' },
  '/cms/sms-templates': { section: 'Content (CMS)', page: 'SMS Templates' },
  '/cms/pet-references': { section: 'Content (CMS)', page: 'Pet References' },
  '/cms/homepage': { section: 'Content (CMS)', page: 'Homepage' },
  '/cms/shop-pages': { section: 'Content (CMS)', page: 'Shop Pages' },
  '/cms/auth-pages': { section: 'Content (CMS)', page: 'Auth Pages' },
  '/cms/invoice-template': { section: 'Content (CMS)', page: 'Invoice Template' },
  '/cms/onboarding': { section: 'Content (CMS)', page: 'Onboarding' },
  // Settings
  '/commerce-settings': { section: 'Settings', page: 'Commerce Settings' },
  '/settings': { section: 'Settings', page: 'General Settings' },
  '/site-availability': { section: 'Settings', page: 'Site Availability' },
  '/address-autocomplete': { section: 'Settings', page: 'Address Autocomplete' },
  // Security & Access
  '/rbac/roles': { section: 'Security & Access', page: 'Roles & Permissions' },
  '/rbac/permissions': { section: 'Security & Access', page: 'Permissions' },
  '/rbac/permission-groups': { section: 'Security & Access', page: 'Permission Groups' },
  '/rbac/scopes': { section: 'Security & Access', page: 'Access Scopes' },
  '/audit-trail': { section: 'Security & Access', page: 'Audit Trail' },
  '/audit-settings': { section: 'Security & Access', page: 'Audit Settings' },
  // Operations
  '/feature-flags': { section: 'Operations', page: 'Feature Flags' },
  '/webhooks': { section: 'Operations', page: 'Webhooks' },
  '/system-logs': { section: 'Operations', page: 'System Logs' },
  '/system-log-settings': { section: 'Operations', page: 'Log Settings' },
  '/statistics': { section: 'Operations', page: 'Statistics' },
  '/write-nfc': { section: 'Operations', page: 'Write NFC Tag' },
};

function findMatchingRoute(pathname: string): { section: string; page: string; sectionPath: string } | null {
  if (pathname === '/') {
    return { section: '', page: 'Dashboard', sectionPath: '/' };
  }

  // Exact match first
  if (ROUTE_MAP[pathname]) {
    const match = ROUTE_MAP[pathname];
    const sectionPath = match.section ? `/${pathname.split('/')[1]}` : '/';
    return { ...match, sectionPath };
  }

  // Longest-prefix match for parameterized routes
  const segments = pathname.split('/').filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const candidate = '/' + segments.slice(0, i).join('/');
    if (ROUTE_MAP[candidate]) {
      const match = ROUTE_MAP[candidate];
      return {
        ...match,
        sectionPath: candidate,
      };
    }
  }

  return null;
}

function resolveSectionPath(section: string, currentPath: string): string | null {
  if (!section) return null;

  const firstSegment = '/' + currentPath.split('/')[1];
  // Find a route in the section to derive the section path
  for (const [path, meta] of Object.entries(ROUTE_MAP)) {
    if (meta.section === section && path.startsWith(firstSegment)) {
      return firstSegment;
    }
  }
  return null;
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const { pathname } = useLocation();

  return useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/', isCurrent: false },
    ];

    if (pathname === '/') {
      items.push({ label: 'Dashboard', isCurrent: true });
      return items;
    }

    const match = findMatchingRoute(pathname);
    if (!match) {
      items.push({ label: 'Page', isCurrent: true });
      return items;
    }

    if (match.section) {
      const sectionPath = resolveSectionPath(match.section, pathname);
      items.push({
        label: match.section,
        href: sectionPath || undefined,
        isCurrent: false,
      });
    }

    items.push({
      label: match.page,
      isCurrent: true,
    });

    return items;
  }, [pathname]);
}
