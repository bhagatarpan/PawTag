interface TierUpgradeEmailData {
  customerName: string;
  previousTier: string;
  newTier: string;
  points: number;
  benefits: string[];
  dashboardUrl: string;
}

export function generateTierUpgradeEmail(data: TierUpgradeEmailData): string {
  const { customerName, previousTier, newTier, points, benefits, dashboardUrl } = data;

  const tierColors: Record<string, string> = {
    CARE: '#10b981',
    NURTURE: '#0d9488',
    PROTECTOR: '#8b5cf6',
    SAFEGUARD: '#f59e0b',
  };

  const color = tierColors[newTier] || '#10b981';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${color}, ${color}dd); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">Tier Upgrade!</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${customerName},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          Congratulations! You've been promoted from <strong>${previousTier}</strong> to <strong>${newTier}</strong>!
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Your Points</p>
          <p style="color: ${color}; font-size: 24px; font-weight: 600; margin: 0;">${points}</p>
        </div>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          As a ${newTier} Guardian, you now have access to these benefits:
        </p>
        <ul style="color: #374151; font-size: 14px; margin: 16px 0; padding-left: 20px;">
          ${benefits.map(benefit => `<li style="margin-bottom: 8px;">${benefit}</li>`).join('')}
        </ul>
        <a href="${dashboardUrl}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Your Dashboard</a>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>
  `;
}
