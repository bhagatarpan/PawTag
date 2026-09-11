import { renderBase, renderOtpCode } from './base';

interface InvoiceOtpData {
  name: string;
  invoiceNumber: string;
  otp: string;
}

export function renderInvoiceOtpEmail(data: InvoiceOtpData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Your verification code for invoice <strong>${data.invoiceNumber}</strong> is:</p>
    ${renderOtpCode(data.otp, '10 minutes')}
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0;">If you didn't request this code, please ignore this email.</p>
  `;

  return renderBase({
    title: 'Invoice Access Code',
    subtitle: 'Verification required',
    bodyHtml,
  });
}
