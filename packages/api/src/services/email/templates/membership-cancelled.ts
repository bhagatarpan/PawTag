import { renderBase, renderInfoBox } from './base';

interface MembershipCancelledEmailData {
  customerName: string;
  tierName: string;
  cancelledAt: string;
  benefitsUntil: string;
  resubscribeUrl: string;
}

export function renderMembershipCancelledEmail(data: MembershipCancelledEmailData): string {
  const { customerName, tierName, cancelledAt, benefitsUntil, resubscribeUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>PawTag ${tierName}</strong> membership has been cancelled.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px;">What happens next:</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Cancelled on:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${cancelledAt}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Benefits until:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${benefitsUntil}</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      You'll keep your benefits until ${benefitsUntil}. If you change your mind, you can resubscribe anytime.
    </p>

    <a href="${resubscribeUrl}" style="display:inline-block;background-color:#0d9488;color:white;padding:14px 40px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
      Resubscribe to ${tierName}
    </a>
  `;

  return renderBase({
    title: 'Membership Cancelled',
    subtitle: `${tierName} — Confirmation`,
    theme: 'warning',
    bodyHtml,
  });
}
