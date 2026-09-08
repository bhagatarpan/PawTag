import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface GuardianRenewalReminderEmailData {
  customerName: string;
  tier: string;
  renewalDate: string;
  currentBenefits: string[];
  dashboardUrl: string;
}

export function renderGuardianRenewalReminderEmail(data: GuardianRenewalReminderEmailData): string {
  const { customerName, tier, renewalDate, currentBenefits, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Your Guardian membership is approaching its renewal date on <strong>${renewalDate}</strong>.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      As a <strong>${tier} Guardian</strong>, you enjoy these benefits:
    </p>
    ${renderInfoBox(`
      <ul style="color:#374151;font-size:14px;margin:0;padding-left:20px;">
        ${currentBenefits.map(b => `<li style="margin-bottom:6px;">${b}</li>`).join('')}
      </ul>
    `)}
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Ensure your payment method is up to date to continue enjoying uninterrupted protection for your pet.
    </p>
    ${renderCtaButton(dashboardUrl, 'Manage Subscription')}
  `;

  return renderBase({
    title: 'Your Guardian Membership Renewal',
    subtitle: 'Keep your pet protected',
    bodyHtml,
  });
}
