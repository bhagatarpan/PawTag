/**
 * @module Stripe Customer Report Page
 * @description Admin page for viewing comprehensive Stripe data for a customer.
 */

import { useState, useCallback } from 'react';
import { API } from '@pawtag/shared/api';
import { Search, Loader2, CreditCard, ExternalLink, User, Receipt, ShoppingCart, RefreshCcw } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface CustomerData {
  userId: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
}

interface StripeCustomer {
  id: string;
  email: string;
  name: string;
  created: number;
  invoicePrefix: string;
  defaultPaymentMethod: string | null;
  balance: number;
  delinquent: boolean | null;
}

interface Subscription {
  _id: string;
  planName: string;
  planType: string;
  status: string;
  price: number;
  currency: string;
  startDate: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
  stripeSubscriptionId?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  payment?: {
    amount: number;
    currency: string;
    status: string;
    stripePaymentIntentId?: string;
    paidAt?: string;
  };
  createdAt: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  stripeInvoiceId?: string;
  paidAt?: string;
  createdAt: string;
}

interface Transaction {
  _id: string;
  orderNumber: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  providerTransactionId?: string;
  createdAt: string;
}

interface ReportData {
  customer: CustomerData;
  stripeCustomer: StripeCustomer | null;
  subscriptions: Subscription[];
  orders: Order[];
  invoices: Invoice[];
  transactions: Transaction[];
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  grace_period: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
  pending_payment: 'bg-orange-100 text-orange-700',
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  succeeded: 'bg-green-100 text-green-700',
  refunded: 'bg-purple-100 text-purple-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function StripeCustomerReport() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get(API.admin.stripe.report(query.trim()));
      setData(res.data.data);
    } catch (err: any) {
      setData(null);
      toast.error(err.response?.data?.error || 'Failed to load Stripe report');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const stripeDashboardBase = 'https://dashboard.stripe.com';

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stripe Customer Report</h1>
        <p className="text-sm text-gray-500 mt-1">View all Stripe data for a customer in one place</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or user ID..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
        </button>
      </form>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-teal-500" size={24} />
        </div>
      )}

      {!loading && searched && !data && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <User size={32} className="mb-2" />
          <p>No customer found</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{data.customer.name}</h2>
                <p className="text-sm text-gray-500">{data.customer.email}</p>
                <p className="text-xs text-gray-400 mt-1 font-mono">User ID: {data.customer.userId}</p>
                {data.customer.stripeCustomerId && (
                  <a
                    href={`${stripeDashboardBase}/customers/${data.customer.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 mt-2"
                  >
                    {data.customer.stripeCustomerId}
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              {data.stripeCustomer && (
                <div className="text-right text-sm text-gray-500">
                  <p>Balance: ${(data.stripeCustomer.balance / 100).toFixed(2)}</p>
                  {data.stripeCustomer.delinquent && (
                    <p className="text-red-600 font-medium">Delinquent</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subscriptions */}
          <Section
            title="Subscriptions"
            icon={RefreshCcw}
            count={data.subscriptions.length}
            emptyText="No subscriptions"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Period End</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Auto-Renew</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Stripe ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.subscriptions.map((sub) => (
                  <tr key={sub._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{sub.planName}</td>
                    <td className="px-4 py-2"><StatusBadge status={sub.status} /></td>
                    <td className="px-4 py-2 text-right">${sub.price.toFixed(2)}</td>
                    <td className="px-4 py-2 text-gray-600">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-center">{sub.autoRenew ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-400 truncate max-w-[150px]">
                      {sub.stripeSubscriptionId ? (
                        <a
                          href={`${stripeDashboardBase}/subscriptions/${sub.stripeSubscriptionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-800 inline-flex items-center gap-1"
                        >
                          {sub.stripeSubscriptionId}
                          <ExternalLink size={10} />
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Orders */}
          <Section
            title="Orders"
            icon={ShoppingCart}
            count={data.orders.length}
            emptyText="No orders"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Payment</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Stripe PI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.orders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-4 py-2"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      ${order.payment?.amount?.toFixed(2) || '0.00'} {order.payment?.currency || 'NZD'}
                    </td>
                    <td className="px-4 py-2"><StatusBadge status={order.payment?.status || 'pending'} /></td>
                    <td className="px-4 py-2 text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-400 truncate max-w-[150px]">
                      {order.payment?.stripePaymentIntentId ? (
                        <a
                          href={`${stripeDashboardBase}/payments/${order.payment.stripePaymentIntentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-800 inline-flex items-center gap-1"
                        >
                          {order.payment.stripePaymentIntentId}
                          <ExternalLink size={10} />
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Invoices */}
          <Section
            title="Invoices"
            icon={Receipt}
            count={data.invoices.length}
            emptyText="No invoices"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Paid At</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Stripe ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-medium text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      ${inv.amount.toFixed(2)} {inv.currency}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-400 truncate max-w-[150px]">
                      {inv.stripeInvoiceId ? (
                        <a
                          href={`${stripeDashboardBase}/invoices/${inv.stripeInvoiceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-800 inline-flex items-center gap-1"
                        >
                          {inv.stripeInvoiceId}
                          <ExternalLink size={10} />
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Transactions */}
          <Section
            title="Payment Transactions"
            icon={CreditCard}
            count={data.transactions.length}
            emptyText="No transactions"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Stripe ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.transactions.map((txn) => (
                  <tr key={txn._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-900">{txn.orderNumber}</td>
                    <td className="px-4 py-2 text-gray-600 capitalize">{txn.type}</td>
                    <td className="px-4 py-2"><StatusBadge status={txn.status} /></td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      ${txn.amount.toFixed(2)} {txn.currency}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{new Date(txn.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-400 truncate max-w-[150px]">
                      {txn.providerTransactionId ? (
                        <a
                          href={`${stripeDashboardBase}/payments/${txn.providerTransactionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-800 inline-flex items-center gap-1"
                        >
                          {txn.providerTransactionId}
                          <ExternalLink size={10} />
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <Icon size={18} className="text-gray-400" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400 ml-auto">{count} {count === 1 ? 'item' : 'items'}</span>
      </div>
      {count === 0 ? (
        <div className="px-6 py-12 text-center text-gray-400 text-sm">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}
