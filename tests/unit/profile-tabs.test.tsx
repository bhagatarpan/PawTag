// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Packet 1c (board 2, screen 1): Profile segmented tabs.
 * Tabs are real URLs (?tab=) — deep links must land on the right section,
 * and the Security tab must present EXISTING verification state only
 * (no MFA UI in scope by founder decision).
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../apps/web/src/lib/api', () => ({ default: api }));

// Stable identities: the real context keeps `user` referentially stable, and
// Profile's effects depend on it — recreating the object per call would loop.
const auth = vi.hoisted(() => ({
  refreshUser: vi.fn(),
  user: {
    id: 'u1',
    fullName: 'Taylor Morgan',
    email: 'taylor@example.com',
    phoneNumber: '+64 21 123 4567',
    emailVerified: true,
    phoneVerified: true,
    address: {},
    emergencyContact: {},
  },
}));

vi.mock('../../apps/web/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: auth.user,
    refreshUser: auth.refreshUser,
  }),
}));

vi.mock('../../apps/web/src/components/AvatarUpload', () => ({
  default: () => <div data-testid="avatar" />,
}));

import Profile from '../../apps/web/src/pages/account/Profile';

function renderProfile(initialPath = '/account/profile') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/account/profile" element={<Profile />} />
        <Route path="/verify-account" element={<div>verify-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url: string) => {
    if (url.includes('notification-preferences') || url.includes('notificationPreferences')) {
      return Promise.resolve({
        data: { data: { email: true, push: true, inApp: true, channels: { petFound: true, orderUpdate: true, subscriptionReminder: true, referral: true, marketing: false } } },
      });
    }
    if (url.includes('onboarding')) {
      return Promise.resolve({ data: { data: { globalSettings: { relationshipOptions: ['Friend'] } } } });
    }
    return Promise.resolve({ data: { data: null } });
  });
  api.put.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
});

describe('Profile segmented tabs', () => {
  it('shows identity, three tab links, and the profile form by default', async () => {
    renderProfile();
    expect(screen.getByRole('heading', { name: 'Taylor Morgan' })).toBeTruthy();
    expect(await screen.findByText('Personal Information')).toBeTruthy();

    const links = screen.getAllByRole('link').filter((a) => ['Profile', 'Security', 'Preferences'].includes(a.textContent || ''));
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/account/profile',
      '/account/profile?tab=security',
      '/account/profile?tab=preferences',
    ]);
    // default tab marked current, others not
    expect(links.find((l) => l.textContent === 'Profile')?.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByText('Account security')).toBeNull();
    expect(screen.queryByText('Change Password')).toBeNull();
  });

  it('deep-links ?tab=security to account security with existing verification state only', async () => {
    renderProfile('/account/profile?tab=security');
    expect(await screen.findByText('Account security')).toBeTruthy();
    // email appears in the identity row AND the security card (intended)
    expect(screen.getAllByText('taylor@example.com')).toHaveLength(2);
    expect(screen.getAllByText('Verified')).toHaveLength(2); // real verified state on both cards
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeTruthy(); // existing form moved here
    // personal form not rendered on this tab
    expect(screen.queryByText('Personal Information')).toBeNull();
    // MFA out of scope by founder decision — never rendered
    expect(screen.queryByText(/two-step|authenticator/i)).toBeNull();
  });

  it('deep-links ?tab=preferences to notification preferences without a duplicate page heading', async () => {
    renderProfile('/account/profile?tab=preferences');
    // component fetches its own data through the real endpoint key
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('notification-preferences')),
    );
    // hideHeader: no second page-level h1 from the embedded component
    expect(screen.queryByRole('heading', { name: 'Notification Preferences' })).toBeNull();
    expect(screen.queryByText('Personal Information')).toBeNull();
  });
});
