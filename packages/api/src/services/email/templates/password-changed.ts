import { renderBase, renderInfoBox } from './base';

export function renderPasswordChangedEmail(data: { name: string; changedBy: string; ipAddress?: string }): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Your PawTag password has been successfully changed${data.changedBy === 'self' ? '' : ' by an administrator'}.
    </p>

    ${renderInfoBox(`
      <p style="margin:0;color:#0f766e;font-size:14px;line-height:1.5;">
        <strong>Changed by:</strong> ${data.changedBy === 'self' ? 'You' : data.changedBy}<br>
        ${data.ipAddress ? `<strong>IP Address:</strong> ${data.ipAddress}<br>` : ''}
        <strong>Time:</strong> ${new Date().toLocaleString('en-NZ', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
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
