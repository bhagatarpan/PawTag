interface GuardianWelcomeEmailData {
  customerName: string;
  tier: string;
  points: number;
  dashboardUrl: string;
}

export function generateGuardianWelcomeEmail(data: GuardianWelcomeEmailData): string {
  const { customerName, tier, points, dashboardUrl } = data;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">Welcome to Guardian</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${customerName},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          Welcome to the PawTag Guardian program! You've started your journey as a <strong>${tier}</strong> Guardian.
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Your Starting Points</p>
          <p style="color: #10b981; font-size: 24px; font-weight: 600; margin: 0;">${points}</p>
        </div>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          As a Guardian, you'll earn points for every purchase, review, and referral. The more points you earn, the higher your tier and the better your rewards!
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Your Dashboard</a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Start earning points by making purchases, writing reviews, or referring friends.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>
  `;
}
