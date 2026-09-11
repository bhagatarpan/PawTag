import { renderBase, renderCtaButton } from './base';

interface PetAnniversaryData {
  customerName: string;
  petName: string;
  yearsOwned: number;
  pointsEarned: number;
  dashboardUrl: string;
}

export function renderPetAnniversaryEmail(data: PetAnniversaryData): string {
  const bodyHtml = `
    <div style="text-align:center;margin:0 0 24px;">
      <p style="font-size:48px;margin:0;">🎉</p>
    </div>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.customerName},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Today marks <strong>${data.yearsOwned} year${data.yearsOwned !== 1 ? 's' : ''}</strong> since you adopted <strong>${data.petName}</strong>!
    </p>
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <p style="color:#15803d;font-size:24px;font-weight:700;margin:0;">+${data.pointsEarned} Bonus Points</p>
      <p style="color:#166534;font-size:14px;margin:4px 0 0;">Anniversary bonus added to your account</p>
    </div>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Thank you for giving ${data.petName} a loving home. Here's to many more years together.
    </p>
    ${renderCtaButton(data.dashboardUrl, 'View Dashboard')}
  `;

  return renderBase({
    title: `${data.petName}'s Adoption Anniversary`,
    subtitle: 'Celebrating your journey together',
    bodyHtml,
  });
}
