import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface GuardianBirthdayEmailData {
  customerName: string;
  petName: string;
  pointsEarned: number;
  dashboardUrl: string;
}

export function renderGuardianBirthdayEmail(data: GuardianBirthdayEmailData): string {
  const { customerName, petName, pointsEarned, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Today is ${petName}'s birthday! We're celebrating by awarding you <strong>${pointsEarned} bonus points</strong>.
    </p>
    ${renderInfoBox(`
      <p style="color:#ec4899;font-size:13px;font-weight:600;margin:0 0 4px;">Birthday Bonus</p>
      <p style="color:#111827;font-size:24px;font-weight:700;margin:0;">+${pointsEarned} points</p>
    `)}
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      We hope ${petName} has a wonderful day filled with love and treats!
    </p>
    ${renderCtaButton(dashboardUrl, 'View Your Points')}
  `;

  return renderBase({
    title: `Happy Birthday ${petName}!`,
    subtitle: 'A special day deserves a special celebration',
    bodyHtml,
  });
}
