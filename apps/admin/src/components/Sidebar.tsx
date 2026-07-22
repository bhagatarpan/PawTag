import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  PawPrint,
  QrCode,
  ShoppingBag,
  FileText,
  Newspaper,
  Settings,
  Flag,
  ScrollText,
  BarChart3,
  Shield,
  Key,
  FolderTree,
  Target,
  Layout,
  Navigation,
  PanelBottom,
  Image,
  Megaphone,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

interface SidebarLink {
  to: string;
  label: string;
  icon: any;
  permission?: string;
}

const mainLinks: SidebarLink[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
  { to: '/users', label: 'Users', icon: Users, permission: 'user.read' },
  { to: '/pets', label: 'Pets', icon: PawPrint, permission: 'pet.read' },
  { to: '/tags', label: 'Tags', icon: QrCode, permission: 'tag.read' },
  { to: '/products', label: 'Products', icon: ShoppingBag, permission: 'product.read' },
  { to: '/orders', label: 'Orders', icon: FileText, permission: 'order.read' },
  { to: '/statistics', label: 'Statistics', icon: BarChart3, permission: 'stats.read' },
  { to: '/content', label: 'Content', icon: Newspaper, permission: 'content.read' },
];

const adminLinks: SidebarLink[] = [
  { to: '/rbac/roles', label: 'Roles', icon: Shield, permission: 'role.read' },
  { to: '/rbac/permissions', label: 'Permissions', icon: Key, permission: 'permission.read' },
  { to: '/rbac/permission-groups', label: 'Permission Groups', icon: FolderTree, permission: 'permission_group.read' },
  { to: '/rbac/scopes', label: 'Access Scopes', icon: Target, permission: 'permission.read' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'setting.read' },
  { to: '/feature-flags', label: 'Feature Flags', icon: Flag, permission: 'feature_flag.read' },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, permission: 'audit_log.read' },
];

const cmsLinks: SidebarLink[] = [
  { to: '/cms/pages', label: 'Pages', icon: Layout, permission: 'cms.page.read' },
  { to: '/cms/navigation', label: 'Navigation', icon: Navigation, permission: 'cms.navigation.read' },
  { to: '/cms/footer', label: 'Footer', icon: PanelBottom, permission: 'cms.footer.read' },
  { to: '/cms/media', label: 'Media Library', icon: Image, permission: 'cms.media.read' },
  { to: '/cms/announcements', label: 'Announcements', icon: Megaphone, permission: 'cms.announcement.read' },
  { to: '/cms/redirects', label: 'Redirects', icon: ArrowRightLeft, permission: 'cms.redirect.read' },
];

export default function Sidebar() {
  const { hasPermission } = useAuth();

  const filteredMainLinks = mainLinks.filter(
    (link) => !link.permission || hasPermission(link.permission),
  );

  const filteredAdminLinks = adminLinks.filter(
    (link) => !link.permission || hasPermission(link.permission),
  );

  const filteredCmsLinks = cmsLinks.filter(
    (link) => !link.permission || hasPermission(link.permission),
  );

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-primary-400">Paw</span>Tag
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {filteredMainLinks.length > 0 && (
          <>
            <div className="px-6 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Main</div>
            {filteredMainLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </>
        )}
        {filteredAdminLinks.length > 0 && (
          <>
            <div className="px-6 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Administration</div>
            {filteredAdminLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </>
        )}
        {filteredCmsLinks.length > 0 && (
          <>
            <div className="px-6 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">CMS</div>
            {filteredCmsLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div className="px-6 py-4 border-t border-gray-700 text-xs text-gray-500">
        PawTag v0.1.0
      </div>
    </aside>
  );
}
