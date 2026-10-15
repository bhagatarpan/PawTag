import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { subscribeToToasts, type ToastItem } from '../toast';

/** How long a toast stays on screen before auto-dismissing. */
const TOAST_DURATION_MS = 3500;
/** Exit animation duration; the item is removed after this. */
const EXIT_MS = 200;

/**
 * Visual host for the shared toast API (`toast.success/error/info`).
 *
 * Mount exactly once per app, at the root, OUTSIDE animated page wrappers:
 * any ancestor with a CSS transform turns `position: fixed` into
 * `position: absolute` relative to that ancestor, which is how save
 * confirmations previously became invisible when the user was scrolled
 * to the bottom of the page.
 *
 * Position: bottom-center on mobile (always in view at any scroll depth,
 * thumb-reachable, safe-area padded for notches/home bars) and top-right
 * on desktop (clear of dense admin tables).
 */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const timersRef = useRef<Map<number, number[]>>(new Map());

  const dismiss = useCallback((id: number) => {
    setLeaving((prev) => new Set(prev).add(id));
    const exitTimer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      timersRef.current.delete(id);
    }, EXIT_MS);
    timersRef.current.set(id, [...(timersRef.current.get(id) || []), exitTimer]);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((item) => {
      setToasts((prev) => {
        // Cap the stack so rapid failures can't bury the page.
        const next = prev.length >= 3 ? prev.slice(prev.length - 2) : prev;
        return [...next, item];
      });
      const autoTimer = window.setTimeout(() => dismiss(item.id), TOAST_DURATION_MS);
      timersRef.current.set(item.id, [autoTimer]);
    });
    return () => {
      unsubscribe();
      timersRef.current.forEach((timers) => timers.forEach(clearTimeout));
      timersRef.current.clear();
    };
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:items-end md:px-0 md:pb-0"
    >
      {toasts.map((t) => {
        const styles =
          t.kind === 'success'
            ? 'bg-emerald-600 text-white'
            : t.kind === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 text-white';
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
        return (
          <div
            key={t.id}
            role="status"
            className={`${styles} w-full max-w-sm rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 pointer-events-auto transition-all duration-200 ease-out motion-reduce:transition-none ${
              leaving.has(t.id)
                ? 'opacity-0 translate-y-2 md:translate-y-0 md:translate-x-2'
                : 'opacity-100 translate-y-0'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-white/70 hover:text-white transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastHost;
