import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface MembershipWelcomeEmailData {
  customerName: string;
  tierName: string;
  price: number;
  renewalDate: string;
  dashboardUrl: string;
}

export function renderMembershipWelcomeEmail(data: MembershipWelcomeEmailData): string {
  const { customerName, tierName, price, renewalDate, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Welcome to <strong>PawTag ${tierName}</strong>! Your membership is now active.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Membership Details</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Plan:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tierName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Price:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">$${price.toFixed(2)}/year</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Renews:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${renewalDate}</td>
        </tr>
      </table>
    `)}

    ${renderCtaButton(dashboardUrl, 'View Your Membership')}

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Your membership will automatically renew each year. You can manage or cancel anytime from your dashboard.
    </p>
  `;

  return renderBase({
    title: 'Welcome to Gold',
    subtitle: `Your ${tierName} membership is now active`,
    bodyHtml,
  });
}
