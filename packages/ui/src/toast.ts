/**
 * Shared toast notification API (customer web + admin).
 *
 * Module-level emitter: `toast.success('Saved')` works from anywhere —
 * event handlers, services, non-React code — without providers or hooks.
 * The visual host is `<ToastHost />`, mounted once per app at the root so
 * no page-level transform (e.g. fade-in wrappers) can ever pin it away
 * from the viewport.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toast: ToastItem) => void;

const listeners = new Set<Listener>();
let counter = 0;

function emit(kind: ToastKind, message: string) {
  const item: ToastItem = { id: ++counter, kind, message };
  listeners.forEach((listener) => listener(item));
}

export const toast = {
  success: (message: string) => emit('success', message),
  error: (message: string) => emit('error', message),
  info: (message: string) => emit('info', message),
};

/** Subscribe to incoming toasts. Used by <ToastHost />; returns unsubscribe. */
export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
