/**
 * Single source of truth for the workflow return-URL mechanism.
 *
 * Workflow links (cart, checkout, protected deep links) record where the user
 * was before sending them to /login; Login/VerifyAccount consume the value on
 * success. Plain navbar sign-in deliberately records nothing — it lands on
 * /account per product decision.
 *
 * All values are validated as same-origin relative paths to keep a poisoned
 * key from turning login into an open redirect.
 */

export const RETURN_URL_KEY = 'pawtag_return_url';

/** Only same-origin relative paths pass — blocks `//evil.com` and absolute URLs. */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

/** Record the page to return to after login. Unsafe values are ignored. */
export function setReturnUrl(url: string): void {
  const safe = safeReturnUrl(url);
  if (safe) localStorage.setItem(RETURN_URL_KEY, safe);
}

/** Read the return URL without consuming it (validates safety). */
export function peekReturnUrl(): string | null {
  return safeReturnUrl(localStorage.getItem(RETURN_URL_KEY));
}

/** Read and clear the return URL (also clears poisoned/stale values). */
export function consumeReturnUrl(): string | null {
  const value = peekReturnUrl();
  localStorage.removeItem(RETURN_URL_KEY);
  return value;
}
