/**
 * @module Payments Page
 * @description Admin page for viewing payment transactions.
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, CreditCard, Filter, Eye, RotateCcw } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface PaymentTransaction {
  _id: string;
  orderNumber: string;
  userId: { fullName: string; email: string } | string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  stripePaymentIntentId?: string;
  paidAt?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-purple-100 text-purple-700',
};

export default function Payments() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/commerce/orders', { params: { page, limit: 20, search } });
      const data = res.data?.data;
      // Map orders to payment transactions
      const txns = (data?.items || []).map((o: any) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        userId: o.userId,
        amount: o.payment?.amount || 0,
        currency: o.payment?.currency || 'NZD',
        method: o.payment?.method || 'card',
        status: o.payment?.status || 'pending',
        stripePaymentIntentId: o.payment?.stripePaymentIntentId,
        paidAt: o.payment?.paidAt,
        createdAt: o.createdAt,
      }));
      setTransactions(txns);
      setTotalPages(data?.totalPages || 1);
      setTotal(data?.total || 0);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const getUserName = (t: PaymentTransaction) => typeof t.userId === 'object' ? t.userId.fullName : 'Unknown';

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Transactions</h1>
        <p className="text-sm text-gray-500 mt-1">{total} transactions</p>
      </div>
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search by order number or customer..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400"><CreditCard size={32} className="mb-2" /><p>No transactions</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stripe ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{t.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getUserName(t)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">${t.amount.toFixed(2)} {t.currency}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-500'}`}>{t.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{t.paidAt ? new Date(t.paidAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[150px]">{t.stripePaymentIntentId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
