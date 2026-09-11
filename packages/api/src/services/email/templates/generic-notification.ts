import { renderBase, renderCtaButton } from './base';

interface GenericNotificationData {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function renderGenericNotificationEmail(data: GenericNotificationData): string {
  const bodyHtml = `
    <h2 style="color:#374151;font-size:20px;font-weight:700;margin:0 0 16px;">${data.title}</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">${data.message}</p>
    ${data.actionUrl ? renderCtaButton(data.actionUrl, data.actionLabel || 'View Details') : ''}
  `;

  return renderBase({
    title: data.title,
    bodyHtml,
  });
}
