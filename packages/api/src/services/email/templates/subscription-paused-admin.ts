import { renderBase, renderInfoBox, renderCtaButton } from './base';

interface SubscriptionPausedAdminData {
  customerName: string;
  customerEmail: string;
  planName: string;
  reason: string;
  reasonDetails?: string;
  subscriptionUrl: string;
}

export function renderSubscriptionPausedAdminEmail(data: SubscriptionPausedAdminData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      A customer has paused their subscription auto-renewal.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;line-height:1.6;margin:0;">
        <strong>Customer:</strong> ${data.customerName} (${data.customerEmail})<br>
        <strong>Plan:</strong> ${data.planName}<br>
        <strong>Reason:</strong> ${data.reason}
        ${data.reasonDetails ? `<br><strong>Details:</strong> ${data.reasonDetails}` : ''}
      </p>
    `)}

    ${renderCtaButton(data.subscriptionUrl, 'View Subscription')}
  `;

  return renderBase({
    title: 'Subscription Auto-Renew Paused',
    subtitle: 'Customer Subscription Update',
    bodyHtml,
    theme: 'warning',
  });
}
