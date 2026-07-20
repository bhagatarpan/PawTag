import { renderBase, renderCtaButton } from './base';

export function renderWelcomeEmail(data: { name: string; accountUrl: string }): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      Your account has been verified and is now active! Welcome to the PawTag community.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;">
      <tr>
        <td style="padding:12px 16px;background-color:#f0fdfa;border-radius:8px;border-left:3px solid #0d9488;">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">
            You can now <strong>register your pets</strong>, <strong>order QR-coded recovery tags</strong>,
            and get <strong>notified when someone finds your pet</strong>.
          </p>
        </td>
      </tr>
    </table>

    ${renderCtaButton(data.accountUrl, 'Go to My Account')}

    <p style="margin:24px 0 0;color:#6b7280;font-size:14px;line-height:1.5;">
      Need help? Contact us at <a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;">support@pawtag.co.nz</a>
    </p>
  `;

  return renderBase({
    title: 'Welcome to PawTag!',
    subtitle: 'Your account is ready',
    preheader: `Your PawTag account is verified and active. Start protecting your pets today.`,
    bodyHtml,
  });
}
