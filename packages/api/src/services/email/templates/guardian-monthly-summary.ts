interface MonthlySummaryEmailData {
  customerName: string;
  tier: string;
  pointsEarned: number;
  totalPoints: number;
  pawRewardsBalance: number;
  pawRewardsAllocated: number;
  topActivity: string;
  dashboardUrl: string;
}

export function generateMonthlySummaryEmail(data: MonthlySummaryEmailData): string {
  const { customerName, tier, pointsEarned, totalPoints, pawRewardsBalance, pawRewardsAllocated, topActivity, dashboardUrl } = data;

  const tierColors: Record<string, string> = {
    CARE: '#10b981',
    NURTURE: '#0d9488',
    PROTECTOR: '#8b5cf6',
    SAFEGUARD: '#f59e0b',
  };

  const color = tierColors[tier] || '#10b981';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${color}, ${color}dd); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">Your Monthly Summary</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${customerName},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          Here's your Guardian activity summary for this month. As a <strong>${tier}</strong> Guardian, you've been earning points and rewards!
        </p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Points Earned</p>
            <p style="color: ${color}; font-size: 24px; font-weight: 600; margin: 0;">+${pointsEarned}</p>
          </div>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Total Points</p>
            <p style="color: #111827; font-size: 24px; font-weight: 600; margin: 0;">${totalPoints}</p>
          </div>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">PawRewards Allocated</p>
            <p style="color: #10b981; font-size: 24px; font-weight: 600; margin: 0;">+$${pawRewardsAllocated.toFixed(2)}</p>
          </div>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Rewards Balance</p>
            <p style="color: #10b981; font-size: 24px; font-weight: 600; margin: 0;">$${pawRewardsBalance.toFixed(2)}</p>
          </div>
        </div>

        ${topActivity ? `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Top Activity</p>
          <p style="color: #111827; font-size: 16px; font-weight: 500; margin: 0;">${topActivity}</p>
        </div>
        ` : ''}

        <a href="${dashboardUrl}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Full Dashboard</a>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>
  `;
}
