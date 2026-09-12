import { renderBase, renderInfoBox } from './base';

export function renderPasswordChangedEmail(data: {
  name: string;
  changedBy: string;
  ipAddress?: string;
  browser?: string;
  device?: string;
  location?: string;
}): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Your PawTag password has been successfully changed${data.changedBy === 'self' ? '' : ' by an administrator'}.
    </p>

    ${renderInfoBox(`
      <p style="margin:0 0 8px;color:#374151;font-size:13px;"><strong>Details:</strong></p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;width:120px;">Changed by</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.changedBy === 'self' ? 'You' : data.changedBy}</td>
        </tr>
        ${data.browser ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Browser</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.browser}</td>
        </tr>
        ` : ''}
        ${data.device ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Device</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.device}</td>
        </tr>
        ` : ''}
        ${data.ipAddress ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">IP Address</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;font-family:monospace;">${data.ipAddress}</td>
        </tr>
        ` : ''}
        ${data.location ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Location</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.location}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Time</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${new Date().toLocaleString('en-NZ', { dateStyle: 'full', timeStyle: 'short' })}</td>
        </tr>
      </table>
    `)}

    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
      If you did not make this change, please contact our support team immediately at
      <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>.
    </p>
  `;

  return renderBase({
    title: 'Password Changed',
    subtitle: 'Security Notification',
    preheader: 'Your PawTag password has been changed.',
    bodyHtml,
  });
}
