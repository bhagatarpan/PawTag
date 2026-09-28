import { renderBase, renderInfoBox } from './base';

interface MembershipCancelledEmailData {
  customerName: string;
  tierName: string;
  cancelledAt: string;
  benefitsUntil: string;
  resubscribeUrl: string;
  retentionOffer?: {
    code: string;
    discountValue: number;
    freeShipping: boolean;
    expiresAt: Date;
  };
}

export function renderMembershipCancelledEmail(data: MembershipCancelledEmailData): string {
  const { customerName, tierName, cancelledAt, benefitsUntil, resubscribeUrl, retentionOffer } = data;

  const retentionHtml = retentionOffer ? `
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;margin:24px 0;">
      <p style="color:#166534;font-size:16px;font-weight:700;margin:0 0 12px;">We're sorry to see you go!</p>
      <p style="color:#166534;font-size:14px;line-height:1.6;margin:0 0 16px;">
        As a thank you for being a ${tierName} member, here's a one-time offer for your next purchase:
      </p>
      <table style="width:100%;background-color:white;border-radius:8px;padding:16px;border:1px solid #d1fae5;">
        <tr>
          <td style="padding:8px 0;color:#374151;font-size:14px;">Discount Code:</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;font-size:16px;color:#0d9488;font-family:monospace;">${retentionOffer.code}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#374151;font-size:14px;">Discount:</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#166534;">${retentionOffer.discountValue}% off</td>
        </tr>
        ${retentionOffer.freeShipping ? `
        <tr>
          <td style="padding:8px 0;color:#374151;font-size:14px;">Bonus:</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#166534;">Free shipping</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:8px 0;color:#374151;font-size:14px;">Valid until:</td>
          <td style="padding:8px 0;text-align:right;color:#6b7280;">${retentionOffer.expiresAt.toLocaleDateString('en-NZ', { dateStyle: 'full' })}</td>
        </tr>
      </table>
      <p style="color:#166534;font-size:13px;margin:12px 0 0;">
        Use this code at checkout. No minimum spend required.
      </p>
    </div>
  ` : '';

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

    ${retentionHtml}

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
