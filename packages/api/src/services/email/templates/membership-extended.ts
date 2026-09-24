import { renderBase, renderInfoBox } from './base';

interface MembershipExtendedEmailData {
  customerName: string;
  tierName: string;
  extensionType: string;
  extensionDays: number;
  newPeriodEnd: string;
  dashboardUrl: string;
}

export function renderMembershipExtendedEmail(data: MembershipExtendedEmailData): string {
  const { customerName, tierName, extensionType, extensionDays, newPeriodEnd, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>PawTag ${tierName}</strong> membership has been extended by ${extensionDays} days.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Extension Details</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Extension type:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${extensionType === 'charge' ? 'Paid Extension' : 'Complimentary Extension'}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Extension:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${extensionDays} days</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">New expiry:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${newPeriodEnd}</td>
        </tr>
      </table>
    `)}

    <a href="${dashboardUrl}" style="display:inline-block;background-color:#0d9488;color:white;padding:14px 40px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
      View Your Membership
    </a>
  `;

  return renderBase({
    title: 'Membership Extended',
    subtitle: `${tierName} — Extension Confirmed`,
    theme: 'success',
    bodyHtml,
  });
}
