import React from 'react';

/**
 * Tag usage vs activation limit (docs/TAG-ACTIVATION-LIMIT.md) — the ONE
 * indicator shown by both portals (customer dashboard card sub-line, CSR
 * drawer header). Red once the customer is at/over their limit; the suffix
 * tells them what unlocks the next activation (fee vs upgrade).
 *
 * Display only — the server enforces the cap at activation time.
 */

export interface TagUsageIndicatorProps {
  activeCount: number;
  limit: number;
  /** Owned (purchased & kept) tag count — shown when provided. */
  ownedCount?: number;
  /** 'block' = dashboard card sub-line; 'inline' = compact header pill. */
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

  const base = `${activeCount} active · limit ${limit}`;
  const owned = ownedCount !== undefined ? ` · ${ownedCount} owned` : '';
  const suffix = reached ? (over ? ' — upgrade to activate more' : ' — pay or upgrade to activate more') : '';
  const title = reached
    ? over
      ? 'You have reached your tag activation limit. Upgrade your membership to activate more tags.'
      : 'You have activated every tag in your plan. Activate one more with the one-time fee, or upgrade.'
    : undefined;

  return (
    <span
      className={`${variant === 'block' ? 'block' : 'inline-flex items-center'} text-xs font-medium ${
        reached ? 'text-red-600' : 'text-gray-500'
      } ${className}`}
      title={title}
    >
      {base}
      {owned}
      {suffix}
    </span>
  );
}

export default TagUsageIndicator;
