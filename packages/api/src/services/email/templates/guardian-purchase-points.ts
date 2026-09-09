import { renderBase, renderCtaButton } from './base';

interface PurchasePointsEmailData {
  customerName: string;
  orderNumber: string;
  pointsEarned: number;
  totalPoints: number;
  tier: string;
  pointsToNextTier: number | null;
  nextTier: string | null;
  isGoldMember: boolean;
  dashboardUrl: string;
}

export function renderPurchasePointsEmail(data: PurchasePointsEmailData): string {
  const {
    customerName,
    orderNumber,
    pointsEarned,
    totalPoints,
    tier,
    pointsToNextTier,
    nextTier,
    isGoldMember,
    dashboardUrl,
  } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Great news! You've earned <strong>${pointsEarned} Guardian Points</strong> from your recent order <strong>#${orderNumber}</strong>${isGoldMember ? ' (Gold 2x bonus!)' : ''}.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#166534;font-size:14px;margin:0 0 8px 0;">Your Guardian Balance</p>
      <p style="color:#15803d;font-size:32px;font-weight:bold;margin:0;">${totalPoints} Points</p>
      <p style="color:#166534;font-size:14px;margin:8px 0 0 0;">${tier} Tier</p>
      ${pointsToNextTier && pointsToNextTier > 0 ? `
        <p style="color:#16a34a;font-size:13px;margin:8px 0 0 0;">
          ${pointsToNextTier} Points to ${nextTier}
        </p>
      ` : ''}
    </div>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Every purchase brings you closer to the next tier and more rewards. Keep earning!
    </p>
    ${renderCtaButton(dashboardUrl, 'View Your Guardian Dashboard')}
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:24px;">
      Thank you for being a PawTag Guardian. Your support helps us reunite lost pets with their families.
    </p>
  `;

  return renderBase({
    title: `You earned ${pointsEarned} Points!`,
    bodyHtml,
  });
}
