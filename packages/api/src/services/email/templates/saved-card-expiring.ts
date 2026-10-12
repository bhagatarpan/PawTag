import { renderBase, renderCtaButton, renderInfoBox } from './base';

interface SavedCardExpiringEmailData {
  customerName: string;
  cardBrand: string;
  cardLast4: string;
  /** Human-readable expiry, e.g. "November 2026". */
  expiryLabel: string;
  updatePaymentUrl: string;
  /** True when this card is the billing card for an active membership. */
  membershipAffected?: boolean;
  membershipRenewalDate?: string;
}

export function renderSavedCardExpiringEmail(data: SavedCardExpiringEmailData): string {
  const { customerName, cardBrand, cardLast4, expiryLabel, updatePaymentUrl, membershipAffected, membershipRenewalDate } = data;

  const membershipNote = membershipAffected
    ? `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      This card is also used for your <strong>PawTag membership</strong>${membershipRenewalDate ? `, which renews on ${membershipRenewalDate}` : ''}.
      If the card has expired by then, your renewal payment may fail. Your membership and benefits stay active — updating your card keeps renewals running smoothly.
    </p>`
    : '';

  const bodyHtml = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Hi ${customerName},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your saved ${cardBrand} card ending in <strong>${cardLast4}</strong> is due to expire soon.
    </p>

    ${renderInfoBox(`
      <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Card:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${cardBrand} ••••${cardLast4}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Expires:</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${expiryLabel}</td>
        </tr>
      </table>
    `)}

    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      To avoid interruptions to future purchases or membership payments, please update your payment details before the card expires.
    </p>

    ${membershipNote}

    ${renderCtaButton(updatePaymentUrl, 'Update Payment Method')}
  `;

  return renderBase({
    title: 'Your saved payment card is expiring soon',
    subtitle: `${cardBrand} ••••${cardLast4} — Expires ${expiryLabel}`,
    theme: 'warning',
    bodyHtml,
  });
}
