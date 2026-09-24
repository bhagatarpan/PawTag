import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface MembershipRenewalReminderEmailData {
  customerName: string;
  tierName: string;
  renewalDate: string;
  price: number;
  dashboardUrl: string;
}

export function renderMembershipRenewalReminderEmail(data: MembershipRenewalReminderEmailData): string {
  const { customerName, tierName, renewalDate, price, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>PawTag ${tierName}</strong> membership will renew soon.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Renewal Details</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Plan:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tierName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Renewal date:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${renewalDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Amount:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">$${price.toFixed(2)}/year</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your membership will automatically renew using your saved payment method. If you need to update your payment method, please do so before the renewal date.
    </p>

    ${renderCtaButton(dashboardUrl, 'Manage Membership')}
  `;

  return renderBase({
    title: 'Membership Renewal Reminder',
    subtitle: `${tierName} — Renews Soon`,
    theme: 'warning',
    bodyHtml,
  });
}
