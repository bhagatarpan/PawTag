import { renderBase, renderCtaButton, renderInfoBox } from './base';
import { getGuardianNumber, getGuardianString } from '../../loyalty/guardian-config';

interface TierUpgradeEmailData {
  customerName: string;
  previousTier: string;
  newTier: string;
  points: number;
  benefits: string[];
  dashboardUrl: string;
  isGoldMember?: boolean;
}

const TIER_COLORS: Record<string, string> = {
  CARE: '#10b981',
  NURTURE: '#0d9488',
  PROTECTOR: '#8b5cf6',
  SAFEGUARD: '#f59e0b',
};

export async function renderTierUpgradeEmail(data: TierUpgradeEmailData): Promise<string> {
  const [goldPrice, goldUpsellText] = await Promise.all([
    getGuardianNumber('goldPrice'),
    getGuardianString('gold.emailUpsellText'),
  ]);
  const upsellHeading = goldUpsellText || 'Going places? Go Gold for 2× points.';
  const { customerName, previousTier, newTier, points, benefits, dashboardUrl, isGoldMember } = data;

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
    ${!isGoldMember ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;">
      <tr>
        <td style="padding:12px 16px;background-color:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;">
          <p style="margin:0;color:#92400e;font-size:14px;line-height:1.6;">
            <strong>${upsellHeading}</strong><br/>
            Gold members earn double points on every purchase and start at Nurture tier. Just $${goldPrice.toFixed(2)}/month.
          </p>
        </td>
      </tr>
    </table>
    ` : ''}
  `;

  return renderBase({
    title: 'Tier Upgrade!',
    subtitle: `You've reached ${newTier} status`,
    bodyHtml,
  });
}
