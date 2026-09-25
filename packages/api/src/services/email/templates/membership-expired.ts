import { renderBase, renderInfoBox } from './base';

interface MembershipExpiredEmailData {
  customerName: string;
  tierName: string;
  expiredAt: string;
  resubscribeUrl: string;
}

export function renderMembershipExpiredEmail(data: MembershipExpiredEmailData): string {
  const { customerName, tierName, expiredAt, resubscribeUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>PawTag ${tierName}</strong> membership has expired.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px;">Membership Expired</p>
      <p style="color:#92400e;font-size:13px;margin:0;">
        Your membership expired on ${expiredAt}. Some of your benefits may no longer be available.
      </p>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      To continue enjoying your benefits, please resubscribe.
    </p>

    <a href="${resubscribeUrl}" style="display:inline-block;background-color:#0d9488;color:white;padding:14px 40px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
      Resubscribe to ${tierName}
    </a>
  `;

  return renderBase({
    title: 'Membership Expired',
    subtitle: `${tierName} — Action Required`,
    theme: 'danger',
    bodyHtml,
  });
}
