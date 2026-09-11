import { renderBase, renderCtaButton, renderDataTable } from './base';

interface SubscriptionWelcomeData {
  name: string;
  tagId: string;
  planName: string;
  freePeriodEndsAt: string;
  subscriptionsUrl: string;
}

export function renderSubscriptionWelcomeEmail(data: SubscriptionWelcomeData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Your PawTag subscription has been activated! Here are your details:</p>
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Plan', value: data.planName },
      { label: 'Free Period Until', value: data.freePeriodEndsAt },
    ])}
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:20px 0;">Your tag comes with <strong>12 months free</strong> subscription. After that, you'll be charged based on your plan.</p>
    ${renderCtaButton(data.subscriptionsUrl, 'View Subscription')}
  `;

  return renderBase({
    title: 'Your Subscription is Active',
    subtitle: 'Welcome to PawTag',
    bodyHtml,
  });
}
