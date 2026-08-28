/**
 * @module Payment Reconciliation Page
 * @description Admin page for reconciling PawTag payments against Stripe.
 *
 * Compares PawTag order payment state with Stripe payment intent state
 * to detect discrepancies. Shows potential issues for manual review.
 */

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw, CreditCard, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface Discrepancy {
  orderNumber: string;
  orderPaymentStatus: string;
  stripeStatus: string | null;
  amount: number;
  stripeAmount: number | null;
  stripePaymentIntentId: string;
  issue: string;
}

interface ReconciliationResult {
  mode: 'demo' | 'live';
  message?: string;
  checkedOrders?: number;
  discrepancyCount: number;
  discrepancies: Discrepancy[];
}

export default function PaymentReconciliation() {
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const runReconciliation = async () => {
    try {
      setChecking(true);
      const res = await api.get('/admin/commerce/payments/reconciliation');
      setResult(res.data?.data);
    } catch {
      toast.error('Failed to run reconciliation');
    } finally {
      setChecking(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    runReconciliation();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Compare PawTag orders against Stripe payment state</p>
        </div>
        <button
          onClick={runReconciliation}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm"
        >
          <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking...' : 'Run Reconciliation'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-teal-500" size={24} />
        </div>
      ) : !result ? (
        <div className="text-center text-gray-500 py-12">No reconciliation data</div>
      ) : result.mode === 'demo' ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-yellow-800">Demo Mode</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {result.message || 'Stripe is not configured. Reconciliation requires live Stripe API access.'}
              </p>
              <p className="text-sm text-yellow-600 mt-2">
                Configure <code className="bg-yellow-100 px-1 rounded">STRIPE_SECRET_KEY</code> in your environment to enable real reconciliation.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Orders Checked</div>
              <div className="text-2xl font-bold text-gray-900">{result.checkedOrders || 0}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Discrepancies Found</div>
              <div className={`text-2xl font-bold ${result.discrepancyCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {result.discrepancyCount}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Status</div>
              <div className="flex items-center gap-2 mt-1">
                {result.discrepancyCount === 0 ? (
                  <>
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="text-lg font-semibold text-green-700">All Matched</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="text-red-600" size={20} />
                    <span className="text-lg font-semibold text-red-700">Issues Found</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Discrepancies */}
          {result.discrepancies.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
              <p className="text-green-800 font-medium">All payments are reconciled</p>
              <p className="text-sm text-green-600 mt-1">No discrepancies found between PawTag and Stripe</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">PawTag Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stripe Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Issue</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stripe PI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.discrepancies.map((d, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.orderNumber}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {d.orderPaymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {d.stripeStatus || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        ${d.amount.toFixed(2)}
                        {d.stripeAmount !== null && d.stripeAmount !== d.amount && (
                          <span className="text-red-500 ml-1">vs ${d.stripeAmount.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">{d.issue}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-gray-500 truncate max-w-[120px]">
                            {d.stripePaymentIntentId}
                          </span>
                          <a
                            href={`https://dashboard.stripe.com/payments/${d.stripePaymentIntentId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:text-teal-700"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
