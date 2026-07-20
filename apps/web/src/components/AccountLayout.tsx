import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PawPrint, LogOut, User, ShoppingBag, Bell, Settings, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const NAV_ITEMS = [
  { path: '/account', label: 'My Pets', icon: PawPrint },
  { path: '/account/profile', label: 'Profile', icon: User },
  { path: '/account/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/account/notifications', label: 'Notifications', icon: Bell },
  { path: '/account/settings', label: 'Settings', icon: Settings },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get('/customer/notifications/unread-count').then((r) => setUnreadCount(r.data.data.count)).catch(() => {});
    const interval = setInterval(() => {
      api.get('/customer/notifications/unread-count').then((r) => setUnreadCount(r.data.data.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (path: string) => path === '/account' ? location.pathname === '/account' : location.pathname.startsWith(path);

  const currentLabel = NAV_ITEMS.find((n) => isActive(n.path))?.label || 'Account';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col sticky top-16">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PawPrint size={24} className="text-teal-600" />
            <span className="font-bold text-lg text-gray-900">My PawTag</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            const isNotif = path === '/account/notifications';
            return (
              <Link key={path} to={path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
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
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-sm">{user?.fullName?.charAt(0) || '?'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-900">{user?.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 p-1" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link to="/" className="hover:text-teal-600">Home</Link>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">{currentLabel}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
