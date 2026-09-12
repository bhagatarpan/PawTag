import { renderBase, renderInfoBox, renderCtaButton } from './base';

interface CancellationEmailData {
  name: string;
  planName: string;
  cancelledAt: string;
  currentPeriodEnd: string;
}

export function renderCancellationEmail(data: CancellationEmailData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi <strong>${data.name}</strong>,</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your <strong>${data.planName}</strong> subscription has been successfully cancelled.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;line-height:1.6;margin:0;">
        <strong>What happens next:</strong><br>
        Your subscription will remain active until <strong>${data.currentPeriodEnd}</strong>.<br>
        You will continue to enjoy your current benefits until then.<br>
        No further charges will be made after this date.
      </p>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      We're sorry to see you go. If you change your mind, you can resubscribe at any time from your account settings.
    </p>

    <p style="color:#6b7280;font-size:13px;margin:0;">
      Cancellation date: ${data.cancelledAt}<br>
      Benefits until: ${data.currentPeriodEnd}
    </p>
  `;

  return renderBase({
    title: 'Subscription Cancelled',
    subtitle: `${data.planName} — Confirmation`,
    bodyHtml,
  });
}
