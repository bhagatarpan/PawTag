import { renderBase, renderCtaButton, renderInfoBox } from './base';

export function renderPasswordResetEmail(data: { name: string; resetUrl: string }): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      We received a request to reset your password. Click the button below to choose a new one.
    </p>

    ${renderCtaButton(data.resetUrl, 'Reset Password')}

    ${renderInfoBox(`
      <p style="margin:0;color:#0f766e;font-size:14px;line-height:1.5;">
        <strong>This link expires in 1 hour.</strong><br>
        If you didn't request a password reset, ignore this email. Your password will not change.
      </p>
    `)}
  `;

  return renderBase({
    title: 'Reset your password',
    subtitle: 'Password reset request',
    preheader: `Reset your PawTag password. Link expires in 1 hour.`,
    bodyHtml,
  });
}
