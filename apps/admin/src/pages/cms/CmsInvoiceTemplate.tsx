import { useState, useEffect } from 'react';
import { Save, Mail } from 'lucide-react';
import api from '../../lib/api';

interface EmailTemplate {
  _id: string;
  name: string;
  slug: string;
  subject: string;
  title: string;
  subtitle?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  preheader?: string;
  footerText?: string;
  senderEmail: string;
  senderName: string;
  variables: string[];
  status: 'active' | 'inactive';
}

const VARIABLES = [
  '{{company.name}}', '{{company.address}}', '{{company.phone}}', '{{company.email}}',
  '{{company.gst}}', '{{company.website}}', '{{company.logo}}',
  '{{invoice.number}}', '{{invoice.date}}', '{{invoice.dueDate}}', '{{invoice.paidAt}}',
  '{{invoice.status}}', '{{invoice.statusColor}}', '{{invoice.amount}}', '{{invoice.currency}}',
  '{{invoice.paymentMethod}}', '{{invoice.billingPeriodStart}}', '{{invoice.billingPeriodEnd}}',
  '{{customer.name}}', '{{customer.email}}',
  '{{subscription.planName}}', '{{subscription.tagId}}', '{{year}}',
];

export default function CmsInvoiceTemplate() {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [body, setBody] = useState('');
  const [showVars, setShowVars] = useState(false);

  useEffect(() => {
    api.get('/admin/cms/email/email-templates/slug/invoice-template')
      .then((res) => {
        const t = res.data.data;
        setTemplate(t);
        setBody(t.body || '');
      })
      .catch(() => {
        // Template doesn't exist yet, create default
        setBody(DEFAULT_TEMPLATE);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      if (template?._id) {
        await api.put(`/admin/cms/email/email-templates/${template._id}`, { body });
      } else {
        await api.post('/admin/cms/email/email-templates', {
          name: 'Invoice Template',
          slug: 'invoice-template',
          subject: 'Invoice {{invoice.number}}',
          title: 'Invoice',
          subtitle: 'Your PawTag invoice',
          body,
          senderEmail: 'billing@pawtag.co.nz',
          senderName: 'PawTag',
          variables: VARIABLES,
          status: 'active',
        });
      }
      alert('Invoice template saved');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Template</h1>
          <p className="text-sm text-gray-500 mt-1">Customize the HTML invoice template used for customer downloads and emails.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowVars(!showVars)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Mail size={14} /> Variables
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {showVars && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Available Variables</h3>
          <div className="grid grid-cols-3 gap-2">
            {VARIABLES.map((v) => (
              <code key={v} className="text-xs bg-white border rounded px-2 py-1 cursor-pointer hover:bg-teal-50" onClick={() => { navigator.clipboard.writeText(v); }}>
                {v}
              </code>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Click to copy. Paste into the template body below.</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Template HTML Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full h-[600px] px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs leading-relaxed resize-y"
          placeholder="Paste your invoice HTML template here..."
        />
      </div>
    </div>
  );
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice {{invoice.number}} | {{company.name}}</title>
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
    .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; background: {{invoice.statusColor}}; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    thead th { background: #f9fafb; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    tbody td { padding: 14px 16px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .amount-col { text-align: right; font-weight: 600; }
    .total-row { background: #f0fdfa; }
    .total-row td { padding: 16px; font-weight: 700; font-size: 16px; border-top: 2px solid #0d9488; }
    .footer { background: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.6; }
    .footer a { color: #0d9488; text-decoration: none; }
    @media print { body { background: #fff; } .invoice-container { box-shadow: none; margin: 0; } }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-header">
      <div class="company-info">
        {{company.logo}}<img src="{{company.logo}}" alt="{{company.name}}" style="height:40px;margin-bottom:12px;" />
        <h1>{{company.name}}</h1>
        <p>{{company.address}}</p>
        <p>{{company.phone}}</p>
        <p>{{company.email}}</p>
        <p>GST: {{company.gst}}</p>
      </div>
      <div class="invoice-title">
        <h2>INVOICE</h2>
        <div class="inv-number">{{invoice.number}}</div>
        <div style="margin-top:12px;"><span class="status-badge">{{invoice.status}}</span></div>
      </div>
    </div>
    <div class="invoice-body">
      <div class="invoice-meta">
        <div class="meta-block">
          <h3>Bill To</h3>
          <p><strong>{{customer.name}}</strong></p>
          <p>{{customer.email}}</p>
        </div>
        <div class="meta-block">
          <h3>Invoice Details</h3>
          <p><span class="label">Date:</span> {{invoice.date}}</p>
          <p><span class="label">Due:</span> {{invoice.dueDate}}</p>
          <p><span class="label">Paid:</span> {{invoice.paidAt}}</p>
          <p><span class="label">Method:</span> {{invoice.paymentMethod}}</p>
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th>Billing Period</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>{{subscription.planName}}</strong><br><span style="color:#6b7280;font-size:12px;">Tag: {{subscription.tagId}}</span></td>
            <td>{{invoice.billingPeriodStart}} — {{invoice.billingPeriodEnd}}</td>
            <td class="amount-col">{{invoice.currency}} {{invoice.amount}}</td>
          </tr>
          <tr class="total-row"><td colspan="2"><strong>Total</strong></td><td class="amount-col"><strong>{{invoice.currency}} {{invoice.amount}}</strong></td></tr>
        </tbody>
      </table>
    </div>
    <div class="footer">
      <p>{{company.name}} | <a href="https://{{company.website}}">{{company.website}}</a></p>
      <p style="margin-top:8px;">&copy; {{year}} {{company.name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
