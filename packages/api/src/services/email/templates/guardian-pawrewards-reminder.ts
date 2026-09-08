import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface PawRewardsReminderEmailData {
  customerName: string;
  balance: number;
  expirationDate: string;
  expirationAmount: number;
  redeemUrl: string;
}

export function renderPawRewardsReminderEmail(data: PawRewardsReminderEmailData): string {
  const { customerName, balance, expirationDate, expirationAmount, redeemUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      This is a friendly reminder that some of your PawRewards are expiring soon.
    </p>
    ${renderInfoBox(`
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;">Expiring Amount</td>
          <td style="padding:8px 0;color:#f59e0b;font-weight:600;text-align:right;">$${expirationAmount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Expires On</td>
          <td style="padding:8px 0;color:#111827;font-weight:600;text-align:right;border-top:1px solid #e5e7eb;">${new Date(expirationDate).toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Current Balance</td>
          <td style="padding:8px 0;color:#10b981;font-weight:600;text-align:right;border-top:1px solid #e5e7eb;">$${balance.toFixed(2)}</td>
        </tr>
      </table>
    `)}
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Use your PawRewards before they expire! You can redeem them on any purchase.
    </p>
    ${renderCtaButton(redeemUrl, 'Use Rewards Now')}
  `;

  return renderBase({
    title: 'PawRewards Expiring Soon',
    subtitle: "Don't let your rewards go to waste",
    bodyHtml,
  });
}
