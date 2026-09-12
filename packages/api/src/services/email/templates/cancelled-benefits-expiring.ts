import { renderBase, renderInfoBox, renderCtaButton } from './base';

interface CancelledBenefitsExpiringData {
  name: string;
  planName: string;
  daysLeft: number;
  benefitsUntil: string;
  reSubscribeUrl: string;
}

export function renderCancelledBenefitsExpiringEmail(data: CancelledBenefitsExpiringData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi <strong>${data.name}</strong>,</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your <strong>${data.planName}</strong> benefits will expire in <strong>${data.daysLeft} day${data.daysLeft !== 1 ? 's' : ''}</strong>.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;line-height:1.6;margin:0;">
        <strong>Benefits expiring on ${data.benefitsUntil}</strong><br>
        Your current benefits include:<br>
        ${data.planName.includes('Gold') ? `
          &bull; 2&times; Guardian Points on all purchases<br>
          &bull; Free NZ-wide shipping<br>
          &bull; Higher PawRewards balance<br>
          &bull; Gold badge on profile<br>
          &bull; Priority customer support
        ` : `
          &bull; Active subscription benefits<br>
          &bull; Continued scanning and pet protection
        `}
      </p>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      No further charges will be made. If you'd like to continue enjoying these benefits, you can resubscribe at any time.
    </p>

    ${renderCtaButton(data.reSubscribeUrl, 'Re-subscribe Now')}

    <p style="color:#6b7280;font-size:13px;margin:20px 0 0;">
      If you have any questions, please contact our support team.
    </p>
  `;

  return renderBase({
    title: 'Benefits Expiring Soon',
    subtitle: `${data.planName} — ${data.daysLeft} day${data.daysLeft !== 1 ? 's' : ''} remaining`,
    bodyHtml,
    theme: 'warning',
  });
}
