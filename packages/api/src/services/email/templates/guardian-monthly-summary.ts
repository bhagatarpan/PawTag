import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface MonthlySummaryEmailData {
  customerName: string;
  tier: string;
  pointsEarned: number;
  totalPoints: number;
  pawRewardsBalance: number;
  pawRewardsAllocated: number;
  topActivity: string;
  dashboardUrl: string;
}

const TIER_COLORS: Record<string, string> = {
  CARE: '#10b981',
  NURTURE: '#0d9488',
  PROTECTOR: '#8b5cf6',
  SAFEGUARD: '#f59e0b',
};

export function renderMonthlySummaryEmail(data: MonthlySummaryEmailData): string {
  const { customerName, tier, pointsEarned, totalPoints, pawRewardsBalance, pawRewardsAllocated, topActivity, dashboardUrl } = data;

  const color = TIER_COLORS[tier] || '#10b981';

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Here's your Guardian activity summary for this month. As a <strong>${tier}</strong> Guardian, you've been earning points and rewards!
    </p>
    ${renderInfoBox(`
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Points Earned</td>
          <td style="padding:8px 0;color:${color};font-weight:600;text-align:right;">+${pointsEarned}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Total Points</td>
          <td style="padding:8px 0;color:#111827;font-weight:600;text-align:right;border-top:1px solid #e5e7eb;">${totalPoints}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb;">PawRewards Allocated</td>
          <td style="padding:8px 0;color:#10b981;font-weight:600;text-align:right;border-top:1px solid #e5e7eb;">+$${pawRewardsAllocated.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Rewards Balance</td>
          <td style="padding:8px 0;color:#10b981;font-weight:600;text-align:right;border-top:1px solid #e5e7eb;">$${pawRewardsBalance.toFixed(2)}</td>
        </tr>
      </table>
    `)}
    ${topActivity ? `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      <strong>Top Activity:</strong> ${topActivity}
    </p>
    ` : ''}
    ${renderCtaButton(dashboardUrl, 'View Full Dashboard')}
  `;

  return renderBase({
    title: 'Your Monthly Summary',
    subtitle: `${tier} Guardian activity report`,
    bodyHtml,
  });
}
