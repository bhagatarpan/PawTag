import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface MembershipTierChangedEmailData {
  customerName: string;
  oldTierName: string;
  newTierName: string;
  newPrice: number;
  renewalDate: string;
  dashboardUrl: string;
}

export function renderMembershipTierChangedEmail(data: MembershipTierChangedEmailData): string {
  const { customerName, oldTierName, newTierName, newPrice, renewalDate, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your membership has been changed from <strong>${oldTierName}</strong> to <strong>${newTierName}</strong>.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">New Plan Details</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">New plan:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${newTierName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Price:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">$${newPrice.toFixed(2)}/year</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Renews:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${renewalDate}</td>
        </tr>
      </table>
    `)}

    ${renderCtaButton(dashboardUrl, 'View Your Membership')}
  `;

  return renderBase({
    title: 'Membership Changed',
    subtitle: `Now on ${newTierName}`,
    bodyHtml,
  });
}
