import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface GuardianWelcomeEmailData {
  customerName: string;
  tier: string;
  points: number;
  dashboardUrl: string;
}

export function renderGuardianWelcomeEmail(data: GuardianWelcomeEmailData): string {
  const { customerName, tier, points, dashboardUrl } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Welcome to the PawTag Guardian program! You've started your journey as a <strong>${tier}</strong> Guardian.
    </p>
    ${renderInfoBox(`
      <p style="color:#0d9488;font-size:13px;font-weight:600;margin:0 0 4px;">Your Starting Points</p>
      <p style="color:#111827;font-size:24px;font-weight:700;margin:0;">${points}</p>
    `)}
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      As a Guardian, you'll earn points for every purchase, review, and referral. The more points you earn, the higher your tier and the better your rewards!
    </p>
    ${renderCtaButton(dashboardUrl, 'View Your Dashboard')}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Start earning points by making purchases, writing reviews, or referring friends.
    </p>
  `;

  return renderBase({
    title: 'Welcome to Guardian',
    subtitle: 'Your loyalty journey begins',
    bodyHtml,
  });
}
