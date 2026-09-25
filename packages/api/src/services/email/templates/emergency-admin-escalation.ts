import { renderBase, renderInfoBox } from './base';

interface EmergencyAdminEscalationEmailData {
  petName: string;
  ownerName: string;
  ownerEmail: string;
  contactName: string;
  contactPhone: string;
  finderLocation: string;
}

export function renderEmergencyAdminEscalationEmail(data: EmergencyAdminEscalationEmailData): string {
  const { petName, ownerName, ownerEmail, contactName, contactPhone, finderLocation } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Emergency escalation requires PawTag staff intervention.
    </p>

    ${renderInfoBox(`
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 8px;">Escalation Details</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Pet:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${petName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Owner:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${ownerName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Owner Email:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${ownerEmail}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Emergency Contact:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${contactName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Contact Phone:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${contactPhone}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Finder Location:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${finderLocation}</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Neither the owner nor emergency contact could be reached. Please contact the finder and coordinate the pet recovery.
    </p>
  `;

  return renderBase({
    title: 'Emergency Escalation — Staff Required',
    subtitle: `${petName} Recovery Escalation`,
    theme: 'danger',
    bodyHtml,
  });
}
