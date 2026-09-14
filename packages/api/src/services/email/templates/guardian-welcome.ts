import { renderBase, renderCtaButton, renderInfoBox, renderDataTable, renderDivider } from './base';

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

  const pointsTable = renderDataTable([
    { label: 'Every $1 spent', value: `${pointsPerDollar} point${pointsPerDollar === '1' ? '' : 's'}` },
    { label: 'Text review', value: `${reviewTextPoints} points` },
    { label: 'Photo review', value: `${reviewPhotoPoints} points` },
    { label: 'Video review', value: `${reviewVideoPoints} points` },
    { label: 'Refer a friend (signup)', value: `${referralSignupPoints} points` },
    { label: 'Refer a friend (purchase)', value: `${referralPurchasePoints} points` },
    { label: 'Complete pet profile', value: `${petProfilePoints} points` },
    { label: 'Activate a tag', value: `${tagActivationPoints} points` },
  ]);

  const tierTable = renderDataTable([
    { label: 'Care (0 pts)', value: `$${pawRewardsCare}/month PawRewards` },
    { label: `Nurture (${tierThresholdNurture} pts)`, value: `$${pawRewardsNurture}/month PawRewards` },
    { label: `Protector (${tierThresholdProtector} pts)`, value: `$${pawRewardsProtector}/month PawRewards` },
    { label: `Safeguard (${tierThresholdSafeguard} pts)`, value: `$${pawRewardsSafeguard}/month PawRewards` },
  ]);

  const comparisonTable = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:separate;margin:20px 0;">
      <tr style="background-color:#f9fafb;">
        <td style="font-weight:600;color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;">Feature</td>
        <td style="font-weight:600;color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">Guardian</td>
        <td style="font-weight:600;color:#92400e;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">Gold</td>
      </tr>
      <tr>
        <td style="color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;">Points on purchases</td>
        <td style="color:#6b7280;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">1×</td>
        <td style="color:#92400e;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">2×</td>
      </tr>
      <tr>
        <td style="color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;">Starting tier</td>
        <td style="color:#6b7280;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">Care</td>
        <td style="color:#92400e;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">Nurture</td>
      </tr>
      <tr>
        <td style="color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;">Monthly PawRewards</td>
        <td style="color:#6b7280;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">$${pawRewardsCare}/mo</td>
        <td style="color:#92400e;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">$${pawRewardsNurture}/mo</td>
      </tr>
      <tr>
        <td style="color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;">Free shipping threshold</td>
        <td style="color:#6b7280;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">$100</td>
        <td style="color:#92400e;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">$50</td>
      </tr>
      <tr>
        <td style="color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;">Early access</td>
        <td style="color:#6b7280;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;">—</td>
        <td style="color:#92400e;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">✓</td>
      </tr>
      <tr>
        <td style="color:#374151;font-size:13px;padding:12px 16px;">Priority support</td>
        <td style="color:#6b7280;font-size:13px;padding:12px 16px;text-align:center;">—</td>
        <td style="color:#92400e;font-size:13px;padding:12px 16px;text-align:center;font-weight:600;">✓</td>
      </tr>
    </table>`;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Welcome to <strong>Guardian</strong> — your pet safety journey just got rewarding!
    </p>
    ${renderInfoBox(`
      <p style="color:#0d9488;font-size:13px;font-weight:600;margin:0 0 4px;">Your Starting Points</p>
      <p style="color:#111827;font-size:24px;font-weight:700;margin:0;">${points}</p>
      <p style="color:#6b7280;font-size:12px;margin:4px 0 0;">Tier: ${tier}</p>
    `)}
    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Every purchase, review, and engagement earns you points that unlock real rewards.
    </p>

    ${renderDivider()}

    <p style="color:#111827;font-size:16px;font-weight:600;margin:0 0 12px;">How You Earn Points</p>
    ${pointsTable}

    ${renderDivider()}

    <p style="color:#111827;font-size:16px;font-weight:600;margin:0 0 12px;">Your Path to Better Rewards</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
      As you earn points, you unlock higher tiers with better monthly PawRewards:
    </p>
    ${tierTable}
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
      PawRewards are store credit you can spend on any purchase. The higher your tier, the more you earn every month.
    </p>

    ${renderDivider()}

    <p style="color:#111827;font-size:16px;font-weight:600;margin:0 0 12px;">Go Gold — Get 2× the Rewards</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px;">
      Want even more? Gold members get double points on every purchase, plus exclusive benefits:
    </p>
    ${comparisonTable}
    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 4px;">Gold Membership</p>
      <p style="color:#374151;font-size:13px;margin:0;">Just $${goldPrice}/month — less than a coffee.</p>
    `, 'warning')}
    ${renderCtaButton(goldLandingUrl, 'Learn About Gold', 'warning')}

    ${renderDivider()}

    ${renderCtaButton(dashboardUrl, 'View Your Dashboard')}

    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Questions? Reply to this email or visit our help center.
    </p>
    <p style="color:#374151;font-size:14px;margin-top:16px;">
      Welcome to the pack!<br>
      <strong>The PawTag Team</strong>
    </p>
  `;

  return renderBase({
    title: 'Welcome to Guardian',
    subtitle: 'Your loyalty journey begins',
    bodyHtml,
  });
}
