import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

/**
 * Tag usage vs activation limit (docs/TAG-ACTIVATION-LIMIT.md) — the ONE
 * usage widget shown by both portals (customer dashboard card, CSR drawer
 * header). Enterprise quota pattern: count + usage bar + status chip,
 * instead of a plain-text sentence.
 *
 * Red (bar + chip) once the customer is at/over their activation limit:
 * - at limit:   "Limit reached"    — one more activation via the one-time fee
 * - over limit: "Upgrade required" — membership upgrade unlocks more
 *
 * Display only — the server enforces the cap at activation time.
 */

export interface TagUsageIndicatorProps {
  activeCount: number;
  limit: number;
  /** Owned (purchased & kept) tag count — shown when provided. */
  ownedCount?: number;
  /** 'block' = dashboard card; 'inline' = compact drawer-header pill. */
  variant?: 'block' | 'inline';
  className?: string;
}

export function TagUsageIndicator({
  activeCount,
  limit,
  ownedCount,
  variant = 'inline',
  className = '',
}: TagUsageIndicatorProps) {
  const reached = activeCount >= limit;
  const over = activeCount > limit;
  const pct = limit > 0 ? Math.min(100, Math.round((activeCount / limit) * 100)) : 0;

  const status = over
    ? { icon: <Lock size={11} strokeWidth={2.5} />, label: 'Upgrade required' }
    : reached
      ? { icon: <AlertTriangle size={11} strokeWidth={2.5} />, label: 'Limit reached' }
      : null;

  const title = over
    ? 'You have reached your tag activation limit. Upgrade your membership to activate more tags.'
    : reached
      ? "You've activated every tag in your plan. Activate one more with the one-time fee, or upgrade your membership."
      : undefined;

  const countText = (
    <span className="text-xs font-semibold text-gray-700">
      {activeCount} of {limit} active
    </span>
  );

  const ownedText =
    ownedCount !== undefined ? (
      <span className="text-[11px] font-normal text-gray-400">{ownedCount} owned</span>
    ) : null;

  const bar = (
    <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
      <div
        className={`h-full rounded-full ${reached ? 'bg-red-500' : 'bg-primary-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );

  const chip = status ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
      {status.icon}
      {status.label}
    </span>
  ) : null;

  if (variant === 'block') {
    // Dashboard card: value context (count + owned), usage bar, status line
    return (
      <div className={`mt-1 space-y-1.5 ${className}`} title={title}>
        <div className="flex items-baseline justify-between gap-2">
          {countText}
          {ownedText}
        </div>
        {bar}
        {chip && <div className="flex items-center">{chip}</div>}
      </div>
    );
  }

  // Drawer header: compact self-contained pill
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 ${className}`}
      title={title}
    >
      {countText}
      <span className="w-14 shrink-0">{bar}</span>
      {chip}
    </span>
  );
}

export default TagUsageIndicator;
