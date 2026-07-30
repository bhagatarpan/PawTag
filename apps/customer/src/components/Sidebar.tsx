import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PawPrint, LogOut, User, ShoppingBag, Bell, Settings } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useSiteSettings } from '../hooks/useSiteSettings';
import api from '../lib/api';

const NAV_ITEMS = [
  { path: '/', label: 'My Pets', icon: PawPrint },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get('/customer/notifications/unread-count').then((r) => setUnreadCount(r.data.data.count)).catch(() => {});
    const interval = setInterval(() => {
      api.get('/customer/notifications/unread-count').then((r) => setUnreadCount(r.data.data.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-64 bg-white border-r min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2"><PawPrint size={24} className="text-primary-600" /><span className="font-bold text-lg">My {companyName}</span></div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          const isNotif = path === '/notifications';
          return (
            <Link key={path} to={path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
              <div className="relative">
                <Icon size={18} />
                {isNotif && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </div>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">{user?.fullName?.charAt(0) || '?'}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-600 p-1"><LogOut size={16} /></button>
        </div>
      </div>
    </div>
  );
}
