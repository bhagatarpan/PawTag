import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ACCOUNT_TABS, accountNavItemForPath } from './navigation';

interface BottomNavProps {
  /** Unread notification count shown on the Activity tab (0 hides the badge). */
  unreadCount?: number;
}

/**
 * Phone-width primary navigation for the customer account shell
 * (Home | Pets | Activate | Activity | Account — Phase 08 model). Renders for
 * narrow browser sessions and the future Capacitor shell alike; desktop keeps
 * the sidebar. Secondary destinations stay in the slide-over drawer.
 *
 * The Activate tab uses the elevated center treatment from the concept
 * boards: a teal circle raised above the bar, darkening when active. Active
 * state resolves through `accountNavItemForPath` (same override-aware source
 * as the sidebar), exposed as `aria-current="page"` on plain links. Labels
 * sit on one baseline across all five tabs (`justify-end pb-2`).
 *
 * Sizing contract: the tab row is exactly `4.5rem` (72px) tall and
 * `safe-area-pb` adds only the home-indicator inset below it, so the shell's
 * `--app-bottom-nav-height` (see index.css) stays in sync and account sticky
 * action bars rest above this bar instead of underneath it.
 */
export default function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const location = useLocation();
  // Sub-pages (notification preferences, upgrade, activation fee) resolve to
  // their owning tab here, so the bar never sits unlit on a related route.
  const activePath = accountNavItemForPath(location.pathname)?.path;
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 [--safe-area-pb-base:0px] safe-area-pb"
    >
      <ul className="grid grid-cols-5">
        {ACCOUNT_TABS.map(({ path, icon: Icon, tab }) => {
          const isActive = activePath === path;
          if (tab.id === 'activate') {
            return (
              <li key={tab.id}>
                <Link
                  to={path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-[4.5rem] flex-col items-center justify-end gap-0 pb-2 px-1 text-[11px] leading-tight transition-colors ${
                    isActive ? 'text-primary-700 font-semibold' : 'text-gray-500 font-medium hover:text-gray-700'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`-translate-y-3 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-primary-600/30 transition-colors ${
                      isActive ? 'bg-primary-700 ring-2 ring-primary-900/30' : 'bg-primary-600'
                    }`}
                  >
                    <Plus size={26} strokeWidth={2.5} />
                  </span>
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.id}>
              <Link
                /* accountNavItemForPath resolves nested routes to their
                   owning item and never maps them to the dashboard (which is
                   exact-match), so no `end` handling is needed here. */
                to={path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-full min-h-16 flex-col items-center justify-end gap-1 pb-2 px-1 text-[11px] leading-tight border-t-2 transition-colors ${
                  isActive
                    ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                    : 'border-transparent text-gray-500 font-medium hover:text-gray-700'
                }`}
              >
                <span className="relative">
                  <Icon size={20} aria-hidden="true" />
                  {tab.id === 'activity' && unreadCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
                <span>{tab.label}</span>
                {tab.id === 'activity' && unreadCount > 0 && (
                  <span className="sr-only">{unreadCount} unread notifications</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
