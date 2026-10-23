import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Download, Eye, Loader2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  CUSTOMER_INVOICE_LIST_PAGE_SIZE,
  formatCurrency,
  formatDate,
  type CustomerInvoiceListItem,
} from '@pawtag/shared';
import { EmptyState, StatusBadge } from '@pawtag/ui';
import api from '../../lib/api';
import { downloadAuthenticatedFile } from '../../lib/downloadFile';
import { openDocumentInNewTab } from '../../lib/openDocumentTab';

/**
 * Customer invoice list — View opens the real document (same engine +
 * new-tab UX as donation receipts); download serves the server-generated PDF.
 * Row click opens details.
 */
export default function Invoices() {
  const navigate = useNavigate();
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

  async function handleView(invoice: CustomerInvoiceListItem, e: React.MouseEvent) {
    e.stopPropagation();
    setActionId(invoice._id);
    setError('');
    try {
      // Real document HTML (shared finance engine) — identical rendering
      // to the donation receipt View.
      const res = await api.get(API.customer.invoices.html(invoice._id));
      if (typeof res.data === 'string' && res.data) {
        openDocumentInNewTab(res.data);
      } else {
        setError('Unable to load invoice document');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to view invoice');
    } finally {
      setActionId(null);
    }
  }

  async function handleDownload(invoice: CustomerInvoiceListItem, e: React.MouseEvent) {
    e.stopPropagation();
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        to="/account"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={16} /> Back to Account
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-500 mt-1">
          All membership and order invoices for your account. Select a row for details, or view / download the document.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading invoices…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            message="No invoices yet"
            description="Invoices appear here after membership purchases and paid orders."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((invoice) => (
              <div
                key={invoice._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/account/invoices/${invoice._id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/account/invoices/${invoice._id}`);
                  }
                }}
                className="flex items-center py-4 first:pt-0 last:pb-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                    <CreditCard size={18} className="text-primary-600" />
                  </div>
                  {/* Two-line layout: number + amount on top, date + status +
                      download below — a single row squeezed invoice numbers
                      into "INV-0..." on mobile. */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900 truncate">{invoice.invoiceNumber}</p>
                      <p className="text-sm font-semibold text-gray-900 shrink-0">
                        {formatCurrency(invoice.amount, invoice.currency || 'NZD')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500 shrink-0">
                        {formatDate(invoice.createdAt, 'medium')}
                        {invoice.type === 'credit_note' ? ' · Credit note' : ''}
                      </p>
                      <StatusBadge label={invoice.status} variant={invoice.status === 'paid' ? 'success' : invoice.status === 'void' ? 'neutral' : 'info'} />
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`View ${invoice.invoiceNumber}`}
                          onClick={(e) => handleView(invoice, e)}
                          disabled={actionId === invoice._id}
                          className="p-2 -m-1 rounded-lg text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                        >
                          {actionId === invoice._id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={`Download ${invoice.invoiceNumber} PDF`}
                          onClick={(e) => handleDownload(invoice, e)}
                          disabled={actionId === invoice._id}
                          className="p-2 -m-1 rounded-lg text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (total > CUSTOMER_INVOICE_LIST_PAGE_SIZE) && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {page} · {total} invoices
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40"
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
