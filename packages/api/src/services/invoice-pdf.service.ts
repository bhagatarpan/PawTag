/**
 * Invoice PDF generator (server-only) — the shared PDF engine for ALL
 * financial documents: commerce invoices, credit notes, AND donation
 * receipts. Uses pdf-lib (pure JS — no headless browser).
 *
 * Data comes from the shared assembly layer (finance/invoice-document.ts),
 * the single source of truth for presentation — same engine as the HTML
 * viewer, so both formats always agree.
 *
 * Channel rule (founder decision): Stripe provider IDs render only for
 * the admin channel. Customer documents show the invoice/order number
 * and card brand + last4 — never `pi_`/`in_` identifiers.
 *
 * NZ place names commonly contain macrons (Ōtāuhou) that standard PDF
 * fonts cannot encode — every string passes through pdfSafe.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  assembleInvoiceDocument,
  assembleDonationReceiptDocument,
  type DocumentChannel,
  type InvoiceDocumentModel,
} from './finance/invoice-document';

const TEAL = rgb(0.051, 0.58, 0.533); // #0d9488
const TEAL_DARK = rgb(0.059, 0.463, 0.431); // #0f766e
const INK = rgb(0.122, 0.161, 0.216); // #1f2937
const GRAY = rgb(0.42, 0.447, 0.502); // #6b7280
const LIGHT_GRAY = rgb(0.898, 0.906, 0.922); // #e5e7eb
const GREEN = rgb(0.086, 0.639, 0.29); // #16a34a
const WHITE = rgb(1, 1, 1);

/**
 * Standard PDF fonts use WinAnsi encoding, which cannot represent macrons
 * and other extended Latin glyphs common in NZ place names (Ōtāuhou,
 * Tāmaki Makaurau). Transliterate the common set, then strip anything
 * still unencodable so generation never fails on real address data.
 */
function pdfSafe(text: string): string {
  const translit: Record<string, string> = {
    ā: 'a', ē: 'e', ī: 'i', ō: 'o', ū: 'u',
    Ā: 'A', Ē: 'E', Ī: 'I', Ō: 'O', Ū: 'U',
    ç: 'c', ñ: 'n', ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', å: 'a',
  };
  const mapped = String(text).replace(/[āēīōūĀĒĪŌŪçñßæœøå]/g, (ch) => translit[ch] || ch);
  return mapped.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function fmtDate(d: Date | string | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtMoney(amount: number, currency = 'NZD'): string {
  return `${currency.toUpperCase()} $${amount.toFixed(2)}`;
}

/** Render an assembled document model to A4 PDF bytes. */
async function renderInvoiceDocumentPdf(model: InvoiceDocumentModel): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = page.getWidth(); // 595
  const M = 40; // page margin
  const isAdmin = model.channel === 'admin';

  /* ---- Header band (teal) ---- */
  const headerH = 110;
  const headerTop = 842;
  page.drawRectangle({ x: 0, y: headerTop - headerH, width: W, height: headerH, color: TEAL });

  let y = headerTop - 38;
  page.drawText(pdfSafe(model.company.name), { x: M, y, size: 20, font: bold, color: WHITE });
  y -= 18;
  const companyLines = [
    model.company.address,
    model.company.phone,
    model.company.email,
    model.company.gst ? `GST: ${model.company.gst}` : '',
  ].filter(Boolean);
  for (const line of companyLines) {
    page.drawText(pdfSafe(line), { x: M, y, size: 9, font, color: WHITE });
    y -= 13;
  }

  const invLabel = model.title;
  const invLabelWidth = bold.widthOfTextAtSize(pdfSafe(invLabel), 28);
  page.drawText(pdfSafe(invLabel), { x: W - M - invLabelWidth, y: headerTop - 40, size: 28, font: bold, color: WHITE });
  const numberWidth = bold.widthOfTextAtSize(pdfSafe(model.number), 13);
  page.drawText(pdfSafe(model.number), { x: W - M - numberWidth, y: headerTop - 58, size: 13, font: bold, color: WHITE });

  // Status badge
  const status = String(model.status || '').toUpperCase();
  const badgeColor = status === 'PAID' || status === 'ISSUED' ? GREEN : status === 'REFUNDED' || status === 'VOID' || status === 'REPLACED' ? GRAY : TEAL_DARK;
  const statusTextWidth = bold.widthOfTextAtSize(pdfSafe(status), 9);
  const badgeW = statusTextWidth + 20;
  const badgeX = W - M - badgeW;
  const badgeY = headerTop - 82;
  page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: 18, color: badgeColor });
  page.drawText(pdfSafe(status), { x: badgeX + 10, y: badgeY + 5, size: 9, font: bold, color: WHITE });

  /* ---- Meta columns ---- */
  let metaY = headerTop - headerH - 36;
  const col1 = M;
  const col2 = 235;
  const col3 = 400;

  const drawLabel = (text: string, x: number, yy: number) =>
    page.drawText(pdfSafe(text), { x, y: yy, size: 8, font: bold, color: GRAY });
  const drawValue = (text: string, x: number, yy: number, f = font, c = INK) =>
    page.drawText(pdfSafe(text), { x, y: yy, size: 10, font: f, color: c });

  drawLabel(model.kind === 'donation_receipt' ? 'DONOR' : 'BILL TO', col1, metaY);
  let billY = metaY - 16;
  const billLines: string[] = [
    model.customer.name || (model.kind === 'donation_receipt' ? 'Supporter' : 'Customer'),
    model.customer.email,
    model.customer.phone,
    ...model.customer.addressLines,
  ].filter((line): line is string => Boolean(line));
  for (const line of billLines) {
    drawValue(line, col1, billY);
    billY -= 14;
  }

  drawLabel('SHIP TO', col2, metaY);
  let shipY = metaY - 16;
  if (model.shippingAddressLines?.length) {
    for (const line of model.shippingAddressLines) {
      drawValue(line, col2, shipY);
      shipY -= 14;
    }
  } else {
    drawValue('—', col2, shipY);
  }

  const detailsTitle = model.title.charAt(0) + model.title.slice(1).toLowerCase();
  drawLabel(`${detailsTitle.toUpperCase()} DETAILS`, col3, metaY);
  let detY = metaY - 16;
  const detailRows: Array<[string, string]> = [];
  if (model.orderNumber) detailRows.push(['Order:', model.orderNumber]);
  if (model.originalInvoiceNumber) detailRows.push(['Original invoice:', model.originalInvoiceNumber]);
  detailRows.push(['Date:', fmtDate(model.issuedAt)]);
  if (model.billingPeriod?.start && model.billingPeriod?.end) {
    detailRows.push(['Period:', `${fmtDate(model.billingPeriod.start)} – ${fmtDate(model.billingPeriod.end)}`]);
  }
  if (model.paidAt) detailRows.push(['Paid:', fmtDate(model.paidAt)]);
  else if (model.dueDate) detailRows.push(['Due:', fmtDate(model.dueDate)]);
  if (model.membershipTier) detailRows.push(['Membership:', model.membershipTier]);
  if (model.subscriptionPlan) detailRows.push(['Plan:', model.subscriptionPlan]);
  if (model.payment.method) detailRows.push(['Method:', model.payment.method]);
  if (model.payment.cardBrand) {
    detailRows.push(['Card:', `${model.payment.cardBrand} •••• ${model.payment.cardLast4 || '****'}`]);
  }
  if (model.payment.refundDestination) detailRows.push(['Refund to:', model.payment.refundDestination]);
  // ADMIN CHANNEL ONLY — provider identifiers never reach customer PDFs
  if (isAdmin && model.payment.stripePaymentIntentId) {
    detailRows.push(['Payment ID:', model.payment.stripePaymentIntentId]);
  }
  if (isAdmin && model.payment.stripeInvoiceId) {
    detailRows.push(['Stripe invoice:', model.payment.stripeInvoiceId]);
  }
  for (const [label, value] of detailRows) {
    drawValue(label, col3, detY, bold, GRAY);
    const labelWidth = bold.widthOfTextAtSize(pdfSafe(label), 10);
    drawValue(value, col3 + labelWidth + 4, detY);
    detY -= 14;
  }

  /* ---- Items table ---- */
  let tableY = Math.min(billY, shipY, detY) - 30;
  const tableBottomReserve = 130; // totals + notes + footer space
  const rowH = 34;

  const drawTableHeader = (yy: number) => {
    page.drawRectangle({ x: M, y: yy - 4, width: W - 2 * M, height: 22, color: rgb(0.976, 0.98, 0.984) });
    drawLabel('ITEM', M + 8, yy + 3);
    drawLabel('QTY', 365, yy + 3);
    const amountLabel = 'AMOUNT';
    const amtW = bold.widthOfTextAtSize(amountLabel, 8);
    drawLabel(amountLabel, W - M - amtW - 8, yy + 3);
    page.drawLine({ start: { x: M, y: yy - 4 }, end: { x: W - M, y: yy - 4 }, thickness: 1, color: LIGHT_GRAY });
  };

  const drawWrapped = (rawText: string, x: number, yy: number, maxWidth: number, f = font, c = INK, size = 10): number => {
    const text = pdfSafe(rawText);
    const words = text.split(' ');
    let line = '';
    let cursorY = yy;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        page.drawText(pdfSafe(line), { x, y: cursorY, size, font: f, color: c });
        cursorY -= 13;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      page.drawText(pdfSafe(line), { x, y: cursorY, size, font: f, color: c });
      cursorY -= 13;
    }
    return cursorY;
  };

  drawTableHeader(tableY);
  tableY -= rowH;

  for (const item of model.items) {
    if (tableY < tableBottomReserve + rowH) break; // single-page guard
    const mainY = drawWrapped(item.name, M + 8, tableY, 300, bold, INK, 10);
    let itemY = mainY;
    for (const subtitle of item.subtitles) {
      page.drawText(pdfSafe(subtitle), { x: M + 8, y: itemY, size: 8, font, color: TEAL_DARK });
      itemY -= 12;
    }
    page.drawText(String(item.quantity), { x: 365, y: tableY, size: 10, font, color: INK });
    const amountStr = item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : '';
    const amountW = font.widthOfTextAtSize(pdfSafe(amountStr), 10);
    page.drawText(pdfSafe(amountStr), { x: W - M - amountW - 8, y: tableY, size: 10, font, color: INK });
    page.drawLine({ start: { x: M, y: tableY - 12 }, end: { x: W - M, y: tableY - 12 }, thickness: 0.5, color: rgb(0.953, 0.957, 0.965) });
    tableY -= rowH;
  }

  /* ---- Totals ---- */
  let totalsY = tableY - 8;
  const drawTotalsRow = (label: string, value: string, opts?: { valueColor?: ReturnType<typeof rgb>; bold?: boolean }) => {
    const f = opts?.bold ? bold : font;
    const c = opts?.valueColor || (opts?.bold ? INK : GRAY);
    page.drawText(pdfSafe(label), { x: 330, y: totalsY, size: opts?.bold ? 13 : 10, font: f, color: opts?.bold ? INK : GRAY });
    const vw = f.widthOfTextAtSize(pdfSafe(value), opts?.bold ? 13 : 10);
    page.drawText(pdfSafe(value), { x: W - M - vw, y: totalsY, size: opts?.bold ? 13 : 10, font: f, color: c });
    totalsY -= opts?.bold ? 24 : 18;
  };

  if (model.totals?.subtotal != null) drawTotalsRow('Subtotal', `$${model.totals.subtotal.toFixed(2)}`);
  if (model.totals?.discount != null && model.totals.discount > 0) {
    drawTotalsRow(`Discount${model.totals.discountReason ? ` (${model.totals.discountReason})` : ''}`, `-$${model.totals.discount.toFixed(2)}`, { valueColor: GREEN });
  }
  if (model.totals?.shipping != null) drawTotalsRow('Shipping', model.totals.shipping === 0 ? 'Free' : `$${model.totals.shipping.toFixed(2)}`);
  if (model.totals?.tax != null && model.totals.tax > 0) drawTotalsRow('GST (15%)', `$${model.totals.tax.toFixed(2)}`);

  totalsY -= 4;
  page.drawLine({ start: { x: 330, y: totalsY + 14 }, end: { x: W - M, y: totalsY + 14 }, thickness: 1.5, color: TEAL });
  drawTotalsRow('Total (incl. GST)', fmtMoney(model.amount, model.currency), { bold: true });

  /* ---- Kind-specific notes (donation tax statements, signatories) ---- */
  let notesY = totalsY - 8;
  for (const note of model.notes) {
    if (notesY < 90) break;
    notesY = drawWrapped(note, M, notesY, W - 2 * M, font, rgb(0.294, 0.333, 0.388), 9) - 4;
  }

  /* ---- Footer ---- */
  page.drawLine({ start: { x: M, y: 70 }, end: { x: W - M, y: 70 }, thickness: 0.5, color: LIGHT_GRAY });
  const footerLeft = model.company.website ? `${model.company.name} | ${model.company.website}` : model.company.name;
  const flW = font.widthOfTextAtSize(pdfSafe(footerLeft), 9);
  page.drawText(pdfSafe(footerLeft), { x: (W - flW) / 2, y: 52, size: 9, font, color: GRAY });
  const copyright = `© ${new Date().getFullYear()} ${model.company.name}. All rights reserved.`;
  const crW = font.widthOfTextAtSize(pdfSafe(copyright), 9);
  page.drawText(pdfSafe(copyright), { x: (W - crW) / 2, y: 38, size: 9, font, color: GRAY });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/**
 * PDF for a commerce invoice or credit note.
 * Customer channel by default (no provider IDs); admin for CSRs.
 */
export async function generateInvoicePdf(
  invoiceId: string,
  channel: DocumentChannel = 'customer',
): Promise<{ buffer: Buffer; filename: string }> {
  const model = await assembleInvoiceDocument(invoiceId, channel);
  const buffer = await renderInvoiceDocumentPdf(model);
  return { buffer, filename: `${model.number || 'invoice'}.pdf` };
}

/**
 * PDF for a donation receipt — same engine, distinct document type.
 */
export async function generateDonationReceiptPdf(
  receipt: any,
  channel: DocumentChannel = 'customer',
): Promise<Buffer> {
  const model = await assembleDonationReceiptDocument(receipt, channel);
  return renderInvoiceDocumentPdf(model);
}
