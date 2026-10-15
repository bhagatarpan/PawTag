/**
 * Invoice PDF generator (server-only).
 *
 * Produces a real A4 PDF via pdf-lib (pure JS — no headless browser).
 * Replaces the old "Print / Save PDF" browser-print flow, which produced
 * unformatted plain PDFs. Layout mirrors the on-screen invoice: teal
 * header band, bill-to/ship-to/details columns, items table, totals
 * breakdown with GST, total row, and footer.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Invoice, Order, User, Subscription, UserMembership, MembershipTier, Setting } from '@pawtag/db';

const TEAL = rgb(0.051, 0.58, 0.533); // #0d9488
const TEAL_DARK = rgb(0.059, 0.463, 0.431); // #0f766e
const INK = rgb(0.122, 0.161, 0.216); // #1f2937
const GRAY = rgb(0.42, 0.447, 0.502); // #6b7280
const LIGHT_GRAY = rgb(0.898, 0.906, 0.922); // #e5e7eb
const GREEN = rgb(0.086, 0.639, 0.29); // #16a34a
const WHITE = rgb(1, 1, 1);

function fmtDate(d: Date | string | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

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
  // WinAnsi covers roughly Latin-1; drop anything outside printable ASCII + Latin-1
  return mapped.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function fmtMoney(amount: number, currency = 'NZD'): string {
  return `${currency.toUpperCase()} $${amount.toFixed(2)}`;
}

async function getCompanySettings(): Promise<Record<string, string>> {
  const keys = ['company.name', 'company.address', 'company.phone', 'company.email', 'company.gst', 'company.website'];
  const settings = await Setting.find({ key: { $in: keys } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return map;
}

export async function generateInvoicePdf(invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
  const invoice = await Invoice.findById(invoiceId).lean() as any;
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.type === 'credit_note') throw new Error('Use the credit note PDF path for credit notes');

  const order = invoice.orderId ? await Order.findById(invoice.orderId).lean() : null;
  const user = await User.findById(invoice.userId)
    .select('fullName email phoneNumber address')
    .lean();
  const company = await getCompanySettings();

  // Line item description for membership/subscription invoices (no order)
  let nonOrderDescription = '';
  if (!order) {
    if (invoice.userMembershipId) {
      const membership = await UserMembership.findById(invoice.userMembershipId).lean() as any;
      const tier = membership?.tierId ? await MembershipTier.findById(membership.tierId).lean() as any : null;
      const tierName = tier?.displayName || tier?.name || 'Membership';
      const interval = membership?.billingInterval === 'monthly' ? 'Monthly' : 'Annual';
      nonOrderDescription = `${tierName} Membership — ${interval}`;
    } else if (invoice.subscriptionId) {
      const subscription = await Subscription.findById(invoice.subscriptionId).lean() as any;
      nonOrderDescription = subscription?.planName || 'Subscription';
    } else {
      nonOrderDescription = 'PawTag services';
    }
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = page.getWidth(); // 595
  const M = 40; // page margin

  const companyName = company['company.name'] || 'PawTag Ltd';
  const companyAddress = company['company.address'] || '';
  const companyPhone = company['company.phone'] || '';
  const companyEmail = company['company.email'] || '';
  const companyGst = company['company.gst'] || '';
  const companyWebsite = company['company.website'] || '';

  /* ---- Header band (teal) ---- */
  const headerH = 110;
  const headerTop = 842;
  page.drawRectangle({ x: 0, y: headerTop - headerH, width: W, height: headerH, color: TEAL });

  let y = headerTop - 38;
  page.drawText(pdfSafe(companyName), { x: M, y, size: 20, font: bold, color: WHITE });
  y -= 18;
  const companyLines = [companyAddress, companyPhone, companyEmail, companyGst ? `GST: ${companyGst}` : ''].filter(Boolean);
  for (const line of companyLines) {
    page.drawText(pdfSafe(line), { x: M, y, size: 9, font, color: rgb(1, 1, 1) });
    y -= 13;
  }

  const invLabel = (invoice.type === 'invoice' ? 'INVOICE' : 'INVOICE').toUpperCase();
  const invLabelWidth = bold.widthOfTextAtSize(invLabel, 28);
  page.drawText(pdfSafe(invLabel), { x: W - M - invLabelWidth, y: headerTop - 40, size: 28, font: bold, color: WHITE });
  const numberWidth = bold.widthOfTextAtSize(pdfSafe(invoice.invoiceNumber), 13);
  page.drawText(pdfSafe(invoice.invoiceNumber), { x: W - M - numberWidth, y: headerTop - 58, size: 13, font: bold, color: WHITE });

  // Status badge (PAID etc.)
  const status = String(invoice.status || '').toUpperCase();
  const badgeColor = status === 'PAID' ? GREEN : status === 'REFUNDED' || status === 'VOID' ? GRAY : TEAL_DARK;
  const statusTextWidth = bold.widthOfTextAtSize(status, 9);
  const badgeW = statusTextWidth + 20;
  const badgeX = W - M - badgeW;
  const badgeY = headerTop - 82;
  page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: 18, color: badgeColor });
  page.drawText(pdfSafe(status), { x: badgeX + 10, y: badgeY + 5, size: 9, font: bold, color: WHITE });

  /* ---- Meta columns: BILL TO / SHIP TO / INVOICE DETAILS ---- */
  let metaY = headerTop - headerH - 36;
  const col1 = M;
  const col2 = 235;
  const col3 = 400;

  const drawLabel = (text: string, x: number, yy: number) =>
    page.drawText(pdfSafe(text), { x, y: yy, size: 8, font: bold, color: GRAY });
  const drawValue = (text: string, x: number, yy: number, f = font, c = INK) =>
    page.drawText(pdfSafe(text), { x, y: yy, size: 10, font: f, color: c });

  drawLabel('BILL TO', col1, metaY);
  let billY = metaY - 16;
  const billLines: string[] = [
    user?.fullName || '',
    user?.email || '',
    user?.phoneNumber || '',
    user?.address?.line1 || '',
    [user?.address?.city, user?.address?.zip].filter(Boolean).join(' ') || '',
  ].filter((line): line is string => Boolean(line));
  for (const line of billLines) {
    drawValue(line, col1, billY);
    billY -= 14;
  }

  drawLabel('SHIP TO', col2, metaY);
  let shipY = metaY - 16;
  if (order?.shippingAddress) {
    const a = order.shippingAddress;
    const shipLines: string[] = [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', '), [a.zip, a.country].filter(Boolean).join(' ')].filter((line): line is string => Boolean(line));
    for (const line of shipLines) {
      drawValue(line, col2, shipY);
      shipY -= 14;
    }
  } else {
    drawValue('—', col2, shipY);
  }

  drawLabel('INVOICE DETAILS', col3, metaY);
  let detY = metaY - 16;
  const detailRows: Array<[string, string]> = [];
  if (order?.orderNumber) detailRows.push(['Order:', order.orderNumber]);
  detailRows.push(['Date:', fmtDate(invoice.createdAt)]);
  if (invoice.paidAt) detailRows.push(['Paid:', fmtDate(invoice.paidAt)]);
  else if (invoice.dueDate) detailRows.push(['Due:', fmtDate(invoice.dueDate)]);
  if (invoice.paymentMethod) detailRows.push(['Method:', invoice.paymentMethod]);
  if (order?.payment?.cardBrand && order?.payment?.cardLast4) {
    detailRows.push(['Card:', `${order.payment.cardBrand} •••• ${order.payment.cardLast4}`]);
  }
  for (const [label, value] of detailRows) {
    drawValue(label, col3, detY, bold, GRAY);
    const labelWidth = bold.widthOfTextAtSize(label, 10);
    drawValue(value, col3 + labelWidth + 4, detY);
    detY -= 14;
  }

  /* ---- Items table ---- */
  let tableY = Math.min(billY, shipY, detY) - 30;
  const tableBottomReserve = 110; // totals + footer space
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

  drawTableHeader(tableY);
  tableY -= rowH;

  const drawWrapped = (rawText: string, x: number, yy: number, maxWidth: number, f = font, c = INK, size = 10): number => {
    const text = pdfSafe(rawText);
    // naive greedy wrap by measured width
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

  if (order?.items?.length) {
    for (const item of order.items) {
      // page break guard (single-page invoices are the norm; spill gracefully)
      if (tableY < tableBottomReserve + rowH) {
        // Not enough room — draw a minimal continuation is overkill for MVP
        // invoices; stop the table and let totals render.
        break;
      }
      const name = [item.productName, item.variantName].filter(Boolean).join(' — ');
      let itemY = drawWrapped(name, M + 8, tableY, 300, bold, INK, 10);
      if (item.petName) {
        page.drawText(pdfSafe(`For: ${item.petName}`), { x: M + 8, y: itemY, size: 8, font, color: TEAL_DARK });
        itemY -= 12;
      }
      const engraving = (item.customisationTexts || []).filter((t: string) => t);
      if (engraving.length) {
        for (const t of engraving) {
          page.drawText(pdfSafe(`Pet name: ${t}`), { x: M + 8, y: itemY, size: 8, font, color: TEAL_DARK });
          itemY -= 12;
        }
      }
      page.drawText(pdfSafe(String(item.quantity ?? 1)), { x: 365, y: tableY, size: 10, font, color: INK });
      const lineTotal = (item.unitPrice ?? 0) * (item.quantity ?? 1);
      const amountStr = `$${lineTotal.toFixed(2)}`;
      const amountW = font.widthOfTextAtSize(amountStr, 10);
      page.drawText(pdfSafe(amountStr), { x: W - M - amountW - 8, y: tableY, size: 10, font, color: INK });
      page.drawLine({ start: { x: M, y: tableY - 12 }, end: { x: W - M, y: tableY - 12 }, thickness: 0.5, color: rgb(0.953, 0.957, 0.965) });
      tableY -= rowH;
    }
  } else {
    // Non-order invoice: single description row
    let itemY = drawWrapped(nonOrderDescription, M + 8, tableY, 300, bold, INK, 10);
    page.drawText(pdfSafe('1'), { x: 365, y: tableY, size: 10, font, color: INK });
    const amountStr = `$${invoice.amount.toFixed(2)}`;
    const amountW = font.widthOfTextAtSize(amountStr, 10);
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
    const vw = f.widthOfTextAtSize(value, opts?.bold ? 13 : 10);
    page.drawText(pdfSafe(value), { x: W - M - vw, y: totalsY, size: opts?.bold ? 13 : 10, font: f, color: c });
    totalsY -= opts?.bold ? 24 : 18;
  };

  const currency = invoice.currency || 'NZD';
  const subtotal = order?.subtotal;
  const discount = order?.discount?.amount || 0;
  const shipping = order?.shippingCost;
  const tax = order?.tax;

  if (subtotal != null) drawTotalsRow('Subtotal', `$${subtotal.toFixed(2)}`);
  if (discount > 0) drawTotalsRow(`Discount${order?.discount?.reason ? ` (${order.discount.reason})` : ''}`, `-$${discount.toFixed(2)}`, { valueColor: GREEN });
  if (shipping != null) drawTotalsRow('Shipping', shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`);
  if (tax != null && tax > 0) drawTotalsRow('GST (15%)', `$${tax.toFixed(2)}`);

  // Total row with teal top rule
  totalsY -= 4;
  page.drawLine({ start: { x: 330, y: totalsY + 14 }, end: { x: W - M, y: totalsY + 14 }, thickness: 1.5, color: TEAL });
  drawTotalsRow('Total (incl. GST)', fmtMoney(invoice.amount, currency), { bold: true });

  /* ---- Footer ---- */
  page.drawLine({ start: { x: M, y: 70 }, end: { x: W - M, y: 70 }, thickness: 0.5, color: LIGHT_GRAY });
  const footerLeft = companyWebsite ? `${companyName} | ${companyWebsite}` : companyName;
  const flW = font.widthOfTextAtSize(footerLeft, 9);
  page.drawText(pdfSafe(footerLeft), { x: (W - flW) / 2, y: 52, size: 9, font, color: GRAY });
  const copyright = `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`;
  const crW = font.widthOfTextAtSize(copyright, 9);
  page.drawText(pdfSafe(copyright), { x: (W - crW) / 2, y: 38, size: 9, font, color: GRAY });

  const bytes = await pdf.save();
  return {
    buffer: Buffer.from(bytes),
    filename: `${invoice.invoiceNumber || 'invoice'}.pdf`,
  };
}
