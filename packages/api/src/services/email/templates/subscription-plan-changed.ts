import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface PlanChangedEmailData {
  customerName: string;
  planName: string;
  oldPlanType: 'monthly' | 'annual';
  newPlanType: 'monthly' | 'annual';
  oldPrice: number;
  newPrice: number;
  nextBillingDate: string;
  dashboardUrl: string;
}

export function renderSubscriptionPlanChangedEmail(data: PlanChangedEmailData): string {
  const { customerName, planName, oldPlanType, newPlanType, oldPrice, newPrice, nextBillingDate, dashboardUrl } = data;

  const oldLabel = oldPlanType === 'annual' ? `/yr ($${oldPrice.toFixed(2)}/yr)` : `/mo ($${oldPrice.toFixed(2)}/mo)`;
  const newLabel = newPlanType === 'annual' ? `/yr ($${newPrice.toFixed(2)}/yr)` : `/mo ($${newPrice.toFixed(2)}/mo)`;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your <strong>${planName}</strong> billing plan has been successfully changed.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Plan Change Summary</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Previous plan:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${oldPlanType}${oldLabel}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">New plan:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;color:#0d9488;">${newPlanType}${newLabel}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Next billing date:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;border-top:1px solid #e5e7eb;">${nextBillingDate}</td>
        </tr>
      </table>
    `)}

    ${renderCtaButton(dashboardUrl, 'View Your Subscription')}

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      You can manage or change your plan anytime from your account settings.
    </p>
  `;

  return renderBase({
    title: 'Plan Changed',
    subtitle: `${planName} — Billing Updated`,
    bodyHtml,
  });
}
