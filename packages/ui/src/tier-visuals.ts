/**
 * Tier visual configuration — single source of truth for membership
 * tier icon/gradient presentation across web and admin apps.
 *
 * The MembershipTier DB model stores `icon` (Lucide name), `color` (hex),
 * and `gradient` (Tailwind fragment). These helpers resolve those DB values
 * to React components / class strings, with sensible fallbacks.
 *
 * Per AGENTS.md §29: platform-neutral data maps live in packages/shared;
 * React-specific registries (Lucide icon components) live in packages/ui.
 */

import { Crown, Diamond, Shield, type LucideIcon } from 'lucide-react';

/**
 * Fallback icon registry keyed by tier name.
 * Used when the DB `icon` field is missing or names an unknown icon.
 */
export const TIER_ICONS: Record<string, LucideIcon> = {
  gold: Crown,
  platinum: Diamond,
  black: Shield,
};

/**
 * Fallback Tailwind gradient class fragments keyed by tier name.
 * Used when the DB `gradient` field is missing.
 */
export const TIER_GRADIENTS: Record<string, string> = {
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-gray-300 to-gray-500',
  black: 'from-gray-800 to-black',
};

/**
 * Resolve a tier's Lucide icon component from its DB `icon` string.
 *
 * Resolution order:
 * 1. Exact match in TIER_ICONS by the DB icon name
 * 2. Match by tier key in TIER_ICONS
 * 3. Fallback to Crown
 *
 * @param iconName - DB `icon` field value (e.g. 'Crown', 'Diamond')
 * @param tierKey - tier key (e.g. 'gold', 'platinum') used as secondary lookup
 */
export function resolveTierIcon(iconName?: string, tierKey?: string): LucideIcon {
  if (iconName && iconName in TIER_ICONS) {
    return TIER_ICONS[iconName];
  }
  if (tierKey && tierKey in TIER_ICONS) {
    return TIER_ICONS[tierKey];
  }
  return Crown;
}

/**
 * Resolve a tier's Tailwind gradient class from its DB `gradient` field.
 *
 * Resolution order:
 * 1. DB `gradient` value (if non-empty)
 * 2. Fallback from TIER_GRADIENTS by tier key
 * 3. Fallback to gold's gradient
 *
 * @param tierKey - tier key (e.g. 'gold', 'platinum')
 * @param dbGradient - DB `gradient` field value (e.g. 'from-yellow-400 to-amber-500')
 */
export function resolveTierGradient(tierKey: string, dbGradient?: string): string {
  if (dbGradient && dbGradient.trim()) {
    return dbGradient;
  }
  return TIER_GRADIENTS[tierKey] || TIER_GRADIENTS.gold;
}

/**
 * Marketing flags for tier cards. These are presentation hints that may
 * be set per-deployment; they are not sourced from the DB.
 */
export interface TierMarketingFlags {
  popular?: boolean;
  recommended?: boolean;
}

const TIER_MARKETING: Record<string, TierMarketingFlags> = {
  gold: { popular: true },
  platinum: { recommended: true },
};

/**
 * Get marketing flags (popular/recommended) for a tier.
 */
export function getTierMarketingFlags(tierKey: string): TierMarketingFlags {
  return TIER_MARKETING[tierKey] || {};
}
