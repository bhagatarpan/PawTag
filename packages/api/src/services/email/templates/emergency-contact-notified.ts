import { renderBase, renderInfoBox } from './base';

interface EmergencyContactNotifiedEmailData {
  contactName: string;
  petName: string;
  ownerName: string;
  finderLocation: string;
}

export function renderEmergencyContactNotifiedEmail(data: EmergencyContactNotifiedEmailData): string {
  const { contactName, petName, ownerName, finderLocation } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${contactName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      <strong>${ownerName}</strong>'s pet <strong>${petName}</strong> has been found, but we couldn't reach ${ownerName}.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px;">Emergency Contact Notification</p>
      <p style="color:#92400e;font-size:13px;margin:0;">
        A finder has located ${petName} at ${finderLocation}. Please help us reach ${ownerName} or contact the finder directly.
      </p>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      If you cannot reach ${ownerName} within 30 minutes, PawTag staff will be notified to assist.
    </p>
  `;

  return renderBase({
    title: 'Emergency Contact — Pet Found',
    subtitle: `${petName} Has Been Found`,
    theme: 'warning',
    bodyHtml,
  });
}
