import { Setting, CmsEmailTemplate, Invoice, Subscription, User } from '@pawtag/db';

interface InvoiceData {
  invoice: any;
  subscription: any;
  user: any;
}

  function formatDate(d: Date | string | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getCompanySettings(): Promise<Record<string, string>> {
  const keys = ['company.name', 'company.address', 'company.phone', 'company.email', 'company.gst', 'company.website', 'company.logo'];
  const settings = await Setting.find({ key: { $in: keys } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return map;
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

function buildDefaultInvoiceHtml(data: InvoiceData, company: Record<string, string>): string {
  const { invoice, subscription, user } = data;
  const companyName = company['company.name'] || 'PawTag Ltd';
  const companyAddress = company['company.address'] || '';
  const companyPhone = company['company.phone'] || '';
  const companyEmail = company['company.email'] || '';
  const companyGst = company['company.gst'] || '';
  const companyWebsite = company['company.website'] || '';
  const companyLogo = company['company.logo'] || '';

  const currentYear = new Date().getFullYear();
  const statusCol = statusColor(invoice.status);

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
    .invoice-body { padding: 40px; }
    .invoice-meta { display: flex; justify-content: space-between; margin-bottom: 32px; }
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
    @media print {
      body { background: #fff; }
      .invoice-container { box-shadow: none; margin: 0; }
      .no-print { display: none !important; }
    }
    @media only screen and (max-width: 600px) {
      .invoice-header { flex-direction: column; gap: 16px; padding: 24px; }
      .invoice-title { text-align: left; }
      .invoice-body { padding: 24px; }
      .invoice-meta { flex-direction: column; gap: 16px; }
      .meta-block { margin-bottom: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">

    <div class="invoice-header">
      <div class="company-info">
        ${companyLogo ? `<img src="${escapeHtml(companyLogo)}" alt="${escapeHtml(companyName)}" style="height:40px;margin-bottom:12px;" />` : ''}
        <h1>${escapeHtml(companyName)}</h1>
        ${companyAddress ? `<p>${escapeHtml(companyAddress).replace(/\n/g, '<br>')}</p>` : ''}
        ${companyPhone ? `<p>${escapeHtml(companyPhone)}</p>` : ''}
        ${companyEmail ? `<p>${escapeHtml(companyEmail)}</p>` : ''}
        ${companyGst ? `<p>GST: ${escapeHtml(companyGst)}</p>` : ''}
      </div>
      <div class="invoice-title">
        <h2>INVOICE</h2>
        <div class="inv-number">${escapeHtml(invoice.invoiceNumber)}</div>
        <div style="margin-top:12px;"><span class="status-badge">${escapeHtml(invoice.status.toUpperCase())}</span></div>
      </div>
    </div>

    <div class="invoice-body">
      <div class="invoice-meta">
        <div class="meta-block">
          <h3>Bill To</h3>
          <p><strong>${escapeHtml(user.fullName || 'Customer')}</strong></p>
          ${user.email ? `<p>${escapeHtml(user.email)}</p>` : ''}
          ${user.phoneNumber ? `<p>${escapeHtml(user.phoneNumber)}</p>` : ''}
          ${user.address ? `<p>${escapeHtml(user.address.line1 || '')}${user.address.city ? `, ${escapeHtml(user.address.city)}` : ''}${user.address.zip ? ` ${escapeHtml(user.address.zip)}` : ''}</p>` : ''}
        </div>
        <div class="meta-block">
          <h3>Invoice Details</h3>
          <p><span class="label">Date:</span> ${formatDate(invoice.createdAt)}</p>
          <p><span class="label">Due:</span> ${formatDate(invoice.dueDate)}</p>
          ${invoice.paidAt ? `<p><span class="label">Paid:</span> ${formatDate(invoice.paidAt)}</p>` : ''}
          ${invoice.paymentMethod ? `<p><span class="label">Method:</span> ${escapeHtml(invoice.paymentMethod)}</p>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Billing Period</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${escapeHtml(subscription?.planName || 'Subscription')}</strong>
              <br><span style="color:#6b7280;font-size:12px;">Tag: ${escapeHtml(subscription?.tagId?.tagId || 'N/A')}</span>
            </td>
            <td>${formatDate(getBillingPeriod(invoice).start)} — ${formatDate(getBillingPeriod(invoice).end)}</td>
            <td class="amount-col">${invoice.currency || 'NZD'} $${invoice.amount.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="2"><strong>Total</strong></td>
            <td class="amount-col"><strong>${invoice.currency || 'NZD'} $${invoice.amount.toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>${escapeHtml(companyName)}${companyWebsite ? ` | <a href="https://${escapeHtml(companyWebsite)}">${escapeHtml(companyWebsite)}</a>` : ''}</p>
      <p style="margin-top:8px;">&copy; ${currentYear} ${escapeHtml(companyName)}. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`;
}

export async function generateInvoiceHtml(invoiceId: string): Promise<string> {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw new Error('Invoice not found');

  const subscription = await Subscription.findById(invoice.subscriptionId)
    .populate('tagId', 'tagId')
    .populate('planId', 'name')
    .lean();

  const user = await User.findById(invoice.userId)
    .select('fullName email phoneNumber address')
    .lean();

  const company = await getCompanySettings();

  const data: InvoiceData = {
    invoice,
    subscription,
    user,
  };

  // Try to load CMS template
  const template = await CmsEmailTemplate.findOne({ slug: 'invoice-template', status: 'active', deletedAt: null }).lean();

  if (template) {
    const companyName = company['company.name'] || 'PawTag Ltd';
    const companyAddress = company['company.address'] || '';
    const companyPhone = company['company.phone'] || '';
    const companyEmail = company['company.email'] || '';
    const companyGst = company['company.gst'] || '';
    const companyWebsite = company['company.website'] || '';
    const companyLogo = company['company.logo'] || '';
    const customerName = user?.fullName || 'Customer';
    const customerEmail = user?.email || '';
    const currentYear = new Date().getFullYear();
    const statusCol = statusColor(invoice.status);

    let body = template.body;
    const vars: Record<string, string> = {
      'company.name': companyName,
      'company.address': companyAddress,
      'company.phone': companyPhone,
      'company.email': companyEmail,
      'company.gst': companyGst,
      'company.website': companyWebsite,
      'company.logo': companyLogo,
      'invoice.number': invoice.invoiceNumber,
      'invoice.date': formatDate(invoice.createdAt),
      'invoice.dueDate': formatDate(invoice.dueDate),
      'invoice.paidAt': invoice.paidAt ? formatDate(invoice.paidAt) : '',
      'invoice.status': invoice.status.toUpperCase(),
      'invoice.statusColor': statusCol,
      'invoice.amount': `$${invoice.amount.toFixed(2)}`,
      'invoice.currency': invoice.currency || 'NZD',
      'invoice.paymentMethod': invoice.paymentMethod || '',
      'invoice.billingPeriodStart': formatDate(getBillingPeriod(invoice).start),
      'invoice.billingPeriodEnd': formatDate(getBillingPeriod(invoice).end),
      'customer.name': customerName,
      'customer.email': customerEmail,
      'subscription.planName': subscription?.planName || 'Subscription',
      'subscription.tagId': (subscription?.tagId as any)?.tagId || 'N/A',
      'year': String(currentYear),
    };

    for (const [key, value] of Object.entries(vars)) {
      body = body.split(`{{${key}}}`).join(escapeHtml(value));
    }
    return body;
  }

  return buildDefaultInvoiceHtml(data, company);
}

export async function generateInvoiceEmailHtml(invoiceId: string): Promise<{ html: string; subject: string }> {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw new Error('Invoice not found');

  const user = await User.findById(invoice.userId).select('fullName name email').lean();
  const companyName = (await getCompanySettings())['company.name'] || 'PawTag Ltd';

  const html = await generateInvoiceHtml(invoiceId);
  const subject = `Invoice ${invoice.invoiceNumber} from ${companyName}`;

  return { html, subject };
}
