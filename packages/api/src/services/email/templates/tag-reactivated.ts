import { renderBase, renderInfoBox } from './base';

interface TagReactivatedEmailData {
  customerName: string;
  tagName: string;
  tagId: string;
  membershipTier: string;
}

export function renderTagReactivatedEmail(data: TagReactivatedEmailData): string {
  const { customerName, tagName, tagId, membershipTier } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Great news! Your <strong>${tagName}</strong> tag is now active again.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Tag Reactivated</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Tag:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tagName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Tag ID:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;font-family:monospace;">${tagId}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Membership:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${membershipTier}</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your tag is now covered by your ${membershipTier} membership. Thank you for being a PawTag member!
    </p>
  `;

  return renderBase({
    title: 'Tag Reactivated',
    subtitle: `${tagName} — Active Again`,
    theme: 'success',
    bodyHtml,
  });
}
