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
} from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/pets', label: 'Pets', icon: PawPrint },
  { to: '/tags', label: 'Tags', icon: QrCode },
  { to: '/products', label: 'Products', icon: ShoppingBag },
  { to: '/orders', label: 'Orders', icon: FileText },
  { to: '/content', label: 'Content', icon: Newspaper },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/feature-flags', label: 'Feature Flags', icon: Flag },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-primary-400">Paw</span>Tag
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {links.map((link) => (
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
      </nav>
      <div className="px-6 py-4 border-t border-gray-700 text-xs text-gray-500">
        PawTag v0.1.0
      </div>
    </aside>
  );
}
