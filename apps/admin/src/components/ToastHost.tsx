import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToasts } from '../lib/toast';

export default function ToastHost() {
  const { toasts, remove } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
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
            className={`${styles} rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 pointer-events-auto animate-[toastIn_0.2s_ease-out]`}
            role="status"
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-white/70 hover:text-white transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}