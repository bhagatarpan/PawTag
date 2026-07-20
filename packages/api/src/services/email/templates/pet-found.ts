import { renderBase, renderCtaButton, renderInfoBox } from './base';

export function renderPetFoundEmail(data: {
  ownerName: string;
  petName: string;
  finderMessage?: string;
  finderContact?: string;
  scanLocation?: string;
  viewDetailsUrl: string;
}): string {
  const bodyHtml = `
    <p style="margin:0 0 20px;color:#374151;font-size:16px;">Hi <strong>${data.ownerName}</strong>,</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;background:linear-gradient(135deg,#f0fdfa,#ecfdf5);border-radius:8px;border:1px solid #ccfbf1;">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:28px;">&#127881;</p>
          <p style="margin:0;color:#0f766e;font-size:18px;font-weight:700;">Someone found ${data.petName}!</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
      Someone scanned ${data.petName}'s tag and wants to help reunite you.
    </p>

    ${data.finderMessage ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Finder's message</p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;font-style:italic;">"${data.finderMessage}"</p>
          </td>
        </tr>
      </table>
    ` : ''}

    ${data.finderContact ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Finder's contact</p>
            <p style="margin:0;color:#374151;font-size:14px;font-weight:600;">${data.finderContact}</p>
          </td>
        </tr>
      </table>
    ` : ''}

    ${renderCtaButton(data.viewDetailsUrl, 'View Details')}

    ${renderInfoBox(`
      <p style="margin:0;color:#0f766e;font-size:14px;line-height:1.5;">
        <strong>Time is critical.</strong> Reach out to the finder as soon as possible to arrange a reunion.
      </p>
    `)}
  `;

  return renderBase({
    title: `Someone found ${data.petName}`,
    subtitle: 'Lost pet alert',
    preheader: `Great news! Someone found ${data.petName} and wants to help reunite you.`,
    bodyHtml,
  });
}
