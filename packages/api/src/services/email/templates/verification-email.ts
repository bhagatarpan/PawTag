import { renderBase, renderCtaButton, renderInfoBox } from './base';

export function renderVerificationEmail(data: { name: string; verificationUrl: string }): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Welcome to PawTag! Please verify your email address to activate your account and start protecting your pets.
    </p>

    ${renderCtaButton(data.verificationUrl, 'Verify My Email')}

    ${renderInfoBox(`
      <p style="margin:0;color:#0f766e;font-size:14px;line-height:1.5;">
        <strong>This link expires in 24 hours.</strong><br>
        If you didn't create a PawTag account, you can safely ignore this email.
      </p>
    `)}
  `;

  return renderBase({
    title: 'Verify your email address',
    subtitle: 'One step closer to protecting your pet',
    preheader: `Verify your email to activate your PawTag account. Link expires in 24 hours.`,
    bodyHtml,
  });
}
