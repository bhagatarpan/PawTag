import { renderBase, renderInfoBox } from './base';

interface TagDeactivatedEmailData {
  customerName: string;
  tagName: string;
  tagId: string;
  resubscribeUrl: string;
}

export function renderTagDeactivatedEmail(data: TagDeactivatedEmailData): string {
  const { customerName, tagName, tagId, resubscribeUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>${tagName}</strong> tag has been deactivated because your membership has expired.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px;">Tag Deactivated</p>
      <p style="color:#92400e;font-size:13px;margin:0;">
        Your tag will no longer work for finder scans until you renew your membership.
      </p>
    `)}

    <a href="${resubscribeUrl}" style="display:inline-block;background-color:#0d9488;color:white;padding:14px 40px;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
      Renew Membership
    </a>
  `;

  return renderBase({
    title: 'Tag Deactivated',
    subtitle: `${tagName} — Membership Required`,
    theme: 'danger',
    bodyHtml,
  });
}
