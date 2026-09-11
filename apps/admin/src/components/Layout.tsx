import { ReactNode, useState } from 'react';
import Sidebar, { MobileSidebar } from './Sidebar';
import TopBar from './TopBar';
import Breadcrumb from './Breadcrumb';
import ToastHost from './ToastHost';

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <Breadcrumb />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
