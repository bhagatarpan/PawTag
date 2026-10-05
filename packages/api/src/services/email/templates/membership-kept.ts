import { renderBase, renderInfoBox, renderCtaButton } from './base';

interface MembershipKeptEmailData {
  customerName: string;
  tierName: string;
  startDate: string;
  endDate: string;
  dashboardUrl: string;
}

export function renderMembershipKeptEmail(data: MembershipKeptEmailData): string {
  const { customerName, tierName, startDate, endDate, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>${tierName}</strong> membership is active again. You kept your membership — no payment was required.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Membership details</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Plan</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tierName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Active from</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${startDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Active until</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${endDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Payment</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">No charge</td>
        </tr>
      </table>
    `, 'success')}

    ${renderCtaButton(dashboardUrl, 'View Your Membership', 'success')}

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Your original membership dates were preserved. You can manage membership anytime from your account.
    </p>
  `;

  return renderBase({
    title: 'Your Membership Is Active Again',
    subtitle: `${tierName} — Kept`,
    theme: 'success',
    bodyHtml,
  });
}
