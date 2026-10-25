import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { useSiteSettings } from '../hooks/useCms';

export interface AuthLayoutProps {
  /** Page heading — pass the CMS authPage title with the page's fallback (no hardcoded copy in this shell). */
  title: string;
  /** Optional supporting line — CMS subtitle or page fallback. */
  subtitle?: string;
  /** Card content (form, status states). */
  children: ReactNode;
  /**
   * Wrap children in the white card (default). Set false for pages built
   * from their own tinted cards on the gray background (VerifyAccount).
   */
  card?: boolean;
}

/**
 * Shared shell for the six authentication screens (Login, Register,
 * VerifyAccount, VerifyEmail, ForgotPassword, ResetPassword) — one source
 * for the brand header (logo tile + CMS company name + CMS `site.tagline`)
 * and the centered card, so the screens cannot drift apart again.
 * Spec: docs/UX/PawTag_Mobile_Review_Package (§6.2) · Pattern documented in
 * docs/DESIGN.md → "Auth screens". Presentation only — each page keeps its
 * own logic inside `children`.
 */
export default function AuthLayout({ title, subtitle, children, card = true }: AuthLayoutProps) {
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  const tagline = settings?.['site.tagline'];

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:items-center sm:py-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex flex-col items-center gap-2"
            aria-label={`${companyName} home`}
          >
            <span
              aria-hidden="true"
              className="h-12 w-12 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center"
            >
              <PawPrint className="h-7 w-7 text-white" />
            </span>
            <span className="text-lg font-bold text-gray-900">{companyName}</span>
          </Link>
          {tagline && <p className="text-sm text-gray-500 mt-2">{tagline}</p>}
          <h1 className="text-2xl font-bold text-gray-900 mt-4">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-2">{subtitle}</p>}
        </div>

        <div className={card ? 'bg-white rounded-2xl shadow-sm p-8' : undefined}>{children}</div>
      </div>
    </div>
  );
}
