import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface TierUpgradeEmailData {
  customerName: string;
  previousTier: string;
  newTier: string;
  points: number;
  benefits: string[];
  dashboardUrl: string;
}

const TIER_COLORS: Record<string, string> = {
  CARE: '#10b981',
  NURTURE: '#0d9488',
  PROTECTOR: '#8b5cf6',
  SAFEGUARD: '#f59e0b',
};

export function renderTierUpgradeEmail(data: TierUpgradeEmailData): string {
  const { customerName, previousTier, newTier, points, benefits, dashboardUrl } = data;

  const color = TIER_COLORS[newTier] || '#10b981';

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Congratulations! You've been promoted from <strong>${previousTier}</strong> to <strong>${newTier}</strong>!
    </p>
    ${renderInfoBox(`
      <p style="color:${color};font-size:13px;font-weight:600;margin:0 0 4px;">Your Points</p>
      <p style="color:#111827;font-size:24px;font-weight:700;margin:0;">${points}</p>
    `)}
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      As a ${newTier} Guardian, you now have access to these benefits:
    </p>
    ${renderInfoBox(`
      <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;">
        ${benefits.map(b => `<li style="margin-bottom:6px;">${b}</li>`).join('')}
      </ul>
    `)}
    ${renderCtaButton(dashboardUrl, 'View Your Dashboard')}
  `;

  return renderBase({
    title: 'Tier Upgrade!',
    subtitle: `You've reached ${newTier} status`,
    bodyHtml,
  });
}
