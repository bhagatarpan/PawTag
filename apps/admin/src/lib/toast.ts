import { useEffect, useState, useCallback } from 'react';

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
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (message: string) => emit('success', message),
  error: (message: string) => emit('error', message),
  info: (message: string) => emit('info', message),
};

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const listener = (item: ToastItem) => {
      setToasts((prev) => [...prev, item]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 3200);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { toasts, remove };
}