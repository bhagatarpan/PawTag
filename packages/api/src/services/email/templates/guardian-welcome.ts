import {
  renderBase, renderCtaButton, renderInfoBox, renderDivider,
  renderSectionHeading, renderTwoColumnGrid, renderTierProgression,
  renderBenefitsList, renderCard, TIER_COLORS,
} from './base';

interface GuardianWelcomeEmailData {
  customerName: string;
  tier: string;
  points: number;
  dashboardUrl: string;
  goldLandingUrl: string;
  pointsPerDollar: string;
  reviewTextPoints: string;
  reviewPhotoPoints: string;
  reviewVideoPoints: string;
  referralSignupPoints: string;
  referralPurchasePoints: string;
  petProfilePoints: string;
  tagActivationPoints: string;
  tierThresholdNurture: string;
  tierThresholdProtector: string;
  tierThresholdSafeguard: string;
  pawRewardsCare: string;
  pawRewardsNurture: string;
  pawRewardsProtector: string;
  pawRewardsSafeguard: string;
  goldPrice: string;
}

export function renderGuardianWelcomeEmail(data: GuardianWelcomeEmailData): string {
  const {
    customerName, tier, points, dashboardUrl, goldLandingUrl,
    pointsPerDollar, reviewTextPoints, reviewPhotoPoints, reviewVideoPoints,
    referralSignupPoints, referralPurchasePoints, petProfilePoints, tagActivationPoints,
    tierThresholdNurture, tierThresholdProtector, tierThresholdSafeguard,
    pawRewardsCare, pawRewardsNurture, pawRewardsProtector, pawRewardsSafeguard,
    goldPrice,
  } = data;

  const tierColor = TIER_COLORS[tier.toUpperCase()] || '#10b981';

  // ─── B. Hero / Welcome Section ─────────────────────────────────
  const heroSection = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 8px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Your pet's safety comes first. Now your everyday PawTag activity can earn rewards too.
    </p>
    <div style="background:linear-gradient(135deg,#f0fdfa,#ccfbf1);border:1px solid #99f6e4;border-radius:12px;padding:24px;margin:0 0 24px;text-align:center;">
      <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;font-weight:600;">Welcome to PawTag Guardian</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="padding:0 16px;text-align:center;">
            <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Current Tier</p>
            <div style="background-color:${tierColor};border-radius:20px;padding:6px 16px;display:inline-block;">
              <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.5px;">${tier}</span>
            </div>
          </td>
          <td style="width:1px;background-color:#d1d5db;padding:0;"></td>
          <td style="padding:0 16px;text-align:center;">
            <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Your Points</p>
            <p style="color:#0d9488;font-size:28px;font-weight:800;margin:0;">${points}</p>
          </td>
        </tr>
      </table>
    </div>`;

  // ─── D. How You Earn Points ────────────────────────────────────
  const pointsGrid = renderTwoColumnGrid([
    { label: '$1 Spent', value: `${pointsPerDollar}`, subtext: `point${pointsPerDollar === '1' ? '' : 's'}` },
    { label: 'Text Review', value: reviewTextPoints, subtext: 'points' },
    { label: 'Photo Review', value: reviewPhotoPoints, subtext: 'points' },
    { label: 'Video Review', value: reviewVideoPoints, subtext: 'points' },
    { label: 'Refer a Friend', value: referralSignupPoints, subtext: 'points' },
    { label: 'Friend Purchases', value: referralPurchasePoints, subtext: 'points' },
    { label: 'Pet Profile', value: petProfilePoints, subtext: 'points' },
    { label: 'Activate a Tag', value: tagActivationPoints, subtext: 'points' },
  ]);

  // ─── E. Tier Progression ───────────────────────────────────────
  const tierProgression = renderTierProgression([
    { name: 'Care', threshold: 'Starting tier', rewards: `$${pawRewardsCare}`, isCurrent: tier.toUpperCase() === 'CARE' },
    { name: 'Nurture', threshold: `${tierThresholdNurture} points`, rewards: `$${pawRewardsNurture}`, isCurrent: tier.toUpperCase() === 'NURTURE' },
    { name: 'Protector', threshold: `${tierThresholdProtector} points`, rewards: `$${pawRewardsProtector}`, isCurrent: tier.toUpperCase() === 'PROTECTOR' },
    { name: 'Safeguard', threshold: `${tierThresholdSafeguard} points`, rewards: `$${pawRewardsSafeguard}`, isCurrent: tier.toUpperCase() === 'SAFEGUARD' },
  ]);

  // ─── F. PawRewards Explanation ─────────────────────────────────
  const pawRewardsCallout = `
    <div style="background-color:#f0fdfa;border-left:3px solid #0d9488;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
      <p style="color:#115e59;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Your Points Turn Into Real Value</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
        PawRewards are store credit you can use toward PawTag purchases. The higher your Guardian tier, the more you receive each month.
      </p>
    </div>`;

  // ─── G. Gold Membership ────────────────────────────────────────
  const goldBenefits = renderBenefitsList([
    '<strong>2× points</strong> on every purchase',
    `Start at <strong>Nurture</strong> tier (skip Care)`,
    `<strong>$${pawRewardsNurture}/month</strong> PawRewards`,
    'Free shipping over $50',
    'Early access to new products',
    'Priority customer support',
  ]);

  const goldSection = `
    <div style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:24px;margin:24px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;">
        <tr>
          <td>
            <p style="color:#92400e;font-size:15px;font-weight:700;margin:0;">GO GOLD</p>
            <p style="color:#b45309;font-size:12px;margin:4px 0 0;">Get 2× the rewards</p>
          </td>
          <td style="text-align:right;">
            <div style="background-color:#f59e0b;border-radius:20px;padding:6px 14px;display:inline-block;">
              <span style="color:#ffffff;font-size:12px;font-weight:700;">${goldBenefits ? 'MEMBERSHIP' : ''}</span>
            </div>
          </td>
        </tr>
      </table>
      ${goldBenefits}
      <div style="border-top:1px solid #fcd34d;margin:16px 0;padding-top:16px;">
        <p style="color:#92400e;font-size:18px;font-weight:800;margin:0;">Only $${goldPrice}/month</p>
        <p style="color:#b45309;font-size:12px;margin:4px 0 0;font-style:italic;">less than a coffee</p>
      </div>
      ${renderCtaButton(goldLandingUrl, 'Explore Gold', 'warning')}
    </div>`;

  // ─── Assemble Full Email ───────────────────────────────────────
  const bodyHtml = `
    ${heroSection}

    ${renderDivider()}

    ${renderSectionHeading('How You Earn Points')}
    ${pointsGrid}

    ${renderDivider()}

    ${renderSectionHeading('Your Path to Better Rewards')}
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">
      As you earn points, you unlock higher tiers with better monthly PawRewards:
    </p>
    ${tierProgression}

    ${renderDivider()}

    ${pawRewardsCallout}

    ${renderDivider()}

    ${goldSection}

    ${renderDivider()}

    <div style="text-align:center;margin:8px 0 24px;">
      <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 8px;">Your Guardian Dashboard</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Track your points, view your tier progress,<br>
        and manage your rewards from your personal dashboard.
      </p>
      ${renderCtaButton(dashboardUrl, 'View My Guardian Dashboard')}
    </div>

    <p style="color:#9ca3af;font-size:12px;margin:0 0 16px;text-align:center;">
      Questions? Reply to this email or visit our help center.
    </p>
    <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:8px;">
      <p style="color:#374151;font-size:14px;margin:0;text-align:center;">
        Welcome to the pack!<br>
        <strong>The PawTag Team</strong>
      </p>
    </div>
  `;

  return renderBase({
    title: 'Welcome to Guardian',
    subtitle: 'Your loyalty journey begins',
    preheader: `${customerName}, welcome to PawTag Guardian! You're starting at ${tier} tier with ${points} points.`,
    bodyHtml,
  });
}
