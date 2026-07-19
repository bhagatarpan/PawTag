import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../lib/auth';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, permissions } = useAuth();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.fullName}</span>
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
              {permissions.length > 0 ? `${permissions.length} permissions` : user?.rbacRoles?.[0]?.displayName || user?.role?.replace('_', ' ')}
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
