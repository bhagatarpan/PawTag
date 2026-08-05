import { renderBase } from './base';

export function renderLoginOtpEmail(data: {
  name: string;
  otp: string;
  expiresIn: string;
}): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
      We received a login request for your PawTag account. Please use the verification code below to complete your sign-in.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0;background-color:#f0fdfa;border-radius:12px;border:2px dashed #0d9488;">
      <tr>
        <td style="padding:32px;text-align:center;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Verification Code</p>
          <span style="font-size:42px;font-weight:800;letter-spacing:10px;color:#0d9488;font-family:'Courier New',monospace;">${data.otp}</span>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.5;">
      This code expires in <strong>${data.expiresIn}</strong>. If you didn't request this code, you can safely ignore this email — your account remains secure.
    </p>

    <p style="margin:0;color:#dc2626;font-size:13px;line-height:1.5;">
      <strong>Security tip:</strong> Never share this code with anyone. PawTag staff will never ask for your verification code.
    </p>
  `;

  return renderBase({
    title: 'Your Login Verification Code',
    subtitle: 'PawTag security verification',
    preheader: `Your PawTag login code: ${data.otp}. Expires in ${data.expiresIn}.`,
    bodyHtml,
  });
}
