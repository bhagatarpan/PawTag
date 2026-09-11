import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface GoldWelcomeEmailData {
  customerName: string;
  price: number;
  dashboardUrl: string;
}

export function renderGoldWelcomeEmail(data: GoldWelcomeEmailData): string {
  const { customerName, price, dashboardUrl } = data;

  const benefitsList = `
    <ul style="color:#374151;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
      <li>2× points on every purchase</li>
      <li>Free shipping on orders over $50</li>
      <li>Priority customer support</li>
      <li>Early access to new products</li>
    </ul>
  `;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Welcome to <strong>PawTag Gold Membership</strong>! You're now a Gold member at <strong>$${price.toFixed(2)}/month</strong>.
    </p>
    ${renderInfoBox(`
      <p style="color:#92400e;font-size:13px;font-weight:600;margin:0 0 8px;">Your Gold Benefits</p>
      ${benefitsList}
    `)}
    ${renderCtaButton(dashboardUrl, 'View Your Dashboard')}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Your membership will automatically renew each month. You can manage or cancel anytime from your dashboard.
    </p>
  `;

  return renderBase({
    title: 'Welcome to Gold',
    subtitle: 'Your Gold membership is now active',
    bodyHtml,
  });
}
