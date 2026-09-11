import { renderBase, renderCtaButton } from './base';

interface PetBirthdayData {
  customerName: string;
  petName: string;
  pointsEarned: number;
  dashboardUrl: string;
}

export function renderPetBirthdayEmail(data: PetBirthdayData): string {
  const bodyHtml = `
    <div style="text-align:center;margin:0 0 24px;">
      <p style="font-size:48px;margin:0;">🎂</p>
    </div>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.customerName},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Today is <strong>${data.petName}</strong>'s birthday! 🎉
    </p>
    <div style="background-color:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#ec4899;font-size:24px;font-weight:700;margin:0;">+${data.pointsEarned} Bonus Points</p>
      <p style="color:#9d174d;font-size:14px;margin:4px 0 0;">Birthday bonus added to your account</p>
    </div>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Wishing ${data.petName} a wonderful year ahead. Thank you for being part of the PawTag family.
    </p>
    ${renderCtaButton(data.dashboardUrl, 'View Dashboard')}
  `;

  return renderBase({
    title: `Happy Birthday ${data.petName}!`,
    subtitle: 'A special day for a special pet',
    bodyHtml,
  });
}
