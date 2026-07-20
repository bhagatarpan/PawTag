import { renderBase } from './base';

export function renderAccountStatusEmail(data: {
  name: string;
  status: string;
  reason?: string;
}): string {
  const statusColors: Record<string, string> = {
    active: '#0d9488',
    suspended: '#dc2626',
    inactive: '#6b7280',
    pending_verification: '#f59e0b',
  };

  const statusLabels: Record<string, string> = {
    active: 'Active',
    suspended: 'Suspended',
    inactive: 'Inactive',
    pending_verification: 'Pending Verification',
  };

  const color = statusColors[data.status] || '#6b7280';
  const label = statusLabels[data.status] || data.status;

  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Your PawTag account status has been updated.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;">
      <tr>
        <td style="background-color:${color};border-radius:8px;padding:12px 32px;">
          <span style="color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${label}</span>
        </td>
      </tr>
    </table>

    ${data.reason ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;">${data.reason}</p>
          </td>
        </tr>
      </table>
    ` : ''}

    <p style="margin:20px 0 0;color:#6b7280;font-size:14px;line-height:1.5;">
      If you believe this is an error, please contact
      <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>.
    </p>
  `;

  return renderBase({
    title: 'Account Status Update',
    subtitle: 'PawTag account notification',
    preheader: `Your PawTag account status has been updated to ${label}.`,
    bodyHtml,
  });
}
