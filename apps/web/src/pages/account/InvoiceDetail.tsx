import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  formatCurrency,
  formatDate,
  type CustomerInvoiceDetail,
} from '@pawtag/shared';
import { CopyButton, StatusBadge } from '@pawtag/ui';
import api from '../../lib/api';
import { openInvoiceSecureUrl } from '../../lib/openInvoiceSecureUrl';

/**
 * Invoice detail — rich summary from related order/membership/subscription data.
 * Full PDF/HTML document stays in InvoiceView via secure access.
 * View/Download stays visible while scrolling (desktop sticky top-right + mobile bottom bar).
 */
export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<CustomerInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

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
      await openInvoiceSecureUrl(id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Unable to open invoice');
    } finally {
      setDownloading(false);
    }
  }

  const viewDownloadButton = (
    <button
      type="button"
      onClick={handleViewDownload}
      disabled={downloading}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors whitespace-nowrap"
    >
      {downloading ? (
        <>
          <Loader2 size={16} className="animate-spin" /> Opening…
        </>
      ) : (
        <>
          <Download size={16} /> View or Download Invoice
        </>
      )}
    </button>
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
  const subscription = invoice.subscription;
  const cardDisplay =
    invoice.order?.cardBrand && invoice.order?.cardLast4
      ? `${invoice.order.cardBrand} ••••${invoice.order.cardLast4}`
      : membership?.cardBrand && membership?.cardLast4
        ? `${membership.cardBrand} ••••${membership.cardLast4}`
        : invoice.paymentMethod || null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 lg:pb-10">
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
        {viewDownloadButton}
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
              <StatusBadge label={invoice.status} variant={invoice.status === 'paid' ? 'success' : invoice.status === 'void' ? 'neutral' : 'info'} />
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

        {/* Order line items */}
        {order?.items && order.items.length > 0 && (
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

        {/* Order totals */}
        {order && (order.subtotal != null || order.shippingCost != null || order.tax != null || order.discount) && (
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
          Full invoice document opens in the secure viewer. Use Print / Save PDF there to download a file.
        </p>
      </div>

      {/* Mobile sticky bottom bar — always visible */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
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
