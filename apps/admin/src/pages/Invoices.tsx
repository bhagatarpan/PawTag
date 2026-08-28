/**
 * @module Invoices Page
 * @description Admin page for managing invoices.
 *
 * Provides a comprehensive invoice management interface:
 * - List all invoices with filtering and pagination
 * - View invoice details
 * - Filter by status (paid, pending, failed, refunded)
 * - Search by invoice number
 * - View customer and order information
 *
 * All data is fetched from the PawTag Commerce API.
 *
 * @example
 * ```tsx
 * // Route: /invoices
 * // Requires: order.read permission
 * <Invoices />
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, FileText, Download, Eye, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Invoice {
  _id: string;
  invoiceNumber: string;
  userId: { _id: string; fullName: string; email: string } | string;
  orderId: { _id: string; orderNumber: string; status: string } | string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  paymentMethod?: string;
  paidAt?: string;
  dueDate?: string;
  createdAt: string;
}

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-700';
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'failed': return 'bg-red-100 text-red-700';
    case 'refunded': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

const STATUS_OPTIONS = ['all', 'paid', 'pending', 'failed', 'refunded'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get('/admin/commerce/invoices', { params });
      const data: InvoiceListResponse = res.data?.data;
      setInvoices(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const getUserName = (invoice: Invoice) => {
    if (typeof invoice.userId === 'object') return invoice.userId.fullName || invoice.userId.email;
    return 'Unknown';
  };

  const getOrderNumber = (invoice: Invoice) => {
    if (typeof invoice.orderId === 'object') return invoice.orderId.orderNumber || '-';
    return '-';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total invoices</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-teal-500" size={24} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FileText size={32} className="mb-2" />
            <p>No invoices found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-gray-900">{inv.invoiceNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getUserName(inv)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{getOrderNumber(inv)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    ${inv.amount.toFixed(2)} {inv.currency}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{selectedInvoice.invoiceNumber}</h2>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">${selectedInvoice.amount.toFixed(2)} {selectedInvoice.currency}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(selectedInvoice.status)}`}>{selectedInvoice.status}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span>{getUserName(selectedInvoice)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Order</span><span className="font-mono">{getOrderNumber(selectedInvoice)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payment Method</span><span>{selectedInvoice.paymentMethod || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{formatDate(selectedInvoice.createdAt)}</span></div>
              {selectedInvoice.paidAt && <div className="flex justify-between"><span className="text-gray-500">Paid At</span><span>{formatDate(selectedInvoice.paidAt)}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
