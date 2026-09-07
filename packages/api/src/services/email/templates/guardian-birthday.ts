interface GuardianBirthdayEmailData {
  customerName: string;
  petName: string;
  pointsEarned: number;
  dashboardUrl: string;
}

export function generateGuardianBirthdayEmail(data: GuardianBirthdayEmailData): string {
  const { customerName, petName, pointsEarned, dashboardUrl } = data;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ec4899, #db2777); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">Happy Birthday ${petName}!</h1>
      </div>
      <div style="background: #fdf2f8; padding: 32px; border: 1px solid #fbcfe8;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${customerName},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          🎂 Today is ${petName}'s birthday! We're celebrating by awarding you <strong>${pointsEarned} bonus points</strong>.
        </p>
        <div style="background: white; border: 1px solid #fbcfe8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Birthday Bonus</p>
          <p style="color: #ec4899; font-size: 24px; font-weight: 600; margin: 0;">+${pointsEarned} points</p>
        </div>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          We hope ${petName} has a wonderful day filled with love and treats!
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; background: #ec4899; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Your Points</a>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>
  `;
}
