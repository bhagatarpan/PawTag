import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface MetaRowProps {
  /** Decorative leading icon in a tinted well. */
  icon?: ReactNode;
  title: ReactNode;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Right-aligned value (date, status, amount). */
  value?: ReactNode;
  /** Show the trailing chevron — set when the row is tappable (wrap in a Link/Button). */
  chevron?: boolean;
  className?: string;
}

/**
 * Icon-led list row: icon well + title/subtitle + right value + optional
 * chevron. The backbone of the redesigned account lists (pet meta, order
 * actions, invoice rows, settings entries). Callers wrap it in a Link or
 * button for interactivity so semantics stay honest.
 */
export function MetaRow({
  icon,
  title,
  subtitle,
  value,
  chevron = false,
  className = '',
}: MetaRowProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${className}`}>
      {icon && (
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
      </div>
      {value && (
        <span className="shrink-0 text-sm text-gray-600">{value}</span>
      )}
      {chevron && <ChevronRight size={16} className="shrink-0 text-gray-400" />}
    </div>
  );
}
