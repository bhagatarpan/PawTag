import { NavLink } from 'react-router-dom';
import { ACCOUNT_TABS } from './navigation';

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
 * Sizing contract: the tab row is exactly `3.5rem` tall and `safe-area-pb`
 * adds only the home-indicator inset below it, so the shell's
 * `--app-bottom-nav-height` (see index.css) stays in sync and account sticky
 * action bars rest above this bar instead of underneath it.
 */
export default function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 [--safe-area-pb-base:0px] safe-area-pb"
    >
      <ul className="grid grid-cols-5">
        {ACCOUNT_TABS.map(({ path, icon: Icon, tab }) => (
          <li key={tab.id}>
            <NavLink
              /* `end` keeps the dashboard tab from highlighting on every
                 account route (it is the prefix of them all). */
              to={path}
              end={path === '/account'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 pt-2 text-[11px] leading-tight border-t-2 transition-colors ${
                  isActive
                    ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                    : 'border-transparent text-gray-500 font-medium hover:text-gray-700'
                }`
              }
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
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
