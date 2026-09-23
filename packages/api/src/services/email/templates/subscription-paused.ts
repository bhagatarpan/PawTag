import { renderBase, renderInfoBox, renderCtaButton } from './base';

interface SubscriptionPausedData {
  name: string;
  planName: string;
  reason: string;
  reasonDetails?: string;
  pausedAt: string;
  activeUntil?: string;
  resumeUrl: string;
}

export function renderSubscriptionPausedEmail(data: SubscriptionPausedData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi <strong>${data.name}</strong>,</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your <strong>${data.planName}</strong> subscription auto-renewal has been paused.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;line-height:1.6;margin:0;">
        <strong>Reason:</strong> ${data.reason}<br>
        ${data.reasonDetails ? `<strong>Details:</strong> ${data.reasonDetails}<br>` : ''}
        <strong>Paused on:</strong> ${data.pausedAt}
        ${data.activeUntil ? `<br><strong>Active until:</strong> ${data.activeUntil}` : ''}
      </p>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${data.activeUntil
        ? `Your subscription remains active until <strong>${data.activeUntil}</strong>. You can resume auto-renewal at any time from your account.`
        : 'Your subscription remains active until the end of the current billing period. You can resume auto-renewal at any time from your account.'
      }
    </p>

    ${renderCtaButton(data.resumeUrl, 'Resume Auto-Renewal')}
  `;

  return renderBase({
    title: 'Auto-Renewal Paused',
    subtitle: `${data.planName} — Subscription Update`,
    bodyHtml,
  });
}
