import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  PawPrint,
  QrCode,
  ShoppingBag,
  FileText,
  Settings,
  Flag,
  BarChart3,
  Shield,
  Key,
  FolderTree,
  Target,
  Globe,
  Layout,
  Navigation,
  PanelBottom,
  Image,
  Megaphone,
  ArrowRightLeft,
  Mail,
  MessageSquare,
  Database,
  Monitor,
  ShoppingCart,
  LogIn,
  CreditCard,
  FileSignature,
  Gift,
  AlertTriangle,
  Bell,
  Wifi,
  ClipboardCheck,
  Terminal,
  MapPin,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Zap,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Tag,
  RotateCcw,
  Clock,
  Activity,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../hooks/useTheme';
import { useSidebarCollapse } from '../hooks/useSidebarCollapse';
import api from '../lib/api';

interface SidebarLink {
  to: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  external?: boolean;
  href?: string;
}

interface SidebarSection {
  id: string;
  label: string;
  icon: React.ElementType;
  links: SidebarLink[];
}

const sections: SidebarSection[] = [
  // ─── Shop & Commerce ─────────────────────────────────────
  {
    id: 'commerce',
    label: 'Shop & Commerce',
    icon: ShoppingCart,
    links: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: ShoppingBag,
    links: [
      { to: '/categories', label: 'Categories', icon: FolderTree, permission: 'product.read' },
      { to: '/collections', label: 'Collections', icon: Database, permission: 'product.read' },
      { to: '/brands', label: 'Brands', icon: Target, permission: 'product.read' },
    ],
  },
  {
    id: 'products-services',
    label: 'PawTag Products & Services',
    icon: Package,
    links: [
      { to: '/products', label: 'Products', icon: ShoppingBag, permission: 'product.read' },
      { to: '/tags', label: 'Tags', icon: QrCode, permission: 'tag.read' },
      { to: '/subscription-plans', label: 'Subscriptions', icon: CreditCard, permission: 'product.read' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    links: [
      { to: '/inventory', label: 'Stock', icon: Package, permission: 'inventory.read' },
      { to: '/inventory/adjustments', label: 'Adjustments', icon: AlertTriangle, permission: 'inventory.adjust' },
      { to: '/inventory/history', label: 'Stock History', icon: Database, permission: 'inventory.read' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: FileText,
    links: [
      { to: '/orders', label: 'All Orders', icon: FileText, permission: 'order.read' },
      { to: '/orders/pending', label: 'Pending', icon: Clock, permission: 'order.read' },
      { to: '/orders/processing', label: 'Processing', icon: Activity, permission: 'order.read' },
      { to: '/orders/shipped', label: 'Shipped', icon: Truck, permission: 'order.read' },
      { to: '/orders/delivered', label: 'Delivered', icon: CheckCircle, permission: 'order.read' },
      { to: '/orders/cancelled', label: 'Cancelled', icon: XCircle, permission: 'order.read' },
      { to: '/invoices', label: 'Invoices', icon: FileText, permission: 'order.read' },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    links: [
      { to: '/users/customers', label: 'Customers', icon: Users, permission: 'user.read' },
      { to: '/users/admin', label: 'Users', icon: Users, permission: 'user.read' },
      { to: '/pets', label: 'Pets', icon: PawPrint, permission: 'pet.read' },
    ],
  },
  {
    id: 'discounts',
    label: 'Discounts',
    icon: Tag,
    links: [
      { to: '/discounts', label: 'Discount Codes', icon: Tag, permission: 'product.read' },
      { to: '/referrals', label: 'Referral Program', icon: Gift, permission: 'product.read' },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    links: [
      { to: '/payments', label: 'Transactions', icon: CreditCard, permission: 'order.read' },
      { to: '/refunds', label: 'Refunds', icon: RotateCcw, permission: 'order.refund' },
      { to: '/refund-report', label: 'Refund Report', icon: FileText, permission: 'order.refund' },
      { to: '/payments/refunds', label: 'Old Refunds', icon: RotateCcw, permission: 'order.refund' },
      { to: '/payments/reconciliation', label: 'Reconciliation', icon: AlertTriangle, permission: 'order.read' },
    ],
  },
  {
    id: 'shipping',
    label: 'Shipping',
    icon: Truck,
    links: [
      { to: '/shipping/methods', label: 'Methods', icon: Truck, permission: 'setting.read' },
      { to: '/shipping/rates', label: 'Rates', icon: BarChart3, permission: 'setting.read' },
      { to: '/shipping/shipments', label: 'Shipments', icon: Truck, permission: 'order.read' },
    ],
  },
  {
    id: 'fulfilment',
    label: 'Fulfilment',
    icon: ClipboardCheck,
    links: [
      { to: '/fulfilment', label: 'All Fulfilments', icon: ClipboardCheck, permission: 'order.read' },
      { to: '/fulfilment/pending', label: 'Pending', icon: Clock, permission: 'order.read' },
      { to: '/fulfilment/picking', label: 'Picking', icon: Package, permission: 'order.read' },
      { to: '/fulfilment/packing', label: 'Packing', icon: Package, permission: 'order.read' },
      { to: '/fulfilment/fulfilled', label: 'Fulfilled', icon: CheckCircle, permission: 'order.read' },
    ],
  },
  {
    id: 'returns',
    label: 'Returns',
    icon: RotateCcw,
    links: [
      { to: '/returns', label: 'Return Requests', icon: RotateCcw, permission: 'order.read' },
    ],
  },
  {
    id: 'tax',
    label: 'Tax',
    icon: Receipt,
    links: [
      { to: '/tax', label: 'Tax Configuration', icon: Receipt, permission: 'setting.read' },
    ],
  },
  // ─── Existing Sections ────────────────────────────────────
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    links: [
      { to: '/reports', label: 'Commerce Reports', icon: BarChart3, permission: 'stats.read' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: MessageSquare,
    links: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/support-requests', label: 'Support Requests', icon: MessageSquare },
      { to: '/tag-expiry-notifications', label: 'Tag Expiry Alerts', icon: AlertTriangle },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: Layout,
    links: [
      { to: '/cms/announcements', label: 'Announcements', icon: Megaphone, permission: 'cms.announcement.read' },
      { to: '/cms/auth-pages', label: 'Auth Pages', icon: LogIn, permission: 'cms.auth_page.read' },
      { to: '/cms/onboarding', label: 'Customer Onboarding', icon: ClipboardCheck, permission: 'cms.onboarding.read' },
      { to: '/cms/footer', label: 'Footer', icon: PanelBottom, permission: 'cms.footer.read' },
      { to: '/cms/homepage', label: 'Homepage Sections', icon: Monitor, permission: 'cms.homepage.read' },
      { to: '/cms/invoice-template', label: 'Invoice Template', icon: FileSignature, permission: 'cms.email_template.read' },
      { to: '/cms/media', label: 'Media Library', icon: Image, permission: 'cms.media.read' },
      { to: '/cms/navigation', label: 'Navigation', icon: Navigation, permission: 'cms.navigation.read' },
      { to: '/cms/pages', label: 'Pages', icon: Layout, permission: 'cms.page.read' },
      { to: '/cms/redirects', label: 'Redirects', icon: ArrowRightLeft, permission: 'cms.redirect.read' },
      { to: '/cms/shop-pages', label: 'Shop Pages', icon: ShoppingCart, permission: 'cms.shop_page.read' },
      { to: '/cms/email-templates', label: 'Email Templates', icon: Mail, permission: 'cms.email_template.read' },
      { to: '/cms/sms-templates', label: 'SMS Templates', icon: MessageSquare, permission: 'cms.sms_template.read' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    links: [
      { to: '/commerce-settings', label: 'Commerce Settings', icon: Settings, permission: 'setting.read' },
      { to: '/settings', label: 'General Settings', icon: Settings, permission: 'setting.read' },
      { to: '/feature-flags', label: 'Feature Flags', icon: Flag, permission: 'feature_flag.read' },
      { to: '/site-availability', label: 'Site Availability', icon: Wifi, permission: 'setting.read' },
      { to: '/address-autocomplete', label: 'Address Autocomplete', icon: MapPin, permission: 'setting.read' },
      { to: '/cms/pet-references', label: 'Pet References', icon: PawPrint, permission: 'cms.pet_reference.read' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    links: [
      { to: '/rbac/roles', label: 'Roles & Permissions', icon: Shield, permission: 'role.read' },
      { to: '/rbac/permissions', label: 'Permissions', icon: Key, permission: 'permission.read' },
      { to: '/rbac/permission-groups', label: 'Permission Groups', icon: FolderTree, permission: 'permission_group.read' },
      { to: '/rbac/scopes', label: 'Access Scopes', icon: Target, permission: 'permission_scope.read' },
      { to: '/audit-trail', label: 'Audit Trail', icon: Database, permission: 'audit.read' },
      { to: '/audit-settings', label: 'Audit Settings', icon: Settings, permission: 'audit.read' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Terminal,
    links: [
      { to: '/webhooks', label: 'Webhooks', icon: Zap, permission: 'setting.read' },
      { to: '/system-logs', label: 'System Logs', icon: Terminal, permission: 'systemlogs.read' },
      { to: '/system-log-settings', label: 'Log Settings', icon: Settings, permission: 'systemlogs.admin' },
      { to: '/statistics', label: 'Statistics', icon: BarChart3, permission: 'stats.read' },
      { to: '/write-nfc', label: 'Write NFC Tag', icon: Wifi, permission: 'tag.update' },
    ],
  },
];

export default function Sidebar() {
  const { hasPermission } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isCollapsed, toggleSection, expandSection } = useSidebarCollapse();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      api.get('/admin/notifications/unread-count')
        .then((res) => setUnreadCount(res.data.data?.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-expand section containing active route
  useEffect(() => {
    for (const section of sections) {
      const isActive = section.links.some(
        (link) => link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to),
      );
      if (isActive && isCollapsed(section.id)) {
        expandSection(section.id);
      }
    }
  }, [location.pathname, isCollapsed, expandSection]);

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        links: section.links.filter(
          (link) => !link.permission || hasPermission(link.permission),
        ),
      }))
      .filter((section) => section.links.length > 0);
  }, [hasPermission]);

  const isLinkActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  const isSectionActive = (section: SidebarLink[]) => {
    return section.some((link) => isLinkActive(link.to));
  };

  // Theme classes
  const sidebarBg = isDark ? 'bg-gray-900' : 'bg-white';
  const headerBg = isDark ? 'bg-gray-900' : 'bg-white';
  const headerBorder = isDark ? 'border-gray-700' : 'border-gray-200';
  const sectionBg = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
  const sectionActiveBg = isDark ? 'bg-gray-800/50' : 'bg-gray-50';
  const linkBg = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
  const linkActiveBg = isDark ? 'bg-primary-600' : 'bg-primary-50';
  const linkActiveText = isDark ? 'text-white' : 'text-primary-700';
  const linkText = isDark ? 'text-gray-300' : 'text-gray-600';
  const linkHoverText = isDark ? 'hover:text-white' : 'hover:text-gray-900';
  const chevronColor = isDark ? 'text-gray-500' : 'text-gray-400';
  const sectionLabel = isDark ? 'text-gray-500' : 'text-gray-400';
  const footerBorder = isDark ? 'border-gray-700' : 'border-gray-200';
  const footerText = isDark ? 'text-gray-500' : 'text-gray-400';

  return (
    <aside className={`w-64 ${sidebarBg} flex flex-col transition-colors duration-200`}>
      {/* Header */}
      <div className={`px-6 py-5 border-b ${headerBorder} flex items-center justify-between transition-colors duration-200`}>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-primary-400">Paw</span>
            <span className={isDark ? 'text-white' : 'text-gray-900'}>Tag</span>
          </h1>
          <p className={`text-xs ${sectionLabel} mt-0.5`}>Admin Portal</p>
        </div>
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg ${sectionBg} ${linkText} transition-colors duration-150`}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {filteredSections.map((section) => {
          const collapsed = isCollapsed(section.id);
          const active = isSectionActive(section.links);

          return (
            <div key={section.id} className="mb-1">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-150 ${
                  active ? sectionActiveBg : ''
                } ${sectionLabel} hover:${isDark ? 'text-gray-300' : 'text-gray-600'}`}
              >
                {collapsed ? (
                  <ChevronRight size={14} className={chevronColor} />
                ) : (
                  <ChevronDown size={14} className={chevronColor} />
                )}
                <section.icon size={14} className={chevronColor} />
                {section.label}
              </button>

              {/* Section Links */}
              {!collapsed && (
                <div>
                  {section.links.map((link) => (
                    link.external ? (
                      <a
                        key={link.to}
                        href={link.href || link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 pl-10 pr-6 py-2 text-sm transition-colors duration-150 ${linkText} ${linkBg} ${linkHoverText}`}
                      >
                        <link.icon size={16} className={chevronColor} />
                        <span className="flex-1">{link.label}</span>
                        <ExternalLink size={12} className="opacity-50" />
                      </a>
                    ) : (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === '/'}
                      className={`flex items-center gap-3 pl-10 pr-6 py-2 text-sm transition-colors duration-150 ${
                        isLinkActive(link.to)
                          ? `${linkActiveBg} ${linkActiveText}`
                          : `${linkText} ${linkBg} ${linkHoverText}`
                      }`}
                    >
                      <link.icon size={16} className={isLinkActive(link.to) ? (isDark ? 'text-white' : 'text-primary-600') : chevronColor} />
                      <span className="flex-1">{link.label}</span>
                      {link.to === '/notifications' && unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </NavLink>
                    )
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`px-6 py-4 border-t ${footerBorder} text-xs ${footerText} transition-colors duration-200`}>
        PawTag v0.1.0
      </div>
    </aside>
  );
}
