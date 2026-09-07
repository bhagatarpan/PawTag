interface PawRewardsReminderEmailData {
  customerName: string;
  balance: number;
  expirationDate: string;
  expirationAmount: number;
  redeemUrl: string;
}

export function generatePawRewardsReminderEmail(data: PawRewardsReminderEmailData): string {
  const { customerName, balance, expirationDate, expirationAmount, redeemUrl } = data;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">PawRewards Expiring Soon</h1>
      </div>
      <div style="background: #fffbeb; padding: 32px; border: 1px solid #fde68a;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${customerName},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          This is a friendly reminder that some of your PawRewards are expiring soon.
        </p>
        <div style="background: white; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Expiring Amount</p>
          <p style="color: #f59e0b; font-size: 24px; font-weight: 600; margin: 0;">$${expirationAmount.toFixed(2)}</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Expires on ${new Date(expirationDate).toLocaleDateString()}</p>
        </div>
        <div style="background: white; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Current Balance</p>
          <p style="color: #10b981; font-size: 24px; font-weight: 600; margin: 0;">$${balance.toFixed(2)}</p>
        </div>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          Use your PawRewards before they expire! You can redeem them on any purchase.
        </p>
        <a href="${redeemUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Use Rewards Now</a>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>
  `;
}
