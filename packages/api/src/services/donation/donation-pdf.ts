/**
 * Donation receipt PDF generator (server-only).
 * Uses pdf-lib (pure JS). Neutral wording from receipt record/settings.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateDonationReceiptPdf(receipt: {
  receiptNumber: string;
  organisationName: string;
  donorNameSnapshot?: string;
  amountCents: number;
  currency?: string;
  statement?: string;
  taxClassification?: string;
  irdNumber?: string;
  charitiesNumber?: string;
  signatory?: string;
  issuedAt?: Date | string;
  status?: string;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const currency = (receipt.currency || 'NZD').toUpperCase();
  const amount = (receipt.amountCents / 100).toFixed(2);
  const issued = receipt.issuedAt ? new Date(receipt.issuedAt) : new Date();
  const donor = receipt.donorNameSnapshot || 'Supporter';
  const statement = receipt.statement || 'Thank you for your donation to PawTag.';
  const taxNote =
    receipt.taxClassification === 'neutral' || !receipt.taxClassification
      ? 'This is a donation payment receipt. Tax treatment, if any, depends on your circumstances and applicable law.'
      : `Tax classification (configured): ${receipt.taxClassification}`;

  let y = 780;
  page.drawText(receipt.organisationName || 'PawTag', { x: 50, y, size: 20, font: bold, color: rgb(0.05, 0.05, 0.05) });
  y -= 28;
  page.drawText('Donation receipt', { x: 50, y, size: 12, font, color: rgb(0.35, 0.35, 0.35) });
  y -= 28;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 22;

  const rows: Array<[string, string]> = [
    ['Receipt number', receipt.receiptNumber],
    ['Issued', issued.toLocaleString('en-NZ')],
    ['Donor', donor],
    ['Amount', `${currency} $${amount}`],
    ['Statement', statement],
  ];
  if (receipt.irdNumber) rows.push(['IRD number', receipt.irdNumber]);
  if (receipt.charitiesNumber) rows.push(['Charities number', receipt.charitiesNumber]);
  rows.push(['Status', receipt.status || 'issued']);

  const maxChars = 65;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 50, y, size: 11, font: bold, color: rgb(0.25, 0.25, 0.25) });
    const text = String(value);
    if (text.length <= maxChars) {
      page.drawText(text, { x: 180, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 20;
    } else {
      let rest = text;
      while (rest.length > 0) {
        const chunk = rest.slice(0, maxChars);
        rest = rest.slice(maxChars);
        page.drawText(chunk, { x: 180, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 16;
      }
      y -= 4;
    }
  }

  y -= 8;
  page.drawText(taxNote, { x: 50, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
  if (receipt.signatory) {
    y -= 18;
    page.drawText(`Authorised by: ${receipt.signatory}`, { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
