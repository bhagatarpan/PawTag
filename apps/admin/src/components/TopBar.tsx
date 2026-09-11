import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, User, Settings, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';
import { API } from '@pawtag/shared/api';

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout, permissions } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('topbar-search')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const query = (e.target as HTMLInputElement).value.trim();
      if (query) {
        navigate(`/users?search=${encodeURIComponent(query)}`);
      }
    }
  };

  const roleLabel = permissions.length > 0
    ? `${permissions.length} permissions`
    : user?.rbacRoles?.[0]?.displayName || user?.role?.replace('_', ' ');

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const menuItems = [
    { icon: User, label: 'Profile', onClick: () => { navigate('/settings'); setDropdownOpen(false); } },
    { icon: Settings, label: 'Preferences', onClick: () => { navigate('/settings'); setDropdownOpen(false); } },
    { icon: Shield, label: 'Security', onClick: () => { navigate('/settings'); setDropdownOpen(false); } },
  ];

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between flex-shrink-0">
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Open navigation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            id="topbar-search"
            type="text"
            placeholder="Search anything..."
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-9 pr-16 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white transition-colors placeholder:text-gray-400"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Notifications + User dropdown */}
      <div className="flex items-center gap-2 ml-4">
        {/* Notification bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="User menu"
            aria-expanded={dropdownOpen}
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                {user?.fullName}
              </span>
              <span className="text-[11px] text-gray-500 truncate max-w-[120px]">
                {roleLabel}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`hidden sm:block text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <item.icon size={16} className="text-gray-400" />
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
