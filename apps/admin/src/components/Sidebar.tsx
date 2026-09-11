import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
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
  Menu,
  X,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../hooks/useTheme';
import { useSidebarCollapse } from '../hooks/useSidebarCollapse';
import { API } from '@pawtag/shared/api';
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
  color: string;
  links: SidebarLink[];
}

const sections: SidebarSection[] = [
  // ─── Overview ─────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    color: 'text-primary-300',
    links: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
      { to: '/reports', label: 'Commerce Reports', icon: BarChart3, permission: 'stats.read' },
    ],
  },
  // ─── Catalog ──────────────────────────────────────────────
  {
    id: 'catalog',
    label: 'Catalog',
    icon: ShoppingBag,
    color: 'text-purple-300',
    links: [
      { to: '/products', label: 'Products', icon: ShoppingBag, permission: 'product.read' },
      { to: '/categories', label: 'Categories', icon: FolderTree, permission: 'product.read' },
      { to: '/collections', label: 'Collections', icon: Database, permission: 'product.read' },
      { to: '/brands', label: 'Brands', icon: Target, permission: 'product.read' },
      { to: '/tags', label: 'Tags', icon: QrCode, permission: 'tag.read' },
    ],
  },
  // ─── Inventory ────────────────────────────────────────────
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    color: 'text-purple-300',
    links: [
      { to: '/inventory', label: 'Stock', icon: Package, permission: 'inventory.read' },
      { to: '/inventory/adjustments', label: 'Adjustments', icon: AlertTriangle, permission: 'inventory.adjust' },
      { to: '/inventory/history', label: 'Stock History', icon: Database, permission: 'inventory.read' },
    ],
  },
  // ─── Orders & Fulfilment ──────────────────────────────────
  {
    id: 'orders',
    label: 'Orders & Fulfilment',
    icon: FileText,
    color: 'text-orange-300',
    links: [
      { to: '/orders', label: 'All Orders', icon: FileText, permission: 'order.read' },
      { to: '/orders/pending', label: 'Pending', icon: Clock, permission: 'order.read' },
      { to: '/orders/processing', label: 'Processing', icon: Activity, permission: 'order.read' },
      { to: '/invoices', label: 'Invoices', icon: FileText, permission: 'order.read' },
      { to: '/shipping/shipments', label: 'Shipments', icon: Truck, permission: 'order.read' },
      { to: '/returns', label: 'Returns', icon: RotateCcw, permission: 'order.read' },
    ],
  },
  // ─── Payments & Refunds ───────────────────────────────────
  {
    id: 'payments',
    label: 'Payments & Refunds',
    icon: CreditCard,
    color: 'text-green-300',
    links: [
      { to: '/payments', label: 'Transactions', icon: CreditCard, permission: 'order.read' },
      { to: '/refunds', label: 'Refunds', icon: RotateCcw, permission: 'order.refund' },
      { to: '/refund-report', label: 'Refund Report', icon: FileText, permission: 'order.refund' },
      { to: '/payments/reconciliation', label: 'Reconciliation', icon: AlertTriangle, permission: 'order.read' },
      { to: '/shipping/methods', label: 'Shipping Methods', icon: Truck, permission: 'setting.read' },
      { to: '/stripe-report', label: 'Stripe Report', icon: CreditCard, permission: 'setting.read' },
    ],
  },
  // ─── Tag Subscriptions ─────────────────────────────────────
  {
    id: 'tag-subscriptions',
    label: 'Tag Subscriptions',
    icon: QrCode,
    color: 'text-primary-300',
    links: [
      { to: '/subscription-plans', label: 'Subscription Plans', icon: CreditCard, permission: 'product.read' },
      { to: '/customer-subscriptions', label: 'Customer Subscriptions', icon: Users, permission: 'subscription.read' },
    ],
  },
  // ─── Guardian Loyalty ──────────────────────────────────────
  {
    id: 'guardian-loyalty',
    label: 'Guardian Loyalty',
    icon: Shield,
    color: 'text-yellow-300',
    links: [
      { to: '/guardian', label: 'Guardian Dashboard', icon: Shield, permission: 'subscription.read' },
      { to: '/guardian/members', label: 'Members', icon: Users, permission: 'subscription.read' },
      { to: '/guardian/analytics', label: 'Analytics', icon: BarChart3, permission: 'subscription.read' },
      { to: '/guardian/settings', label: 'Guardian Settings', icon: Settings, permission: 'subscription.read' },
    ],
  },
  // ─── Discounts & Promotions ───────────────────────────────
  {
    id: 'discounts',
    label: 'Discounts & Promotions',
    icon: Tag,
    color: 'text-pink-300',
    links: [
      { to: '/discounts', label: 'Discount Codes', icon: Tag, permission: 'product.read' },
      { to: '/referrals', label: 'Referral Program', icon: Gift, permission: 'product.read' },
    ],
  },
  // ─── Users & Pets ─────────────────────────────────────────
  {
    id: 'users',
    label: 'Users & Pets',
    icon: Users,
    color: 'text-blue-300',
    links: [
      { to: '/users/customers', label: 'Customers', icon: Users, permission: 'user.read' },
      { to: '/users/admin', label: 'Admin Users', icon: Users, permission: 'user.read' },
      { to: '/pets', label: 'Pets', icon: PawPrint, permission: 'pet.read' },
    ],
  },
  // ─── Communication ────────────────────────────────────────
  {
    id: 'communication',
    label: 'Communication',
    icon: MessageSquare,
    color: 'text-blue-300',
    links: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/support-requests', label: 'Support Requests', icon: MessageSquare },
      { to: '/tag-expiry-notifications', label: 'Tag Expiry Alerts', icon: AlertTriangle },
    ],
  },
  // ─── Content (CMS) ────────────────────────────────────────
  {
    id: 'content',
    label: 'Content (CMS)',
    icon: Layout,
    color: 'text-primary-300',
    links: [
      { to: '/cms/pages', label: 'Pages', icon: Layout, permission: 'cms.page.read' },
      { to: '/cms/homepage', label: 'Homepage', icon: Monitor, permission: 'cms.homepage.read' },
      { to: '/cms/shop-pages', label: 'Shop Pages', icon: ShoppingCart, permission: 'cms.shop_page.read' },
      { to: '/cms/auth-pages', label: 'Auth Pages', icon: LogIn, permission: 'cms.auth_page.read' },
      { to: '/cms/navigation', label: 'Navigation', icon: Navigation, permission: 'cms.navigation.read' },
      { to: '/cms/footer', label: 'Footer', icon: PanelBottom, permission: 'cms.footer.read' },
      { to: '/cms/announcements', label: 'Announcements', icon: Megaphone, permission: 'cms.announcement.read' },
      { to: '/cms/onboarding', label: 'Onboarding', icon: ClipboardCheck, permission: 'cms.onboarding.read' },
      { to: '/cms/email-templates', label: 'Email Templates', icon: Mail, permission: 'cms.email_template.read' },
      { to: '/cms/sms-templates', label: 'SMS Templates', icon: MessageSquare, permission: 'cms.sms_template.read' },
      { to: '/cms/invoice-template', label: 'Invoice Template', icon: FileSignature, permission: 'cms.email_template.read' },
      { to: '/cms/media', label: 'Media Library', icon: Image, permission: 'cms.media.read' },
      { to: '/cms/redirects', label: 'Redirects', icon: ArrowRightLeft, permission: 'cms.redirect.read' },
      { to: '/cms/pet-references', label: 'Pet References', icon: PawPrint, permission: 'cms.pet_reference.read' },
    ],
  },
  // ─── Settings ─────────────────────────────────────────────
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    color: 'text-gray-300',
    links: [
      { to: '/commerce-settings', label: 'Commerce Settings', icon: Settings, permission: 'setting.read' },
      { to: '/settings', label: 'General Settings', icon: Settings, permission: 'setting.read' },
      { to: '/site-availability', label: 'Site Availability', icon: Wifi, permission: 'setting.read' },
      { to: '/address-autocomplete', label: 'Address Autocomplete', icon: MapPin, permission: 'setting.read' },
    ],
  },
  // ─── Security & Access ────────────────────────────────────
  {
    id: 'security',
    label: 'Security & Access',
    icon: Shield,
    color: 'text-red-300',
    links: [
      { to: '/rbac/roles', label: 'Roles & Permissions', icon: Shield, permission: 'role.read' },
      { to: '/rbac/permissions', label: 'Permissions', icon: Key, permission: 'permission.read' },
      { to: '/rbac/permission-groups', label: 'Permission Groups', icon: FolderTree, permission: 'permission_group.read' },
      { to: '/rbac/scopes', label: 'Access Scopes', icon: Target, permission: 'permission_scope.read' },
      { to: '/audit-trail', label: 'Audit Trail', icon: Database, permission: 'audit.read' },
      { to: '/audit-settings', label: 'Audit Settings', icon: Settings, permission: 'audit.read' },
    ],
  },
  // ─── Operations ───────────────────────────────────────────
  {
    id: 'operations',
    label: 'Operations',
    icon: Terminal,
    color: 'text-gray-300',
    links: [
      { to: '/feature-flags', label: 'Feature Flags', icon: Flag, permission: 'feature_flag.read' },
      { to: '/webhooks', label: 'Webhooks', icon: Zap, permission: 'setting.read' },
      { to: '/system-logs', label: 'System Logs', icon: Terminal, permission: 'systemlogs.read' },
      { to: '/system-log-settings', label: 'Log Settings', icon: Settings, permission: 'systemlogs.admin' },
      { to: '/statistics', label: 'Statistics', icon: BarChart3, permission: 'stats.read' },
      { to: '/write-nfc', label: 'Write NFC Tag', icon: Wifi, permission: 'tag.update' },
    ],
  },
];

function Tooltip({ children, content, visible }: { children: React.ReactNode; content: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
      <div className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
        {content}
      </div>
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
    </div>
  );
}

interface SidebarContentProps {
  mobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobile, onClose }: SidebarContentProps & { mobile?: boolean; onClose?: () => void }) {
  const { hasPermission, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const {
    sidebarCollapsed,
    toggleSidebar,
    isSectionCollapsed,
    toggleSection,
    expandSection,
    expandAllSections,
    collapseAllSections,
  } = useSidebarCollapse();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const collapsed = !mobile && sidebarCollapsed;

  useEffect(() => {
    const fetchCount = () => {
      api.get(API.admin.notifications.unreadCount)
        .then((res) => setUnreadCount(res.data.data?.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    for (const section of sections) {
      const isActive = section.links.some(
        (link) => link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to),
      );
      if (isActive && isSectionCollapsed(section.id)) {
        expandSection(section.id);
      }
    }
  }, [location.pathname, isSectionCollapsed, expandSection]);

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

  const handleMouseEnter = (itemId: string) => {
    if (!collapsed) return;
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHoveredItem(itemId), 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHoveredItem(null), 100);
  };

  const handleNavClick = () => {
    if (mobile && onClose) onClose();
  };

  return (
    <aside
      className={`
        ${mobile ? 'w-72' : collapsed ? 'w-[72px]' : 'w-[272px]'}
        h-full flex flex-col
        bg-primary-900 text-white
        border-r border-white/[0.08]
        transition-[width] duration-200 ease-out
        overflow-hidden flex-shrink-0
      `}
    >
      {/* Header */}
      <div className={`h-[72px] flex items-center ${collapsed && !mobile ? 'justify-center px-2' : 'justify-between px-5'} flex-shrink-0`}>
        {collapsed && !mobile ? (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
            <PawPrint size={20} className="text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
              <PawPrint size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">
                <span className="text-white">Paw</span>
                <span className="text-primary-300">Tag</span>
              </h1>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-none">Admin Portal</p>
            </div>
          </div>
        )}

        {!mobile && (
          collapsed ? (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150"
              title="Expand sidebar"
            >
              <ChevronsRight size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                onClick={expandAllSections}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150"
                title="Expand all sections"
              >
                <ChevronsDown size={16} />
              </button>
              <button
                onClick={collapseAllSections}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150"
                title="Collapse all sections"
              >
                <ChevronsUp size={16} />
              </button>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150"
                title="Collapse sidebar"
              >
                <ChevronsLeft size={16} />
              </button>
            </div>
          )
        )}

        {mobile && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden sidebar-nav">
        {filteredSections.map((section) => {
          const sectionCollapsedState = isSectionCollapsed(section.id);
          const active = isSectionActive(section.links);

          return (
            <div key={section.id} className="px-2 mb-1">
              {/* Section Header */}
              {collapsed && !mobile ? (
                <div
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(section.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`
                      w-full flex items-center justify-center p-2 rounded-lg transition-colors duration-150
                      ${active ? 'bg-white/10' : 'hover:bg-white/5'}
                    `}
                  >
                    <section.icon size={20} className={`${section.color} flex-shrink-0`} />
                  </button>
                  <Tooltip content={section.label} visible={hoveredItem === section.id}>
                    <div
                      className="absolute left-full top-0 z-50"
                      onMouseEnter={() => {
                        clearTimeout(hoverTimeoutRef.current);
                        setHoveredItem(section.id);
                      }}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className="ml-2 bg-gray-900 rounded-xl shadow-xl border border-white/10 min-w-[200px]">
                        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {section.label}
                        </div>
                        <div className="bg-white/[0.05] rounded-lg mx-1 mb-1 py-0.5">
                          {section.links.map((link) => (
                          <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === '/'}
                            onClick={handleNavClick}
                            className={({ isActive: linkActive }) =>
                              `flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-150 mx-1 rounded-lg ${
                                linkActive || isLinkActive(link.to)
                                  ? 'bg-primary-600 text-white font-medium'
                                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
                              }`
                            }
                          >
                            <link.icon size={16} className="flex-shrink-0" />
                            <span className="flex-1 truncate">{link.label}</span>
                            {link.to === '/notifications' && unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </NavLink>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider
                      transition-colors duration-150
                      ${active ? 'text-gray-200' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}
                    `}
                  >
                    {sectionCollapsedState ? (
                      <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-300 flex-shrink-0" />
                    )}
                    <section.icon size={14} className={`${section.color} flex-shrink-0`} />
                    <span className="truncate">{section.label}</span>
                  </button>

                  {/* Section Links */}
                  {!sectionCollapsedState && (
                    <div className="mt-0.5 space-y-0.5 bg-white/[0.04] rounded-lg mx-1 py-1">
                      {section.links.map((link) => (
                        link.external ? (
                          <a
                            key={link.to}
                            href={link.href || link.to}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 pl-10 pr-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors duration-150"
                          >
                            <link.icon size={16} className="text-gray-400 flex-shrink-0" />
                            <span className="flex-1 truncate">{link.label}</span>
                            <ExternalLink size={12} className="text-gray-500 opacity-0 group-hover:opacity-100" />
                          </a>
                        ) : (
                          <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === '/'}
                            onClick={handleNavClick}
                            className={({ isActive: linkActive }) =>
                              `group flex items-center gap-3 pl-10 pr-3 py-2 text-sm rounded-lg transition-colors duration-150 ${
                                linkActive || isLinkActive(link.to)
                                  ? 'bg-primary-600/80 text-white font-medium'
                                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
                              }`
                            }
                          >
                            <link.icon
                              size={16}
                              className={`
                                flex-shrink-0
                                ${isLinkActive(link.to) ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}
                              `}
                            />
                            <span className="flex-1 truncate">{link.label}</span>
                            {link.to === '/notifications' && unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </NavLink>
                        )
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Guardian Rewards Shortcut */}
      {collapsed && !mobile ? (
        <div
          className="px-2 pb-2"
          onMouseEnter={() => handleMouseEnter('guardian-card')}
          onMouseLeave={handleMouseLeave}
        >
          <div className="relative">
            <NavLink
              to="/guardian"
              onClick={handleNavClick}
              className="flex items-center justify-center p-2 rounded-lg hover:bg-white/5 transition-colors duration-150"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 flex items-center justify-center">
                <Shield size={18} className="text-yellow-400" />
              </div>
            </NavLink>
            <Tooltip content="Guardian Rewards" visible={hoveredItem === 'guardian-card'}>
              <div
                className="absolute left-full top-0 z-50"
                onMouseEnter={() => {
                  clearTimeout(hoverTimeoutRef.current);
                  setHoveredItem('guardian-card');
                }}
                onMouseLeave={handleMouseLeave}
              >
                <div className="ml-2 bg-gray-900 rounded-xl shadow-xl border border-white/10 p-3 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={14} className="text-yellow-400" />
                    <span className="text-sm font-semibold text-white">Guardian Rewards</span>
                  </div>
                  <p className="text-xs text-gray-400">Manage points, tiers & rewards</p>
                </div>
              </div>
            </Tooltip>
          </div>
        </div>
      ) : !mobile && (
        <div className="px-3 pb-3">
          <NavLink
            to="/guardian"
            onClick={handleNavClick}
            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 hover:border-yellow-500/40 hover:from-yellow-500/15 hover:to-yellow-600/15 transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">Guardian Rewards</p>
              <p className="text-[11px] text-gray-400 truncate">Manage points, tiers & rewards</p>
            </div>
            <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 transition-colors" />
          </NavLink>
        </div>
      )}

      {/* Footer */}
      <div className={`flex-shrink-0 border-t border-white/[0.08] ${collapsed && !mobile ? 'p-2' : 'p-3'}`}>
        {/* Theme toggle + collapse button */}
        {!mobile && (
          <div className={`flex items-center ${collapsed ? 'flex-col gap-1' : 'gap-2'}`}>
            {collapsed ? (
              <>
                <button
                  onClick={toggleTheme}
                  className="w-full p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150 flex items-center justify-center"
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={toggleSidebar}
                  className="w-full p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150 flex items-center justify-center"
                  title="Expand sidebar"
                >
                  <ChevronsRight size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleTheme}
                  className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150 text-sm"
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors duration-150"
                  title="Collapse sidebar"
                >
                  <ChevronsLeft size={16} />
                </button>
              </>
            )}
          </div>
        )}

        {/* User info (expanded only) */}
        {!collapsed && !mobile && user && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-white">
                  {user.fullName?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {user.rbacRoles?.[0]?.displayName || user?.role?.replace('_', ' ') || 'Administrator'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar mobile onClose={onClose} />
      </div>
    </>
  );
}
