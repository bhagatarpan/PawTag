import { renderBase, renderInfoBox } from './base';

interface RecoveryConfirmedEmailData {
  customerName: string;
  petName: string;
  finderName: string;
  recoveryLocation: string;
}

export function renderRecoveryConfirmedEmail(data: RecoveryConfirmedEmailData): string {
  const { customerName, petName, finderName, recoveryLocation } = data;

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Great news! <strong>${petName}</strong> has been recovered safely.
    </p>

    ${renderInfoBox(`
      <p style="color:#0f766e;font-size:14px;font-weight:600;margin:0 0 8px;">Recovery Confirmed</p>
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Pet:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${petName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Finder:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${finderName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Location:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${recoveryLocation}</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Thank you for being a PawTag member. We're glad we could help reunite you with ${petName}.
    </p>
  `;

  return renderBase({
    title: 'Pet Recovered',
    subtitle: `${petName} Is Safe`,
    theme: 'success',
    bodyHtml,
  });
}
