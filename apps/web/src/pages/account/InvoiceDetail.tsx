import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Loader2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  formatCurrency,
  formatDate,
  getInvoiceStatusLabel,
  type CustomerInvoiceDetail,
} from '@pawtag/shared';
import { CopyButton, StatusBadge } from '@pawtag/ui';
import api from '../../lib/api';
import { downloadAuthenticatedFile } from '../../lib/downloadFile';
import { openDocumentInNewTab } from '../../lib/openDocumentTab';

/**
 * Invoice detail — rich summary from related order/membership/subscription data.
 * View opens the real document (shared finance engine — same rendering as
 * donation receipts); Download serves the server-generated PDF.
 * View/Download stays visible while scrolling (desktop sticky top-right + mobile bottom bar).
 */
export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<CustomerInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await api.get(API.customer.invoices.get(id));
        setInvoice(res.data?.data || null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Invoice not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleViewDownload() {
    if (!id) return;
    setDownloading(true);
    setError('');
    try {
      // Real PDF file download (server-generated) — not the browser print dialog.
      await downloadAuthenticatedFile(
        API.customer.invoices.pdf(id),
        `${invoice?.invoiceNumber || 'invoice'}.pdf`,
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Unable to download invoice');
    } finally {
      setDownloading(false);
    }
  }

  async function handleView() {
    if (!id) return;
    setViewing(true);
    setError('');
    try {
      // Real document HTML (shared finance engine) — identical rendering
      // to the donation receipt View.
      const res = await api.get(API.customer.invoices.html(id));
      if (typeof res.data === 'string' && res.data) {
        openDocumentInNewTab(res.data);
      } else {
        setError('Unable to load invoice document');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to view invoice');
    } finally {
      setViewing(false);
    }
  }

  const viewDownloadButton = (
    // shrink-0 + flex-wrap: at 320px the pair wraps to its own line instead
    // of overflowing the fixed bottom bar; on desktop it stays one row.
    <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
      <button
        type="button"
        onClick={handleView}
        disabled={viewing}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary-300 text-primary-700 text-sm font-semibold hover:bg-primary-50 disabled:opacity-60 transition-colors whitespace-nowrap"
      >
        {viewing ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Opening…
          </>
        ) : (
          <>
            <Eye size={16} /> View
          </>
        )}
      </button>
      <button
        type="button"
        onClick={handleViewDownload}
        disabled={downloading}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors whitespace-nowrap"
      >
        {downloading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Downloading…
          </>
        ) : (
          <>
            <Download size={16} /> Download PDF
          </>
        )}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 flex justify-center text-gray-500">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading invoice…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/account/invoices" className="text-sm text-primary-600 hover:underline">
          ← Back to invoices
        </Link>
        <p className="mt-4 text-red-600">{error || 'Invoice not found'}</p>
      </div>
    );
  }

  const order = invoice.order;
  const membership = invoice.membership;
  // Credit notes render the CREDITED scope (breakdown snapshot) — the
  // original order's items/totals would contradict the note amount (the
  // exact bug the founder caught on WO-000517's CN-000004).
  const creditScope = invoice.type === 'credit_note' ? invoice.refundScope || null : null;
  const subscription = invoice.subscription;
  const cardDisplay =
    invoice.order?.cardBrand && invoice.order?.cardLast4
      ? `${invoice.order.cardBrand} ••••${invoice.order.cardLast4}`
      : membership?.cardBrand && membership?.cardLast4
        ? `${membership.cardBrand} ••••${membership.cardLast4}`
        : invoice.paymentMethod || null;

  return (
    // Width/padding/breadcrumb come from AccountLayout (shell owns page
    // chrome). Bottom padding: the shell's pb-28 clears the tab bar; this
    // page adds clearance for its own fixed action bar, which stacks ABOVE
    // the tab bar (worst case = stacked bar ~116px + tab bar ~73px).
    <div className="pb-24 lg:pb-8">
      <Link
        to="/account/invoices"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} /> Back to invoices
      </Link>

      {/* Sticky top-right action — remains visible while scrolling */}
      <div className="sticky top-16 z-20 mb-4 -mx-4 px-4 py-2 bg-white/95 backdrop-blur border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900 truncate">{invoice.invoiceNumber}</h1>
          <CopyButton text={invoice.invoiceNumber} />
        </div>
        {/* Hidden on mobile — the sticky bottom bar carries this CTA there */}
        <div className="hidden lg:block">{viewDownloadButton}</div>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <p className="text-sm text-gray-500">
          {invoice.type === 'credit_note' ? 'Credit note' : 'Invoice'} ·{' '}
          {formatDate(invoice.createdAt, 'long')}
          {invoice.relatedInvoiceNumber ? ` · Original ${invoice.relatedInvoiceNumber}` : ''}
        </p>

        {/* Status + payment summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-gray-500">Amount</p>
            <p className="font-semibold text-gray-900 text-lg">
              {formatCurrency(invoice.amount, invoice.currency || 'NZD')}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <div className="mt-1">
              <StatusBadge label={getInvoiceStatusLabel(invoice.status)} variant={invoice.status === 'paid' ? 'success' : invoice.status === 'void' ? 'neutral' : 'info'} />
            </div>
          </div>
          {invoice.paidAt && (
            <div>
              <p className="text-gray-500">Paid</p>
              <p className="text-gray-900">{formatDate(invoice.paidAt, 'long')}</p>
            </div>
          )}
          {invoice.dueDate && !invoice.paidAt && (
            <div>
              <p className="text-gray-500">Due</p>
              <p className="text-gray-900">{formatDate(invoice.dueDate, 'long')}</p>
            </div>
          )}
          {invoice.billingPeriod?.start && (
            <div className="sm:col-span-2">
              <p className="text-gray-500">Billing period</p>
              <p className="text-gray-900">
                {formatDate(invoice.billingPeriod.start, 'medium')} –{' '}
                {formatDate(invoice.billingPeriod.end, 'medium')}
              </p>
            </div>
          )}
          {cardDisplay && (
            <div className="sm:col-span-2">
              <p className="text-gray-500">Payment method</p>
              <p className="text-gray-900">{cardDisplay}</p>
            </div>
          )}
          {invoice.voidedReason && (
            <div className="sm:col-span-2">
              <p className="text-gray-500">Void reason</p>
              <p className="text-gray-900">{invoice.voidedReason}</p>
            </div>
          )}
        </div>

        {/* Order line items — credit notes show the CREDITED scope */}
        {creditScope?.lines?.length ? (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Credited items</h2>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {creditScope.lines.map((line, idx) => (
                <div key={`${line.productName}-${idx}`} className="p-4 flex justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {line.kind === 'engraving' ? 'Engraving' : line.productName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Qty {line.quantity}
                      {(line.gstPortion ?? 0) > 0 ? ` · incl. GST ${formatCurrency(line.gstPortion, invoice.currency || 'NZD')}` : ''}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900 shrink-0">
                    {formatCurrency(line.refundedAmount, invoice.currency || 'NZD')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : order?.items && order.items.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Items</h2>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {order.items.map((item, idx) => (
                <div key={`${item.productName}-${idx}`} className="p-4 flex justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {item.productName}
                      {item.variantName ? ` — ${item.variantName}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Qty {item.quantity}
                      {item.petName ? ` · ${item.petName}` : ''}
                      {item.tagId ? ` · ${item.tagId}` : ''}
                    </p>
                    {item.customisationTexts && item.customisationTexts.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.customisationTexts.join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {item.totalPrice != null && (
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(item.totalPrice, invoice.currency || 'NZD')}
                      </p>
                    )}
                    {item.unitPrice != null && (
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.unitPrice, invoice.currency || 'NZD')} each
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals — credit notes show the credited scope; invoices show
            order totals including the card payment fee */}
        {creditScope?.totals ? (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              {order?.orderNumber ? `Order ${order.orderNumber} — credited` : 'Credited totals'}
            </h2>
            <dl className="text-sm space-y-1.5 max-w-sm ml-auto">
              <div className="flex justify-between gap-8">
                <dt className="text-gray-500">Subtotal (credited)</dt>
                <dd className="text-gray-900">
                  {formatCurrency(Math.max(0, (creditScope.totals.refunded || 0) - (creditScope.totals.refundedGst || 0)), invoice.currency || 'NZD')}
                </dd>
              </div>
              {(creditScope.totals.refundedGst ?? 0) > 0 && (
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">GST portion (refunded)</dt>
                  <dd className="text-gray-900">{formatCurrency(creditScope.totals.refundedGst || 0, invoice.currency || 'NZD')}</dd>
                </div>
              )}
              <div className="flex justify-between gap-8 pt-2 border-t border-gray-100">
                <dt className="font-semibold text-gray-900">Total credited</dt>
                <dd className="font-semibold text-gray-900">
                  {formatCurrency(invoice.amount, invoice.currency || 'NZD')}
                </dd>
              </div>
            </dl>
          </div>
        ) : order && (order.subtotal != null || order.shippingCost != null || order.tax != null || order.discount) && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              {order.orderNumber ? `Order ${order.orderNumber}` : 'Totals'}
            </h2>
            <dl className="text-sm space-y-1.5 max-w-sm ml-auto">
              {order.subtotal != null && (
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd className="text-gray-900">{formatCurrency(order.subtotal, invoice.currency || 'NZD')}</dd>
                </div>
              )}
              {order.discount && (order.discount.amount ?? 0) > 0 && (
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">Discount{order.discount.reason ? ` (${order.discount.reason})` : ''}</dt>
                  <dd className="text-green-700">−{formatCurrency(order.discount.amount || 0, invoice.currency || 'NZD')}</dd>
                </div>
              )}
              {order.shippingCost != null && (
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">Shipping</dt>
                  <dd className="text-gray-900">
                    {Number(order.shippingCost) === 0 ? 'Free' : formatCurrency(order.shippingCost, invoice.currency || 'NZD')}
                  </dd>
                </div>
              )}
              {order.tax != null && (
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">GST</dt>
                  <dd className="text-gray-900">{formatCurrency(order.tax, invoice.currency || 'NZD')}</dd>
                </div>
              )}
              {(order.cpf?.amount ?? 0) > 0 && (
                <div className="flex justify-between gap-8">
                  <dt className="text-gray-500">Card payment fee (incl. GST {formatCurrency(order.cpf?.gst || 0, invoice.currency || 'NZD')})</dt>
                  <dd className="text-gray-900">{formatCurrency(order.cpf?.amount || 0, invoice.currency || 'NZD')}</dd>
                </div>
              )}
              <div className="flex justify-between gap-8 pt-2 border-t border-gray-100">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-semibold text-gray-900">
                  {formatCurrency(invoice.amount, invoice.currency || 'NZD')}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Membership context */}
        {membership && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Membership</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm">
              <p className="font-medium text-gray-900">{membership.tierName}</p>
              {membership.currentPeriodStart && membership.currentPeriodEnd && (
                <p className="text-gray-600 mt-1">
                  {formatDate(membership.currentPeriodStart, 'medium')} –{' '}
                  {formatDate(membership.currentPeriodEnd, 'medium')}
                </p>
              )}
              {membership.price != null && (
                <p className="text-gray-600 mt-0.5">
                  {formatCurrency(membership.price, membership.currency || invoice.currency || 'NZD')}/year
                </p>
              )}
            </div>
          </div>
        )}

        {/* Subscription context */}
        {subscription && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Subscription</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm">
              <p className="font-medium text-gray-900">
                {subscription.planName}
                {subscription.planType ? ` (${subscription.planType})` : ''}
              </p>
              {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
                <p className="text-gray-600 mt-1">
                  {formatDate(subscription.currentPeriodStart, 'medium')} –{' '}
                  {formatDate(subscription.currentPeriodEnd, 'medium')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Ship to */}
        {order?.shippingAddress && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Ship to</h2>
            <p className="text-sm text-gray-700">
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              <br />
              {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.zip]
                .filter(Boolean)
                .join(', ')}
              {order.shippingAddress.country ? `, ${order.shippingAddress.country}` : ''}
            </p>
          </div>
        )}

        {/* Credit note refund reference */}
        {invoice.type === 'credit_note' && order?.refundArn && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Refund</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
              <p className="text-gray-700">
                Reference: <span className="font-mono">{order.refundArn}</span>
              </p>
              {order.refundExpectedArrival && (
                <p className="text-gray-600">
                  Expected arrival: {formatDate(order.refundExpectedArrival, 'medium')}
                </p>
              )}
              <p className="text-gray-600">
                Refunded to original payment method.
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          View opens this invoice as a full document; Download saves a real PDF file.
        </p>
      </div>

      {/* Mobile sticky bottom bar — sits above the account tab bar via
          --app-bottom-nav-height (0 where the tab bar does not render).
          flex-wrap lets the info block and action pair reflow on 320px. */}
      <div className="lg:hidden fixed bottom-[var(--app-bottom-nav-height)] left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{invoice.invoiceNumber}</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(invoice.amount, invoice.currency || 'NZD')}
            </p>
          </div>
          {viewDownloadButton}
        </div>
      </div>
    </div>
  );
}
