// @vitest-environment happy-dom
/**
 * Auth journey mobile pass (2026-10-26, spec §6.2 of
 * docs/ux/PawTag_Mobile_Review_Package/PawTag_Mobile_UX_Audit_and_Implementation_Spec.md):
 *
 * 1. Token discipline — no raw `teal-*` classes remain in the six auth
 *    screens (they use DESIGN.md `primary-*` tokens + the Button primitive).
 * 2. Shared shell — AuthLayout renders the CMS company name + tagline; pages
 *    no longer hand-roll their own logo/header blocks.
 * 3. Mobile form behavior — autoComplete/inputMode hints per field, and the
 *    verify screen shows two distinct progress items (Email / Mobile).
 * 4. No emoji as a primary icon (the old VerifyAccount 🐾 tile is gone).
 *
 * Auth behavior itself (CAPTCHA, MFA flow, cooldowns, return-URL) is NOT
 * asserted here — it is unchanged presentation-only work.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
vi.mock('../../apps/web/src/lib/api', () => ({ default: apiMock }));
vi.mock('../../apps/web/src/hooks/useCms', () => ({
  useAuthPage: () => ({ page: null }),
  useSiteSettings: () => ({
    settings: { 'company.name': 'PawTag', 'site.tagline': 'Never Lose Your Pet Again' },
  }),
}));
vi.mock('../../apps/web/src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    login: vi.fn(),
    completeLogin: vi.fn(),
    refreshUser: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
  }),
}));

import Login from '../../apps/web/src/pages/Login';
import Register from '../../apps/web/src/pages/Register';
import VerifyAccount from '../../apps/web/src/pages/VerifyAccount';
import VerifyEmail from '../../apps/web/src/pages/VerifyEmail';
import ForgotPassword from '../../apps/web/src/pages/ForgotPassword';
import ResetPassword from '../../apps/web/src/pages/ResetPassword';

const AUTH_PAGES = ['Login', 'Register', 'VerifyAccount', 'VerifyEmail', 'ForgotPassword', 'ResetPassword'];
const readPage = (name: string) =>
  readFileSync(path.resolve(__dirname, `../../apps/web/src/pages/${name}.tsx`), 'utf8');

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.get.mockResolvedValue({ data: { data: null } });
  localStorage.clear();
});

describe('token discipline (source guard)', () => {
  it.each(AUTH_PAGES)('%s.tsx uses design tokens, no raw teal-* classes', (name) => {
    expect(readPage(name)).not.toMatch(/teal-/);
  });

  it('no auth screen hand-rolls a logo block — AuthLayout owns the shell', () => {
    // Pages render the shell instead of gradient PawPrint tiles.
    for (const name of ['Login', 'Register', 'VerifyAccount', 'VerifyEmail', 'ForgotPassword', 'ResetPassword']) {
      const src = readPage(name);
      expect(src).toContain('AuthLayout');
      expect(src).not.toMatch(/bg-gradient-to-br from-/);
    }
  });
});

describe('AuthLayout shell', () => {
  it('renders CMS company name, CMS tagline and the page heading', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'PawTag home' })).toBeDefined();
    expect(screen.getByText('Never Lose Your Pet Again')).toBeDefined(); // site.tagline
    expect(screen.getByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeDefined();
  });
});

describe('Login', () => {
  it('declares autofill hints and a labeled email field', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    const email = screen.getByLabelText('Email');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('inputmode')).toBe('email');
    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();
  });
});

describe('Register', () => {
  it('declares autofill hints on every identity field', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Full Name').getAttribute('autocomplete')).toBe('name');
    expect(screen.getByLabelText('Email').getAttribute('autocomplete')).toBe('email');
    const phone = screen.getByLabelText('Phone Number');
    expect(phone.getAttribute('autocomplete')).toBe('tel');
    expect(phone.getAttribute('inputmode')).toBe('tel');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('Confirm Password').getAttribute('autocomplete')).toBe('new-password');
  });

  it('shows the 2-step progress framing (Account → Verify)', () => {
    const { container } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    expect(container.querySelector('[aria-label^="Step 1 of 2"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Create Account/ })).toBeDefined();
  });
});

describe('VerifyAccount', () => {
  it('renders two distinct progress items with step framing', async () => {
    render(
      <MemoryRouter initialEntries={['/verify-account']}>
        <Routes>
          <Route path="/verify-account" element={<VerifyAccount />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Email Verification')).toBeDefined();
    expect(screen.getByText('Mobile Verification')).toBeDefined();
    expect(screen.getByText('Step 1 of 2')).toBeDefined();
    expect(screen.getByText('Step 2 of 2')).toBeDefined();
    // Existing verification state still surfaces per channel (both pending here).
    expect(screen.getAllByText('Not Verified')).toHaveLength(2);
  });

  it('uses the shell and no emoji as the primary brand icon', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/verify-account']}>
        <Routes>
          <Route path="/verify-account" element={<VerifyAccount />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Email Verification');
    expect(screen.getByRole('heading', { level: 1, name: 'Verify Your Account' })).toBeDefined();
    expect(container.textContent).not.toContain('🐾');
  });
});

describe('VerifyEmail', () => {
  it('success state renders through the shell with a token-styled CTA', async () => {
    apiMock.get.mockResolvedValue({
      data: { success: true, data: { message: 'Your email has been verified successfully!', email: 'a@b.c' } },
    });
    render(
      <MemoryRouter initialEntries={['/verify-email?token=abc']}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Email Verified!' })).toBeDefined();
    const cta = screen.getByRole('link', { name: 'Continue to Verification' });
    expect(cta.className).toContain('bg-primary-600');
    expect(cta.className).toContain('rounded-xl');
  });
});

describe('ForgotPassword', () => {
  it('email field carries autofill hints', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );
    const email = screen.getByLabelText('Email address');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('inputmode')).toBe('email');
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeDefined();
  });
});

describe('ResetPassword', () => {
  it('new-password fields carry autofill hints when a token is present', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('New Password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('Confirm Password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeDefined();
  });

  it('missing token still shows the invalid-link state through the shell', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Invalid Reset Link' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toBeDefined();
  });
});
