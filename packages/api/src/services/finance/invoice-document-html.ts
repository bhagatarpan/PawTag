/**
 * Shared HTML document renderer for financial documents.
 *
 * One layout consumes the assembled InvoiceDocumentModel for commerce
 * invoices, credit notes, AND donation receipts — the single visual
 * engine behind every document a customer or CSR can open.
 *
 * Channel-aware: provider identifiers (Stripe payment/invoice IDs) render
 * only when `model.channel === 'admin'`. Customer documents show the
 * invoice/order numbers and card brand + last4 — never the payment
 * provider's internals (founder decision; the invoice number is the
 * customer's reference).
 */
import type { InvoiceDocumentModel } from './invoice-document';

export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDocumentDate(d: Date | string | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusColor(status: string): string {
  switch (status) {
    case 'paid':
    case 'issued': return '#16a34a';
    case 'pending': return '#d97706';
    case 'failed': return '#dc2626';
    case 'refunded':
    case 'void':
    case 'replaced': return '#6b7280';
    default: return '#6b7280';
  }
}

function cardBadge(brand?: string, last4?: string): string {
  if (!brand) return '';
  return `<p style="white-space:nowrap;"><span class="label">Card:</span> ${escapeHtml(brand)}&nbsp;&bull;&bull;&bull;&bull;&nbsp;${escapeHtml(last4 || '****')}</p>`;
}

/** Render the full HTML document for any assembled financial document. */
export function renderInvoiceDocumentHtml(model: InvoiceDocumentModel): string {
  const statusCol = statusColor(model.status);
  const currentYear = new Date().getFullYear();
  const c = model.company;
  const isAdmin = model.channel === 'admin';

  // ---- Details column -----------------------------------------------------
  const detailRows: string[] = [];
  if (model.orderNumber) detailRows.push(`<p><span class="label">Order:</span> <strong>${escapeHtml(model.orderNumber)}</strong></p>`);
  detailRows.push(`<p><span class="label">Date:</span> ${formatDocumentDate(model.issuedAt)}</p>`);
  if (model.billingPeriod?.start && model.billingPeriod?.end) {
    detailRows.push(`<p><span class="label">Billing period:</span> ${formatDocumentDate(model.billingPeriod.start)} – ${formatDocumentDate(model.billingPeriod.end)}</p>`);
  }
  if (model.dueDate) detailRows.push(`<p><span class="label">Due:</span> ${formatDocumentDate(model.dueDate)}</p>`);
  if (model.paidAt) detailRows.push(`<p><span class="label">Paid:</span> ${formatDocumentDate(model.paidAt)}</p>`);
  if (model.membershipTier) detailRows.push(`<p><span class="label">Membership:</span> ${escapeHtml(model.membershipTier)}</p>`);
  if (model.subscriptionPlan) detailRows.push(`<p><span class="label">Plan:</span> ${escapeHtml(model.subscriptionPlan)}</p>`);
  if (model.originalInvoiceNumber) detailRows.push(`<p><span class="label">Original Invoice:</span> ${escapeHtml(model.originalInvoiceNumber)}</p>`);
  if (model.payment.method) detailRows.push(`<p><span class="label">Method:</span> ${escapeHtml(model.payment.method)}</p>`);
  if (model.payment.cardBrand) detailRows.push(cardBadge(model.payment.cardBrand, model.payment.cardLast4));
  if (model.payment.refundDestination) detailRows.push(`<p><span class="label">Refund to:</span> ${escapeHtml(model.payment.refundDestination)}</p>`);
  // ADMIN CHANNEL ONLY — provider identifiers never reach customer documents
  if (isAdmin && model.payment.stripePaymentIntentId) {
    detailRows.push(`<p><span class="label">Payment ID:</span> <span style="font-size:11px;color:#9ca3af;">${escapeHtml(model.payment.stripePaymentIntentId)}</span></p>`);
  }
  if (isAdmin && model.payment.stripeInvoiceId) {
    detailRows.push(`<p><span class="label">Stripe Invoice:</span> <span style="font-size:11px;color:#9ca3af;">${escapeHtml(model.payment.stripeInvoiceId)}</span></p>`);
  }

  // ---- Items + totals -----------------------------------------------------
  const showBreakdown = Boolean(model.totals && (model.totals.subtotal != null || model.totals.tax != null));
  const itemRows = model.items
    .map(
      (item) => `          <tr>
            <td>
              <strong>${escapeHtml(item.name)}</strong>
              ${item.subtitles.map((s) => `<br><span style="color:#6b7280;font-size:12px;">${escapeHtml(s)}</span>`).join('')}
            </td>
            <td>${item.quantity}</td>
            <td class="amount-col">${item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : ''}</td>
          </tr>`,
    )
    .join('\n');

  const totalsRows: string[] = [];
  if (showBreakdown && model.totals) {
    if (model.totals.subtotal != null) {
      totalsRows.push(`          <tr><td colspan="2" style="border:none;padding:8px 16px;font-size:13px;color:#6b7280;">Subtotal</td><td class="amount-col" style="border:none;padding:8px 16px;font-size:13px;color:#6b7280;font-weight:400;">$${model.totals.subtotal.toFixed(2)}</td></tr>`);
    }
    if (model.totals.discount != null && model.totals.discount > 0) {
      totalsRows.push(`          <tr><td colspan="2" style="border:none;padding:8px 16px;font-size:13px;color:#6b7280;">Discount${model.totals.discountReason ? ` (${escapeHtml(model.totals.discountReason)})` : ''}</td><td class="amount-col" style="border:none;padding:8px 16px;font-size:13px;color:#16a34a;font-weight:400;">-$${model.totals.discount.toFixed(2)}</td></tr>`);
    }
    if (model.totals.shipping != null) {
      totalsRows.push(`          <tr><td colspan="2" style="border:none;padding:8px 16px;font-size:13px;color:#6b7280;">Shipping</td><td class="amount-col" style="border:none;padding:8px 16px;font-size:13px;color:#6b7280;font-weight:400;">${model.totals.shipping === 0 ? 'Free' : `$${model.totals.shipping.toFixed(2)}`}</td></tr>`);
    }
    if (model.totals.tax != null && model.totals.tax > 0) {
      totalsRows.push(`          <tr><td colspan="2" style="border:none;padding:8px 16px;font-size:13px;color:#6b7280;">GST (15%)</td><td class="amount-col" style="border:none;padding:8px 16px;font-size:13px;color:#6b7280;font-weight:400;">$${model.totals.tax.toFixed(2)}</td></tr>`);
    }
  }

  // Kind-specific notes (donation tax statements, signatories)
  const notesHtml = model.notes.length
    ? `<div style="margin-top:16px;">${model.notes.map((n) => `<p style="font-size:13px;color:#4b5563;line-height:1.6;">${escapeHtml(n)}</p>`).join('')}</div>`
    : '';

  const shipToHtml = model.shippingAddressLines?.length
    ? `<div class="meta-block">
          <h3>Ship To</h3>
          ${model.shippingAddressLines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
        </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.title)} ${escapeHtml(model.number)} | ${escapeHtml(c.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #1f2937; }
    .invoice-container { max-width: 800px; margin: 0 auto; background: #fff; }
    .invoice-header { background: linear-gradient(135deg, #0d9488, #0f766e); padding: 40px; color: #fff; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-info h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .company-info p { font-size: 13px; opacity: 0.85; line-height: 1.6; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 36px; font-weight: 800; letter-spacing: 2px; }
    .invoice-title .inv-number { font-size: 16px; opacity: 0.9; margin-top: 4px; }
    .invoice-body { padding: 40px; }
    .invoice-meta { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .meta-block { min-width: 140px; }
    .meta-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
    .meta-block p { font-size: 14px; line-height: 1.6; color: #374151; }
    .meta-block .label { color: #6b7280; font-size: 12px; }
    .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; background: ${statusCol}; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    thead th { background: #f9fafb; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    tbody td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    tbody tr:last-child td { border-bottom: none; }
    .amount-col { text-align: right; font-weight: 600; }
    .total-row { background: #f0fdfa; }
    .total-row td { padding: 16px; font-weight: 700; font-size: 16px; border-top: 2px solid #0d9488; }
    .footer { background: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
    .footer a { color: #0d9488; text-decoration: none; }
    @media print { body { background: #fff; } .invoice-container { box-shadow: none; margin: 0; } }
    @media only screen and (max-width: 600px) {
      .invoice-header { flex-direction: column; gap: 16px; padding: 24px; }
      .invoice-title { text-align: left; }
      .invoice-body { padding: 24px; }
      .invoice-meta { flex-direction: column; gap: 16px; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">

    <div class="invoice-header">
      <div class="company-info">
        <h1>${escapeHtml(c.name)}</h1>
        ${c.address ? `<p>${escapeHtml(c.address).replace(/\n/g, '<br>')}</p>` : ''}
        ${c.phone ? `<p>${escapeHtml(c.phone)}</p>` : ''}
        ${c.email ? `<p>${escapeHtml(c.email)}</p>` : ''}
        ${c.gst ? `<p>GST: ${escapeHtml(c.gst)}</p>` : ''}
      </div>
      <div class="invoice-title">
        <h2>${escapeHtml(model.title)}</h2>
        <div class="inv-number">${escapeHtml(model.number)}</div>
        <div style="margin-top:12px;"><span class="status-badge">${escapeHtml(model.status.toUpperCase())}</span></div>
      </div>
    </div>

    <div class="invoice-body">
      <div class="invoice-meta">
        <div class="meta-block">
          <h3>${model.kind === 'donation_receipt' ? 'Donor' : 'Bill To'}</h3>
          <p><strong>${escapeHtml(model.customer.name || (model.kind === 'donation_receipt' ? 'Supporter' : 'Customer'))}</strong></p>
          ${model.customer.email ? `<p>${escapeHtml(model.customer.email)}</p>` : ''}
          ${model.customer.phone ? `<p>${escapeHtml(model.customer.phone)}</p>` : ''}
          ${model.customer.addressLines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
        </div>
        ${shipToHtml}
        <div class="meta-block">
          <h3>${escapeHtml(model.title.charAt(0) + model.title.slice(1).toLowerCase())} Details</h3>
          ${detailRows.join('\n          ')}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
${itemRows}
${totalsRows.join('\n')}
          <tr class="total-row">
            <td colspan="2"><strong>Total${showBreakdown ? ' (incl. GST)' : ''}</strong></td>
            <td class="amount-col"><strong>${escapeHtml(model.currency)} $${model.amount.toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>
      ${notesHtml}
    </div>

    <div class="footer">
      <p>${escapeHtml(c.name)}${c.website ? ` | <a href="https://${escapeHtml(c.website)}">${escapeHtml(c.website)}</a>` : ''}</p>
      <p style="margin-top:8px;">&copy; ${currentYear} ${escapeHtml(c.name)}. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`;
}
