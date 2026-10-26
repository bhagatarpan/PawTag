import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, Loader2, ChevronRight } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  CUSTOMER_INVOICE_LIST_PAGE_SIZE,
  formatCurrency,
  formatDate,
  getInvoiceStatusLabel,
  invoiceDisplayAmount,
  type CustomerInvoiceListItem,
} from '@pawtag/shared';
import { EmptyState, StatusBadge, buttonClassName } from '@pawtag/ui';
import api from '../../lib/api';
import { downloadAuthenticatedFile } from '../../lib/downloadFile';

/**
 * Customer invoice list (package Phase 4, plan §5.3): a document CARD with
 * type/number/status/date/amount and two full-label controls — "View details"
 * (link to the secure detail route) and "Download PDF" (server-generated file).
 * The card is plain content: no button-like row, nothing nested inside a link.
 * Server-side pagination is unchanged.
 */
export default function Invoices() {
  const [items, setItems] = useState<CustomerInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadPage(page);
  }, [page]);

  async function loadPage(p: number) {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(API.customer.invoices.list, {
        params: { page: p, pageSize: CUSTOMER_INVOICE_LIST_PAGE_SIZE },
      });
      const payload = res.data?.data;
      setItems(payload?.data || []);
      setTotal(payload?.total || 0);
      setHasMore(Boolean(payload?.hasMore));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load invoices');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(invoice: CustomerInvoiceListItem) {
    setActionId(invoice._id);
    setError('');
    try {
      // Real PDF file download (server-generated) — not the browser print dialog.
      await downloadAuthenticatedFile(
        API.customer.invoices.pdf(invoice._id),
        `${invoice.invoiceNumber || 'invoice'}.pdf`,
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Unable to download invoice');
    } finally {
      setActionId(null);
    }
  }

  return (
    // Width, padding, breadcrumb and the mobile header title come from
    // AccountLayout (docs/DESIGN.md — the shell owns page chrome). No inner
    // max-width wrapper: the shell already centers content, and a second
    // wrapper made invoices narrower than every other account screen.
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          View and download your invoices and credit notes.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Individual document cards on the page surface (board image) —
          loading/empty keep a white surface of their own. */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center py-12 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading invoices…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <EmptyState
              message="No invoices yet"
              description="Invoices appear here after membership purchases and paid orders."
            />
          </div>
        ) : (
          items.map((invoice) => (
            <article
              key={invoice._id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${
                    invoice.type === 'credit_note' ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-600'
                  }`}
                >
                  <FileText size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">
                    {invoice.type === 'credit_note' ? 'Credit note' : 'Invoice'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                    {/* break-all: long document numbers wrap, never clip (plan §5.3) */}
                    <p className="text-sm font-semibold text-gray-900 break-all">{invoice.invoiceNumber}</p>
                    <StatusBadge label={getInvoiceStatusLabel(invoice.status)} variant={invoice.status === 'paid' ? 'success' : invoice.status === 'void' ? 'neutral' : 'info'} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(invoice.createdAt, 'medium')}</p>
                </div>
                <p className="text-base font-bold text-gray-900 shrink-0">
                  {formatCurrency(invoiceDisplayAmount(invoice.type, invoice.amount), invoice.currency || 'NZD')}
                </p>
              </div>

              {/* Full-label controls per plan §5.3 — link to detail + real PDF.
                  Stacked full-width on phones (unchanged); compact auto-width
                  pair from sm up so the row never stretches or wraps. */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  to={`/account/invoices/${invoice._id}`}
                  className={buttonClassName({ variant: 'primary', size: 'md', className: 'w-full sm:w-auto sm:whitespace-nowrap' })}
                >
                  View details
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDownload(invoice)}
                  disabled={actionId === invoice._id}
                  className={buttonClassName({ variant: 'secondary', size: 'md', className: 'w-full sm:w-auto sm:shrink-0 sm:whitespace-nowrap' })}
                >
                  {actionId === invoice._id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download PDF
                </button>
              </div>
            </article>
          ))
        )}

        {!loading && (total > CUSTOMER_INVOICE_LIST_PAGE_SIZE) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {page} · {total} invoices
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-3 min-h-[44px] text-sm font-medium border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-3 min-h-[44px] text-sm font-medium border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
