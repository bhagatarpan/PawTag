import { Shield, Crown } from 'lucide-react';

export interface GuardianPointsPreviewProps {
  /** Points earned for this order */
  points: number;
  /** Whether user is a Gold member */
  isGoldMember?: boolean;
  /** Current tier name */
  tier?: string;
  /** Points needed to reach next tier */
  pointsToNextTier?: number | null;
  /** Next tier name */
  nextTierName?: string;
}

/**
 * Reusable Guardian Reward Points preview component.
 * Shows the points a customer will earn from their purchase.
 * Used in Cart OrderSummary and Checkout Review step.
 *
 * Design tokens from DESIGN.md:
 * - Gold: amber-50, amber-700, amber-200
 * - Guardian: primary-50, primary-700
 * - Badge: inline-block px-3 py-1 rounded-full
 */
export default function GuardianPointsPreview({
  points,
  isGoldMember = false,
  tier,
  pointsToNextTier,
  nextTierName,
}: GuardianPointsPreviewProps) {
  if (!points || points <= 0) return null;

  return (
    <div className={`p-3 rounded-xl border ${
      isGoldMember
        ? 'bg-amber-50 border-amber-200'
        : 'bg-primary-50 border-primary-100'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Shield className={`h-4 w-4 ${isGoldMember ? 'text-amber-600' : 'text-primary-600'}`} />
        <span className={`text-sm font-medium ${isGoldMember ? 'text-amber-800' : 'text-primary-800'}`}>
          {isGoldMember ? 'Guardian Gold' : tier || 'Guardian'} Member
        </span>
        {isGoldMember && (
          <span className="inline-block px-3 py-1 rounded-full bg-amber-200 text-amber-800 text-xs font-semibold">
            2x Points
          </span>
        )}
      </div>
      <p className={`text-sm ${isGoldMember ? 'text-amber-700' : 'text-primary-700'}`}>
        You&apos;ll earn <strong>{points} Guardian Points</strong> on this order
      </p>
      {pointsToNextTier && pointsToNextTier > 0 && nextTierName && (
        <p className="text-xs text-gray-500 mt-1">
          {pointsToNextTier} Points to {nextTierName}
        </p>
      )}
    </div>
  );
}
