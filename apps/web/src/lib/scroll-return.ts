/**
 * Scroll-position stash for the protected-route login round-trip.
 *
 * When a signed-out user hits a protected page, their path + scroll offset
 * are stashed; after login the ScrollManager restores that exact position
 * instead of jumping to the top. Pure functions over an injectable
 * Storage-like object so the logic is unit-testable without a browser.
 */

export const SCROLL_RETURN_KEY = 'pawtag_scroll_return';

export interface ScrollReturnEntry {
  path: string;
  y: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
}

/** Remember the scroll position of `path` for the post-login return. */
export function stashScrollBeforeLogin(
  path: string,
  y: number,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage || !path || !Number.isFinite(y) || y < 0) return;
  try {
    storage.setItem(SCROLL_RETURN_KEY, JSON.stringify({ path, y: Math.round(y) }));
  } catch {
    // Storage full/unavailable — restore is best-effort, never breaks navigation
  }
}

/**
 * Consume the stashed scroll position for `path`. Always removes the entry:
 * a stale stash must never resurrect an old offset on a later visit.
 * Returns the Y offset to restore, or null for "scroll to top as usual".
 */
export function takeScrollReturn(
  path: string,
  storage: StorageLike | null = defaultStorage(),
): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SCROLL_RETURN_KEY);
    if (!raw) return null;
    storage.removeItem(SCROLL_RETURN_KEY);
    const parsed = JSON.parse(raw) as ScrollReturnEntry;
    if (parsed?.path === path && Number.isFinite(parsed.y) && parsed.y > 0) return parsed.y;
    return null;
  } catch {
    return null;
  }
}
