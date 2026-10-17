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
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
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

/**
 * Draw a compact card-brand mark with pdf-lib primitives — the PDF
 * counterpart of the HTML renderer's cardBrandIcon SVGs (keep brand
 * palettes in sync with finance/invoice-document-html.ts).
 * Returns the mark's width so the caller can position the text after it.
 */
function drawCardMark(page: any, brand: string, x: number, y: number, bold: any): number {
  const b = brand.toLowerCase();
  const W = 26;
  const H = 16;
  if (b === 'visa') {
    page.drawRectangle({ x, y, width: W, height: H, color: rgb(0.102, 0.122, 0.443), borderRadius: 3 }); // #1A1F71
    page.drawText('VISA', { x: x + 4, y: y + 5, size: 7, font: bold, color: WHITE });
    return W;
  }
  if (b === 'mastercard') {
    page.drawRectangle({ x, y, width: W, height: H, color: rgb(0.145, 0.145, 0.145), borderRadius: 3 }); // #252525
    page.drawCircle({ x: x + 10, y: y + H / 2, size: 5, color: rgb(0.922, 0, 0.106) }); // #EB001B
    page.drawCircle({ x: x + 16, y: y + H / 2, size: 5, color: rgb(0.969, 0.62, 0.106) }); // #F79E1B
    return W;
  }
  if (b === 'amex' || b === 'american_express') {
    page.drawRectangle({ x, y, width: W, height: H, color: rgb(0, 0.435, 0.812), borderRadius: 3 }); // #006FCF
    page.drawText('AMEX', { x: x + 3, y: y + 5, size: 6, font: bold, color: WHITE });
    return W;
  }
  if (b === 'discover') {
    page.drawRectangle({ x, y, width: W, height: H, color: rgb(1, 0.376, 0), borderRadius: 3 }); // #FF6000
    page.drawCircle({ x: x + 19, y: y + H / 2, size: 4, color: WHITE });
    return W;
  }
  // Default: generic card chip
  page.drawRectangle({ x, y, width: W, height: H, color: rgb(0.42, 0.447, 0.502), borderRadius: 3 }); // #6B7280
  page.drawRectangle({ x: x + 3, y: y + 10, width: 20, height: 2, color: WHITE });
  page.drawRectangle({ x: x + 3, y: y + 5, width: 10, height: 2, color: WHITE });
  return W;
}

/**
 * Inter font bytes for embedding (from the versioned inter-font
 * package — no committed binaries). Loaded once; null on any failure so
 * generation falls back to Helvetica. With Inter embedded, macrons
 * (Ōtāuhou) render natively — no WinAnsi transliteration needed.
 */
let interBytes: { regular: Buffer; bold: Buffer } | null | undefined;
function loadInterFonts(): { regular: Buffer; bold: Buffer } | null {
  if (interBytes !== undefined) return interBytes;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- CJS output; require.resolve locates the package dir
    const pkgDir = path.dirname(require.resolve('inter-font/package.json'));
    const dir = path.join(pkgDir, 'ttf');
    interBytes = {
      regular: fs.readFileSync(path.join(dir, 'Inter-Regular.ttf')),
      bold: fs.readFileSync(path.join(dir, 'Inter-Bold.ttf')),
    };
  } catch {
    interBytes = null;
  }
  return interBytes;
}

/** Render an assembled document model to A4 PDF bytes. */
async function renderInvoiceDocumentPdf(model: InvoiceDocumentModel): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 portrait
  const W = page.getWidth(); // 595
  const M = 40; // page margin
  const isAdmin = model.channel === 'admin';

  // Fonts: Inter embedded when available (premium, consistent across
  // downloads, full unicode); Helvetica fallback (WinAnsi — text must
  // pass through pdfSafe).
  const inter = loadInterFonts();
  let font: any;
  let bold: any;
  let safe: (s: string) => string;
  if (inter) {
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(inter.regular);
    bold = await pdf.embedFont(inter.bold);
    safe = (s: string) => String(s ?? '');
  } else {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    safe = pdfSafe;
  }
  const sanitize = safe;

  /* ---- Header band (teal) ---- */
  const headerH = 110;
  const headerTop = 842;
  page.drawRectangle({ x: 0, y: headerTop - headerH, width: W, height: headerH, color: TEAL });

  let y = headerTop - 38;
  page.drawText(sanitize(model.company.name), { x: M, y, size: 20, font: bold, color: WHITE });
  y -= 18;
  const companyLines = [
    model.company.address,
    model.company.phone,
    model.company.email,
    model.company.gst ? `GST: ${model.company.gst}` : '',
  ].filter(Boolean);
  for (const line of companyLines) {
    page.drawText(sanitize(line), { x: M, y, size: 9, font, color: WHITE });
    y -= 13;
  }

  const invLabel = model.title;
  const invLabelWidth = bold.widthOfTextAtSize(sanitize(invLabel), 28);
  page.drawText(sanitize(invLabel), { x: W - M - invLabelWidth, y: headerTop - 40, size: 28, font: bold, color: WHITE });
  const numberWidth = bold.widthOfTextAtSize(sanitize(model.number), 13);
  page.drawText(sanitize(model.number), { x: W - M - numberWidth, y: headerTop - 58, size: 13, font: bold, color: WHITE });

  // Status badge
  const status = String(model.status || '').toUpperCase();
  const badgeColor = status === 'PAID' || status === 'ISSUED' ? GREEN : status === 'REFUNDED' || status === 'VOID' || status === 'REPLACED' ? GRAY : TEAL_DARK;
  const statusTextWidth = bold.widthOfTextAtSize(sanitize(status), 9);
  const badgeW = statusTextWidth + 20;
  const badgeX = W - M - badgeW;
  const badgeY = headerTop - 82;
  page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: 18, color: badgeColor });
  page.drawText(sanitize(status), { x: badgeX + 10, y: badgeY + 5, size: 9, font: bold, color: WHITE });

  /* ---- Meta columns ---- */
  let metaY = headerTop - headerH - 36;
  const col1 = M;
  const col2 = 235;
  const col3 = 400;

  const drawLabel = (text: string, x: number, yy: number) =>
    page.drawText(sanitize(text), { x, y: yy, size: 8, font: bold, color: GRAY });
  const drawValue = (text: string, x: number, yy: number, f = font, c = INK) =>
    page.drawText(sanitize(text), { x, y: yy, size: 10, font: f, color: c });

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
  const detailRows: Array<[string, string, string?]> = [];
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
    detailRows.push(['Card:', `•••• ${model.payment.cardLast4 || '****'}`, model.payment.cardBrand]);
  }
  if (model.payment.refundDestination) detailRows.push(['Refund to:', model.payment.refundDestination]);
  // ADMIN CHANNEL ONLY — provider identifiers never reach customer PDFs
  if (isAdmin && model.payment.stripePaymentIntentId) {
    detailRows.push(['Payment ID:', model.payment.stripePaymentIntentId]);
  }
  if (isAdmin && model.payment.stripeInvoiceId) {
    detailRows.push(['Stripe invoice:', model.payment.stripeInvoiceId]);
  }
  for (const [label, value, brand] of detailRows) {
    drawValue(label, col3, detY, bold, GRAY);
    const labelWidth = bold.widthOfTextAtSize(sanitize(label), 10);
    let valueX = col3 + labelWidth + 4;
    if (brand) {
      // Card-brand vector mark before the digits (PDF counterpart of
      // the HTML renderer's SVG icons)
      valueX += drawCardMark(page, brand, valueX, detY - 3, bold) + 4;
    }
    drawValue(value, valueX, detY);
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
    const text = sanitize(rawText);
    const words = text.split(' ');
    let line = '';
    let cursorY = yy;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        page.drawText(sanitize(line), { x, y: cursorY, size, font: f, color: c });
        cursorY -= 13;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      page.drawText(sanitize(line), { x, y: cursorY, size, font: f, color: c });
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
      page.drawText(sanitize(subtitle), { x: M + 8, y: itemY, size: 8, font, color: TEAL_DARK });
      itemY -= 12;
    }
    page.drawText(String(item.quantity), { x: 365, y: tableY, size: 10, font, color: INK });
    const amountStr = item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : '';
    const amountW = font.widthOfTextAtSize(sanitize(amountStr), 10);
    page.drawText(sanitize(amountStr), { x: W - M - amountW - 8, y: tableY, size: 10, font, color: INK });
    page.drawLine({ start: { x: M, y: tableY - 12 }, end: { x: W - M, y: tableY - 12 }, thickness: 0.5, color: rgb(0.953, 0.957, 0.965) });
    tableY -= rowH;
  }

  /* ---- Totals ---- */
  let totalsY = tableY - 8;
  const drawTotalsRow = (label: string, value: string, opts?: { valueColor?: ReturnType<typeof rgb>; bold?: boolean }) => {
    const f = opts?.bold ? bold : font;
    const c = opts?.valueColor || (opts?.bold ? INK : GRAY);
    page.drawText(sanitize(label), { x: 330, y: totalsY, size: opts?.bold ? 13 : 10, font: f, color: opts?.bold ? INK : GRAY });
    const vw = f.widthOfTextAtSize(sanitize(value), opts?.bold ? 13 : 10);
    page.drawText(sanitize(value), { x: W - M - vw, y: totalsY, size: opts?.bold ? 13 : 10, font: f, color: c });
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
  const flW = font.widthOfTextAtSize(sanitize(footerLeft), 9);
  page.drawText(sanitize(footerLeft), { x: (W - flW) / 2, y: 52, size: 9, font, color: GRAY });
  const copyright = `© ${new Date().getFullYear()} ${model.company.name}. All rights reserved.`;
  const crW = font.widthOfTextAtSize(sanitize(copyright), 9);
  page.drawText(sanitize(copyright), { x: (W - crW) / 2, y: 38, size: 9, font, color: GRAY });

  const bytes = await pdf.save();
  // pdf-lib may return a plain Uint8Array or a wrapper object depending on
  // version — normalize to a real Buffer for the download/stream layer.
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayLike<number>);
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
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
