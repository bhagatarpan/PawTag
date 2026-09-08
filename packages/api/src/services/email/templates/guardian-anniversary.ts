import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface GuardianAnniversaryEmailData {
  customerName: string;
  petName: string;
  yearsOwned: number;
  pointsEarned: number;
  dashboardUrl: string;
}

export function renderGuardianAnniversaryEmail(data: GuardianAnniversaryEmailData): string {
  const { customerName, petName, yearsOwned, pointsEarned, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Today marks <strong>${yearsOwned} year${yearsOwned !== 1 ? 's' : ''}</strong> since you adopted ${petName}! What a wonderful journey it's been.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      To celebrate this special milestone, we've awarded you <strong>${pointsEarned} bonus Guardian Points</strong>.
    </p>
    ${renderInfoBox(`
      <p style="color:#0d9488;font-size:13px;font-weight:600;margin:0 0 4px;">Anniversary Bonus</p>
      <p style="color:#111827;font-size:24px;font-weight:700;margin:0;">+${pointsEarned} points</p>
    `)}
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Here's to many more years of love, tail wags, and happy memories together.
    </p>
    ${renderCtaButton(dashboardUrl, 'View Your Points')}
  `;

  return renderBase({
    title: `${petName}'s Adoption Anniversary`,
    subtitle: 'Celebrating your journey together',
    bodyHtml,
  });
}
