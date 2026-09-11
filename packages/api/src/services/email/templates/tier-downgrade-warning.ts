import { renderBase, renderCtaButton, renderStatusCard } from './base';

interface TierDowngradeData {
  customerName: string;
  currentTier: string;
  newTier: string;
  points: number;
  pointsNeeded: number;
  daysRemaining: number;
  dashboardUrl: string;
}

export function renderTierDowngradeWarningEmail(data: TierDowngradeData): string {
  const pointsToKeep = data.pointsNeeded - data.points;

  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.customerName},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your <strong>${data.currentTier}</strong> Guardian status is at risk. You have <strong>${data.daysRemaining} day${data.daysRemaining !== 1 ? 's' : ''}</strong> to earn <strong>${pointsToKeep} more point${pointsToKeep !== 1 ? 's' : ''}</strong> to keep your current tier.
    </p>
    ${renderStatusCard('warning', 'Tier Downgrade Warning', `Without action, your tier will change from ${data.currentTier} to ${data.newTier}.`)}
    <div style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="color:#92400e;font-size:14px;margin:0 0 8px;"><strong>How to keep your ${data.currentTier} status:</strong></p>
      <ul style="color:#92400e;font-size:14px;margin:0;padding-left:20px;">
        <li>Make a purchase to earn Guardian points</li>
        <li>Refer a friend for bonus points</li>
        <li>Keep your pet's profile complete</li>
      </ul>
    </div>
    ${renderCtaButton(data.dashboardUrl, 'View Your Dashboard')}
  `;

  return renderBase({
    title: `Keep Your ${data.currentTier} Status`,
    subtitle: 'Guardian Tier Notice',
    bodyHtml,
    theme: 'warning',
  });
}
