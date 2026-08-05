import { renderBase, renderInfoBox } from './base';

export function renderLoginNotificationEmail(data: {
  name: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  location?: string;
}): string {
  const statusColor = data.success ? '#0d9488' : '#dc2626';
  const statusLabel = data.success ? 'Successful Login' : 'Failed Login Attempt';
  const statusBg = data.success ? '#f0fdfa' : '#fef2f2';
  const statusBorder = data.success ? '#ccfbf1' : '#fecaca';

  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      ${data.success
        ? 'We noticed a login to your PawTag admin account.'
        : 'We noticed a failed login attempt on your PawTag admin account.'}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;background-color:${statusBg};border-radius:8px;border:1px solid ${statusBorder};">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Status</p>
          <p style="margin:0;color:${statusColor};font-size:16px;font-weight:700;">${statusLabel}</p>
        </td>
      </tr>
    </table>

    ${renderInfoBox(`
      <p style="margin:0 0 8px;color:#374151;font-size:13px;"><strong>Details:</strong></p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;width:120px;">Email</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">IP Address</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.ipAddress}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Time</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.timestamp}</td>
        </tr>
        ${data.location ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Location</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;">${data.location}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Device</td>
          <td style="padding:4px 0;color:#374151;font-weight:500;word-break:break-all;">${data.userAgent}</td>
        </tr>
      </table>
    `)}

    ${!data.success ? `
      <p style="margin:20px 0 0;color:#dc2626;font-size:14px;line-height:1.5;">
        <strong>If this wasn't you:</strong> Your account is protected by rate limiting and automatic lockout after multiple failed attempts. If you're concerned about unauthorized access, please change your password immediately or contact support.
      </p>
    ` : `
      <p style="margin:20px 0 0;color:#6b7280;font-size:14px;line-height:1.5;">
        If this wasn't you, please change your password immediately and contact
        <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>.
      </p>
    `}
  `;

  return renderBase({
    title: data.success ? 'Admin Login Notification' : 'Admin Login Alert',
    subtitle: 'PawTag security notification',
    preheader: data.success
      ? `New login detected on your PawTag admin account from ${data.ipAddress}`
      : `Failed login attempt detected on your PawTag admin account from ${data.ipAddress}`,
    bodyHtml,
  });
}
