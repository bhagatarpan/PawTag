/**
 * Invoice HTML entry point.
 *
 * All rendering flows through the shared assembly + layout engine:
 * - `assembleInvoiceDocument` (finance/invoice-document.ts) normalises the
 *   document — one source of truth for parties, payment details, items,
 *   totals — with the on-document card snapshot preferred and legacy
 *   Order/Membership joins as fallback for old records.
 * - `renderInvoiceDocumentHtml` (finance/invoice-document-html.ts) is the
 *   single visual engine for invoices, credit notes, and donation receipts.
 *
 * CHANNEL RULE (founder decision): customer documents NEVER show Stripe
 * provider identifiers (`pi_`, `in_`). The invoice/order number is the
 * customer's reference. Admin-issued access tokens render the admin
 * channel, which includes provider IDs for CSR troubleshooting.
 *
 * The CMS email-template branch (slug `invoice-template`) is preserved for
 * commerce invoices; its variable set follows the same channel rule.
 */
import { CmsEmailTemplate, Invoice, Subscription, User, Order, UserMembership } from '@pawtag/db';
import {
  assembleInvoiceDocument,
  getCompanySettings,
  type DocumentChannel,
} from './finance/invoice-document';
import { renderInvoiceDocumentHtml, escapeHtml, formatDocumentDate } from './finance/invoice-document-html';

function formatDate(d: Date | string | undefined): string {
  return formatDocumentDate(d);
}

function getBillingPeriod(invoice: any): { start?: string; end?: string } {
  if (invoice.billingPeriod?.start && invoice.billingPeriod?.end) {
    return { start: invoice.billingPeriod.start, end: invoice.billingPeriod.end };
  }
  if (invoice.periodStart && invoice.periodEnd) {
    return { start: invoice.periodStart, end: invoice.periodEnd };
  }
  return { start: invoice.paidAt, end: invoice.paidAt };
}

function statusColor(status: string): string {
  switch (status) {
    case 'paid': return '#16a34a';
    case 'pending': return '#d97706';
    case 'failed': return '#dc2626';
    case 'refunded': return '#6b7280';
    default: return '#6b7280';
  }
}

/**
 * Render invoice/credit-note HTML for viewing and email.
 *
 * @param channel - 'customer' (default; provider IDs stripped) or
 *                  'admin' (includes Stripe IDs for CSR troubleshooting).
 */
export async function generateInvoiceHtml(
  invoiceId: string,
  channel: DocumentChannel = 'customer',
): Promise<string> {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw new Error('Invoice not found');

  // Credit notes + everything non-standard: shared document engine
  if (invoice.type !== 'invoice') {
    const model = await assembleInvoiceDocument(invoiceId, channel);
    return renderInvoiceDocumentHtml(model);
  }

  // CMS template branch (commerce invoices only) — admin-editable layout
  const template = await CmsEmailTemplate.findOne({ slug: 'invoice-template', status: 'active', deletedAt: null }).lean();
  if (template) {
    const [order, user, company] = await Promise.all([
      invoice.orderId ? Order.findById(invoice.orderId).lean() : null,
      User.findById(invoice.userId).select('fullName email phoneNumber address').lean(),
      getCompanySettings(),
    ]);

    let membership: any = null;
    if ((invoice as any).userMembershipId) {
      membership = await UserMembership.findById((invoice as any).userMembershipId).lean();
    }

    let subscription: any = null;
    if (invoice.subscriptionId) {
      subscription = await Subscription.findById(invoice.subscriptionId)
        .populate('tagId', 'tagId')
        .populate('planId', 'name')
        .lean();
    }

    const companyName = company['company.name'] || 'PawTag Ltd';
    const customerName = user?.fullName || 'Customer';
    const currentYear = new Date().getFullYear();
    const statusCol = statusColor(invoice.status);

    let body = template.body;
    const vars: Record<string, string> = {
      'company.name': companyName,
      'company.address': company['company.address'] || '',
      'company.phone': company['company.phone'] || '',
      'company.email': company['company.email'] || '',
      'company.gst': company['company.gst'] || '',
      'company.website': company['company.website'] || '',
      'company.logo': company['company.logo'] || '',
      'invoice.number': invoice.invoiceNumber,
      'invoice.date': formatDate(invoice.createdAt),
      'invoice.dueDate': invoice.dueDate ? formatDate(invoice.dueDate) : formatDate(invoice.createdAt),
      'invoice.paidAt': invoice.paidAt ? formatDate(invoice.paidAt) : '',
      'invoice.status': invoice.status.toUpperCase(),
      'invoice.statusColor': statusCol,
      'invoice.amount': `${invoice.currency || 'NZD'} $${invoice.amount.toFixed(2)}`,
      'invoice.currency': invoice.currency || 'NZD',
      'invoice.paymentMethod': invoice.paymentMethod || '',
      'invoice.billingPeriodStart': invoice.billingPeriod ? formatDate(getBillingPeriod(invoice).start) : formatDate(invoice.createdAt),
      'invoice.billingPeriodEnd': invoice.billingPeriod ? formatDate(getBillingPeriod(invoice).end) : formatDate(invoice.createdAt),
      'invoice.orderNumber': (order as any)?.orderNumber || '',
      'invoice.subtotal': (order as any)?.subtotal != null ? `$${(order as any).subtotal.toFixed(2)}` : '',
      'invoice.shipping': (order as any)?.shippingCost != null ? ((order as any).shippingCost === 0 ? 'Free' : `$${(order as any).shippingCost.toFixed(2)}`) : '',
      'invoice.tax': (order as any)?.tax != null ? `$${(order as any).tax.toFixed(2)}` : '',
      'invoice.discount': (order as any)?.discount?.amount ? `$${(order as any).discount.amount.toFixed(2)}` : '',
      // Payment presentation follows the channel rule: customers get the
      // card they recognise; provider IDs are admin-only.
      'invoice.paymentRef': channel === 'admin' ? ((order as any)?.payment?.stripePaymentIntentId || '') : '',
      'invoice.cardBrand': (order as any)?.payment?.cardBrand || membership?.cardBrand || '',
      'invoice.cardLast4': (order as any)?.payment?.cardLast4 || membership?.cardLast4 || '',
      'customer.name': customerName,
      'customer.email': user?.email || '',
      'subscription.planName': subscription?.planName || '',
      'subscription.tagId': (subscription?.tagId as any)?.tagId || '',
      'year': String(currentYear),
    };

    for (const [key, value] of Object.entries(vars)) {
      body = body.split(`{{${key}}}`).join(escapeHtml(value));
    }
    // Strip any unreplaced variable markers
    body = body.replace(/\{\{[a-zA-Z._]+\}\}/g, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)} | ${escapeHtml(companyName)}</title>
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
    .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; background: ${statusCol}; }
    .invoice-body { padding: 40px; }
    .footer { background: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
    @media print { body { background: #fff; } }
    @media only screen and (max-width: 600px) {
      .invoice-header { flex-direction: column; gap: 16px; padding: 24px; }
      .invoice-title { text-align: left; }
      .invoice-body { padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-header">
      <div class="company-info">
        <h1>${escapeHtml(companyName)}</h1>
        ${company['company.address'] ? `<p>${escapeHtml(company['company.address']).replace(/\n/g, '<br>')}</p>` : ''}
        ${company['company.phone'] ? `<p>${escapeHtml(company['company.phone'])}</p>` : ''}
        ${company['company.gst'] ? `<p>GST: ${escapeHtml(company['company.gst'])}</p>` : ''}
      </div>
      <div class="invoice-title">
        <h2>INVOICE</h2>
        <div class="inv-number">${escapeHtml(invoice.invoiceNumber)}</div>
        <div style="margin-top:12px;"><span class="status-badge">${escapeHtml(invoice.status.toUpperCase())}</span></div>
      </div>
    </div>
    <div class="invoice-body">${body}</div>
    <div class="footer">
      <p>${escapeHtml(companyName)}${company['company.website'] ? ` | ${escapeHtml(company['company.website'])}` : ''}</p>
      <p style="margin-top:8px;">&copy; ${currentYear} ${escapeHtml(companyName)}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  // Default (no CMS template): shared document engine
  const model = await assembleInvoiceDocument(invoiceId, channel);
  return renderInvoiceDocumentHtml(model);
}

/**
 * Credit note HTML — thin wrapper over the shared document engine.
 * Kept as a named export for callers/tests that reference it directly.
 */
export async function generateCreditNoteHtml(
  creditNoteId: string,
  channel: DocumentChannel = 'customer',
): Promise<string> {
  const model = await assembleInvoiceDocument(creditNoteId, channel);
  return renderInvoiceDocumentHtml(model);
}
