import { renderBase, renderCtaButton, renderDataTable } from './base';

interface EmergencyEscalationData {
  ownerName: string;
  petName: string;
  tagId: string;
  finderName?: string;
  finderPhone?: string;
  finderEmail?: string;
  viewDetailsUrl: string;
}

export function renderEmergencyEscalationEmail(data: EmergencyEscalationData): string {
  const finderDetails: Array<{ label: string; value: string }> = [];
  if (data.finderName) finderDetails.push({ label: 'Finder Name', value: data.finderName });
  if (data.finderPhone) finderDetails.push({ label: 'Finder Phone', value: data.finderPhone });
  if (data.finderEmail) finderDetails.push({ label: 'Finder Email', value: data.finderEmail });

  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hello,</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      <strong>${data.ownerName}</strong> has not responded to a pet found notification for <strong>${data.petName}</strong> (${data.tagId}).
    </p>
    <div style="background-color:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="color:#991b1b;font-size:14px;font-weight:600;margin:0 0 8px;">Action Required</p>
      <p style="color:#7f1d1d;font-size:14px;margin:0;">As their emergency contact, please help reach ${data.ownerName} to let them know their pet has been found.</p>
    </div>
    ${finderDetails.length > 0 ? `
      <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#1e40af;font-size:13px;font-weight:600;margin:0 0 8px;">Finder Contact Details</p>
        ${finderDetails.map((d) => `<p style="color:#374151;font-size:14px;margin:4px 0;"><strong>${d.label}:</strong> ${d.value}</p>`).join('')}
      </div>
    ` : ''}
    ${renderCtaButton(data.viewDetailsUrl, 'View Details')}
  `;

  return renderBase({
    title: `Urgent: ${data.ownerName}'s pet ${data.petName} was found`,
    subtitle: 'Emergency Contact Notification',
    bodyHtml,
    theme: 'danger',
  });
}
