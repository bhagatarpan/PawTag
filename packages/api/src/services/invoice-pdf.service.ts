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
// Palette additions — mirror the HTML invoice tones exactly so both
// formats agree. Keep in sync with finance/invoice-document-html.ts CSS.
const HEADER_GRAD_FROM = rgb(0.051, 0.58, 0.533); // #0d9488
const HEADER_GRAD_TO = rgb(0.059, 0.463, 0.431); // #0f766e
const TABLE_HEAD_BG = rgb(0.953, 0.957, 0.965); // #f3f4f6 — item-table header band
const TOTAL_BAND_BG = rgb(0.941, 0.992, 0.98); // #f0fdfa — total-row band
const ROW_LINE = rgb(0.953, 0.957, 0.965); // #f3f4f6 — item row separator

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

  /* ---- Header band (teal gradient, mirrors .invoice-header) ---- */
  const headerH = 150; // ~40px padding top/bottom like the HTML's padding:40px
  const headerTop = 842;
  // pdf-lib has no gradient primitive; approximate the HTML's
  // `linear-gradient(135deg, #0d9488, #0f766e)` with a vertical two-stop
  // gradient rendered as thin strips. Visually indistinguishable at this size.
  const strips = 40;
  const stripH = headerH / strips;
  for (let i = 0; i < strips; i++) {
    const t = i / (strips - 1);
    const r = HEADER_GRAD_FROM.red + (HEADER_GRAD_TO.red - HEADER_GRAD_FROM.red) * t;
    const g = HEADER_GRAD_FROM.green + (HEADER_GRAD_TO.green - HEADER_GRAD_FROM.green) * t;
    const b = HEADER_GRAD_FROM.blue + (HEADER_GRAD_TO.blue - HEADER_GRAD_FROM.blue) * t;
    page.drawRectangle({ x: 0, y: headerTop - (i + 1) * stripH, width: W, height: stripH + 0.5, color: rgb(r, g, b) });
  }

  // Company block (left) — HTML: h1 28px, then 13px lines
  const companyX = M;
  let y = headerTop - 52;
  page.drawText(sanitize(model.company.name), { x: companyX, y, size: 24, font: bold, color: WHITE });
  y -= 22;
  const companyLines = [
    model.company.address,
    model.company.phone,
    model.company.email,
    model.company.gst ? `GST: ${model.company.gst}` : '',
  ].filter(Boolean);
  for (const line of companyLines) {
    page.drawText(sanitize(line), { x: companyX, y, size: 10, font, color: WHITE });
    y -= 15;
  }

  // Document title (right) — HTML: h2 36px/letter-spacing 2, number 16px
  const invLabel = model.title;
  const invLabelSize = 32;
  const invLabelWidth = bold.widthOfTextAtSize(sanitize(invLabel), invLabelSize);
  page.drawText(sanitize(invLabel), { x: W - M - invLabelWidth, y: headerTop - 56, size: invLabelSize, font: bold, color: WHITE });
  const numberWidth = bold.widthOfTextAtSize(sanitize(model.number), 15);
  page.drawText(sanitize(model.number), { x: W - M - numberWidth, y: headerTop - 78, size: 15, font: bold, color: WHITE });

  // Status badge — HTML .status-badge is a pill (border-radius 20px)
  const status = String(model.status || '').toUpperCase();
  const badgeColor = status === 'PAID' || status === 'ISSUED' ? GREEN : status === 'REFUNDED' || status === 'VOID' || status === 'REPLACED' ? GRAY : TEAL_DARK;
  const statusTextWidth = bold.widthOfTextAtSize(sanitize(status), 10);
  const badgeW = statusTextWidth + 28; // ~14px horizontal padding each side
  const badgeX = W - M - badgeW;
  const badgeY = headerTop - 112;
  page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: 22, color: badgeColor });
  page.drawText(sanitize(status), { x: badgeX + 14, y: badgeY + 7, size: 10, font: bold, color: WHITE });

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
  // Named column anchors shared by the header + item rows so QTY/amount
  // can never drift apart between the two.
  const qtyColX = 365;
  const amountRightX = W - M - 8; // right-aligned amounts sit 8px inside the margin

  const drawTableHeader = (yy: number) => {
    page.drawRectangle({ x: M, y: yy - 4, width: W - 2 * M, height: 24, color: TABLE_HEAD_BG });
    drawLabel('ITEM', M + 16, yy + 3);
    drawLabel('QTY', qtyColX, yy + 3);
    const amountLabel = 'AMOUNT';
    const amtW = bold.widthOfTextAtSize(amountLabel, 8);
    drawLabel(amountLabel, amountRightX - amtW, yy + 3);
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
    const mainY = drawWrapped(item.name, M + 16, tableY, 300, bold, INK, 10);
    let itemY = mainY;
    for (const subtitle of item.subtitles) {
      page.drawText(sanitize(subtitle), { x: M + 16, y: itemY, size: 8, font, color: TEAL_DARK });
      itemY -= 12;
    }
    page.drawText(String(item.quantity), { x: qtyColX, y: tableY, size: 10, font, color: INK });
    const amountStr = item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : '';
    const amountW = font.widthOfTextAtSize(sanitize(amountStr), 10);
    page.drawText(sanitize(amountStr), { x: amountRightX - amountW, y: tableY, size: 10, font, color: INK });
    page.drawLine({ start: { x: M, y: tableY - 12 }, end: { x: W - M, y: tableY - 12 }, thickness: 0.5, color: ROW_LINE });
    tableY -= rowH;
  }

  /* ---- Totals ---- */
  let totalsY = tableY - 8;
  const totalsLabelX = 330;
  const drawTotalsRow = (label: string, value: string, opts?: { valueColor?: ReturnType<typeof rgb>; bold?: boolean }) => {
    const f = opts?.bold ? bold : font;
    const c = opts?.valueColor || (opts?.bold ? INK : GRAY);
    page.drawText(sanitize(label), { x: totalsLabelX, y: totalsY, size: opts?.bold ? 13 : 10, font: f, color: opts?.bold ? INK : GRAY });
    const vw = f.widthOfTextAtSize(sanitize(value), opts?.bold ? 13 : 10);
    page.drawText(sanitize(value), { x: W - M - vw, y: totalsY, size: opts?.bold ? 13 : 10, font: f, color: c });
    totalsY -= opts?.bold ? 26 : 18;
  };

  if (model.totals?.subtotal != null) drawTotalsRow('Subtotal', `$${model.totals.subtotal.toFixed(2)}`);
  if (model.totals?.discount != null && model.totals.discount > 0) {
    drawTotalsRow(`Discount${model.totals.discountReason ? ` (${model.totals.discountReason})` : ''}`, `-$${model.totals.discount.toFixed(2)}`, { valueColor: GREEN });
  }
  if (model.totals?.shipping != null) drawTotalsRow('Shipping', model.totals.shipping === 0 ? 'Free' : `$${model.totals.shipping.toFixed(2)}`);
  if (model.totals?.tax != null && model.totals.tax > 0) {
    drawTotalsRow(model.totals.taxLabel || 'GST', `$${model.totals.tax.toFixed(2)}`);
  }

  // Total band — HTML `.total-row`: mint background #f0fdfa + 2px teal top
  // rule. The band starts BELOW the last totals row (totalsY already sits
  // beneath the final row after drawTotalsRow decrements it), so nothing is
  // clipped. Draw band, then the teal rule at its top edge, then the text.
  const bandH = 40;
  const bandTop = totalsY + 6; // small gap below the last totals row
  page.drawRectangle({ x: M, y: bandTop - bandH, width: W - 2 * M, height: bandH, color: TOTAL_BAND_BG });
  page.drawLine({ start: { x: M, y: bandTop }, end: { x: W - M, y: bandTop }, thickness: 2, color: TEAL });
  const totalLabelY = bandTop - 26;
  page.drawText(sanitize('Total (incl. GST)'), { x: totalsLabelX, y: totalLabelY, size: 13, font: bold, color: INK });
  const totalValue = fmtMoney(model.amount, model.currency);
  const totalVw = bold.widthOfTextAtSize(sanitize(totalValue), 13);
  page.drawText(sanitize(totalValue), { x: W - M - totalVw, y: totalLabelY, size: 13, font: bold, color: INK });
  totalsY = bandTop - bandH - 10;

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
