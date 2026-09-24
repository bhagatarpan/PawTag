import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface TagWarrantyExpiringEmailData {
  customerName: string;
  tagName: string;
  tagId: string;
  daysLeft: number;
  expiryDate: string;
  dashboardUrl: string;
}

export function renderTagWarrantyExpiringEmail(data: TagWarrantyExpiringEmailData): string {
  const { customerName, tagName, tagId, daysLeft, expiryDate, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>${tagName}</strong> tag warranty expires in <strong>${daysLeft} days</strong>.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px;">Tag Details</p>
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
          <td style="padding:4px 0;color:#6b7280;">Warranty expires:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${expiryDate}</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      To keep your tag working, you'll need an active membership after the warranty expires.
    </p>

    ${renderCtaButton(dashboardUrl, 'View Membership Options')}
  `;

  return renderBase({
    title: 'Tag Warranty Expiring',
    subtitle: `${tagName} — Action Required`,
    theme: 'warning',
    bodyHtml,
  });
}
