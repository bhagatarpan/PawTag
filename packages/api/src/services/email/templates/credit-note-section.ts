import { escapeHtml } from '../../finance/invoice-document-html';

/**
 * Shared "credit note generated" block for refund-related fallback emails.
 *
 * The same content ships in the seeded CMS templates (mustache conditional),
 * so CMS-rendered and fallback bodies stay visually consistent. Renders
 * nothing when no credit note number is provided (e.g. cancellations of
 * unpaid orders, failed refunds).
 *
 * The credit-note PDF is also attached to the email at the send layer — this
 * block is the in-body pointer for customers who prefer the portal copy.
 */
export function renderCreditNoteSection(creditNoteNumber?: string, creditNoteUrl?: string): string {
  if (!creditNoteNumber) return '';
  const number = escapeHtml(creditNoteNumber);
  const link = creditNoteUrl
    ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(creditNoteUrl)}" style="color:#2563eb;text-decoration:none;font-weight:600;">View Credit Note →</a></p>`
    : '';
  return `
    <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#1e40af;font-size:14px;">
        Credit Note: ${number}
      </p>
      <p style="margin:0;color:#1e3a5f;font-size:13px;line-height:1.5;">
        A credit note has been generated for this refund. You can view or download it for your records.
      </p>
      ${link}
    </div>
  `;
}
