import React from 'react';
import { Check, X } from 'lucide-react';

/**
 * EntitlementList — shared renderer for membership entitlements.
 *
 * Single source of truth for entitlement display copy across all
 * membership pages (subscribe, manage, marketing). Eliminates the
 * divergent copy that existed in 4+ hand-rolled implementations.
 *
 * The entitlement registry defines benefit keys; this component maps
 * those keys to consistent user-facing labels.
 */

export interface EntitlementEntry {
  enabled: boolean;
  value: any;
  name?: string;
  description?: string;
}

export interface EntitlementListProps {
  entitlements: Record<string, EntitlementEntry>;
  /** 'check' = benefits list (green checks); 'cross' = what you'll lose (red crosses) */
  variant?: 'check' | 'cross';
  /** Show disabled entitlements greyed out (default: false — skip them) */
  showDisabled?: boolean;
  /** Optional tag limit line appended at the end */
  tagLimit?: number;
  /** Extra class on the outer <ul> */
  className?: string;
}

/**
 * Format a free-shipping threshold value consistently.
 */
function formatShippingThreshold(value: number): string {
  return value === 0 ? 'LIFETIME Free Shipping' : `Free Shipping over $${value}`;
}

/**
 * Render a single entitlement row, or null if the key/value combination
 * should be skipped (disabled booleans, zero-value discounts, etc.).
 */
function renderEntitlementRow(
  key: string,
  entry: EntitlementEntry,
  variant: 'check' | 'cross',
  showDisabled: boolean,
): React.ReactNode | null {
  const Icon = variant === 'check' ? Check : X;
  const iconClass = variant === 'check' ? 'text-green-500' : 'text-red-400';

  // Boolean entitlements
  if (typeof entry.value === 'boolean') {
    const active = entry.enabled && entry.value;
    if (!active && !showDisabled) return null;
    return (
      <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
        <Icon size={16} className={`${active ? iconClass : 'text-gray-300'} shrink-0`} />
        <span className={active ? '' : 'text-gray-400'}>
          {entry.name || key}
        </span>
      </li>
    );
  }

  // points_multiplier: show only when > 1
  if (key === 'points_multiplier') {
    const multiplier = Number(entry.value);
    if (!entry.enabled || !Number.isFinite(multiplier) || multiplier <= 1) return null;
    return (
      <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
        <Icon size={16} className={`${iconClass} shrink-0`} />
        {multiplier}× Guardian Points
      </li>
    );
  }

  // free_shipping_threshold: $0 = lifetime, >0 = threshold
  if (key === 'free_shipping_threshold') {
    const threshold = Number(entry.value);
    if (!entry.enabled || !Number.isFinite(threshold) || threshold < 0) return null;
    return (
      <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
        <Icon size={16} className={`${iconClass} shrink-0`} />
        {formatShippingThreshold(threshold)}
      </li>
    );
  }

  // accessory_discount: show only when > 0
  if (key === 'accessory_discount') {
    const discount = Number(entry.value);
    if (!entry.enabled || !Number.isFinite(discount) || discount <= 0) return null;
    return (
      <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
        <Icon size={16} className={`${iconClass} shrink-0`} />
        {discount}% OFF All Accessories
      </li>
    );
  }

  // Unknown numeric/string keys with a display name — show if enabled
  if (entry.enabled && entry.name) {
    return (
      <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
        <Icon size={16} className={`${iconClass} shrink-0`} />
        {entry.name}
        {typeof entry.value === 'number' ? `: ${entry.value}` : ''}
      </li>
    );
  }

  return null;
}

export function EntitlementList({
  entitlements,
  variant = 'check',
  showDisabled = false,
  tagLimit,
  className,
}: EntitlementListProps) {
  const entries = Object.entries(entitlements || {});
  const rendered = entries
    .map(([key, entry]) => renderEntitlementRow(key, entry, variant, showDisabled))
    .filter(Boolean);

  const showTagLimit = typeof tagLimit === 'number' && tagLimit > 0;

  if (rendered.length === 0 && !showTagLimit) return null;

  return (
    <ul className={`space-y-2 ${className || ''}`}>
      {rendered}
      {showTagLimit && (
        <li className="flex items-center gap-2 text-sm text-gray-700">
          {variant === 'check' ? (
            <Check size={16} className="text-green-500 shrink-0" />
          ) : (
            <X size={16} className="text-red-400 shrink-0" />
          )}
          Cover up to {tagLimit} tags
        </li>
      )}
    </ul>
  );
}
