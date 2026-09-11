import { renderBase, renderCtaButton } from './base';

interface ReferralRewardData {
  referrerName: string;
  rewardMonths: number;
}

export function renderReferralRewardEmail(data: ReferralRewardData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.referrerName},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Great news! Your friend has signed up for PawTag using your referral.
    </p>
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#15803d;font-size:24px;font-weight:700;margin:0;">+${data.rewardMonths} Month${data.rewardMonths !== 1 ? 's' : ''}</p>
      <p style="color:#166534;font-size:14px;margin:4px 0 0;">Free subscription added to your account</p>
    </div>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Thank you for spreading the word about PawTag. Every referral helps more pets stay safe.
    </p>
  `;

  return renderBase({
    title: 'You Earned a Referral Reward!',
    subtitle: 'Thank you for spreading the word',
    bodyHtml,
    theme: 'success',
  });
}
