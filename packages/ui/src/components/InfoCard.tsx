import type { ReactNode } from 'react';

export type InfoCardTone = 'primary' | 'success' | 'danger' | 'amber';

export interface InfoCardProps {
  tone?: InfoCardTone;
  /** Decorative leading icon in a tinted well. */
  icon?: ReactNode;
  title?: ReactNode;
  /** Optional right-aligned trailing content (pill, value, control). */
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const toneClasses: Record<InfoCardTone, { card: string; well: string; title: string }> = {
  primary: {
    card: 'bg-primary-50 border-primary-100',
    well: 'bg-white text-primary-600',
    title: 'text-primary-800',
  },
  success: {
    card: 'bg-green-50 border-green-100',
    well: 'bg-white text-green-600',
    title: 'text-green-800',
  },
  danger: {
    card: 'bg-red-50 border-red-100',
    well: 'bg-white text-red-500',
    title: 'text-red-800',
  },
  amber: {
    card: 'bg-amber-50 border-amber-100',
    well: 'bg-white text-amber-600',
    title: 'text-amber-800',
  },
};

/**
 * Teal-tinted emphasis card ("Adding another pet?", "On the way",
 * "Free shipping…"). Replaces ad-hoc tinted divs so every info card shares
 * one shape and tone system.
 */
export function InfoCard({
  tone = 'primary',
  icon,
  title,
  trailing,
  children,
  className = '',
}: InfoCardProps) {
  const t = toneClasses[tone];
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${t.card} ${className}`}>
      {icon && (
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.well}`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <p className={`text-sm font-semibold ${t.title}`}>{title}</p>}
        {children && (
          <div className={title ? 'mt-0.5 text-sm text-gray-600' : 'text-sm text-gray-600'}>
            {children}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0 self-center">{trailing}</div>}
    </div>
  );
}
