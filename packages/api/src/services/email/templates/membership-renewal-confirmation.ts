import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface MembershipRenewalConfirmationEmailData {
  customerName: string;
  tierName: string;
  renewalDate: string;
  price: number;
  dashboardUrl: string;
}

/**
 * Membership renewal CONFIRMATION — sent AFTER a successful renewal
 * charge. Past tense throughout ("has been renewed", "your card was
 * charged") — the reminder template's future-tense copy must never be
 * reused here (email copy must match actual behaviour).
 */
export function renderMembershipRenewalConfirmationEmail(data: MembershipRenewalConfirmationEmailData): string {
  const { customerName, tierName, renewalDate, price, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Great news — your <strong>PawTag ${tierName}</strong> membership has been renewed. Your saved
      payment method was charged and your benefits continue without interruption.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Renewal Details</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Plan:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tierName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Next renewal:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${renewalDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Amount charged:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">$${price.toFixed(2)}</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your next renewal will be processed automatically on the date above using your saved
      payment method. You can update your payment details or manage your membership anytime.
    </p>

    ${renderCtaButton(dashboardUrl, 'Manage Membership')}
  `;

  return renderBase({
    title: 'Membership Renewed',
    subtitle: `${tierName} — Thank you`,
    theme: 'default',
    bodyHtml,
  });
}
