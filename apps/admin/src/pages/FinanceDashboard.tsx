import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { Loader2, RefreshCw, TrendingUp, Receipt, CreditCard, AlertTriangle, Settings } from 'lucide-react';

/**
 * FinanceDashboard — GST, card processing fee (CPF), and refund ledgers
 * (docs/COMMERCE-FINANCE-PLAN-GST-CPF.md §10, founder decision D2).
 *
 * Interactive: date-range filter, expandable refund rows with per-line
 * breakdowns (amount + GST + retained charges), drill-down links to
 * orders/refunds. Actionable: failed refunds link to the retry flow,
 * exceptions are surfaced first.
 *
 * Data comes from GET /api/admin/commerce/finance/overview (finance.view
 * permission) — all figures are computed from existing collections.
 */

interface OverviewData {
  range: { from: string; to: string };
  stats: {
    salesCaptured: number;
    gstCollected: number;
    gstRefunded: number;
    cpfCollected: number;
    cpfRefunded: number;
    totalRefunded: number;
    netRevenue: number;
    orderCount: number;
  };
  gstLedger: Array<{ orderNumber: string; gstCharged: number; gstRefunded: number; gstNet: number; orderAmount: number; status: string }>;
  cpfLedger: Array<{ orderNumber: string; cpfAmount: number; cpfGst: number; cardNetwork: string | null; cardCountry: string | null; scheduleVersion: string; refundedAmount: number; stripeFee: number | null; variance: number | null }>;
  refunds: Array<{
    orderNumber: string;
    amount: number;
    status: string;
    initiatedBy: string;
    refundId: string;
    arn?: string;
    refundedAt: string;
    destination?: string;
    gstPortion: number;
    isCpfException: boolean;
    lines: Array<{ productName: string; kind: string; quantity: number; refundedAmount: number; gstPortion: number }>;
    retained: { engraving: number; engravingGst: number; cpf: number; cpfGst: number } | null;
  }>;
  exceptions: {
    failedRefunds: Array<{ orderNumber: string; amount: number; failedAt: string; reason?: string }>;
    cpfExceptionCount: number;
  };
}

const money = (n: number | null | undefined) => `$${Number(n || 0).toFixed(2)}`;

function StatCard({ label, value, icon, accent = 'text-gray-900' }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-xl font-bold mt-1 ${accent}`}>{value}</p>
      </div>
      <div className="text-gray-400">{icon}</div>
    </div>
  );
}

export default function FinanceDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(API.admin.commerce.finance.overview, { params: { days } });
      setData(res.data?.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load finance overview');
      if (err.response?.status === 403) toast.error('Finance view permission required');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">GST, card processing fee, and refund ledgers — read-only (finance.view)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm ${days === d ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={fetchOverview}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!data && loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 size={18} className="animate-spin" /> Loading finance overview…
        </div>
      ) : data && (
        <>
          {/* 1. Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={`Sales captured (${data.stats.orderCount} orders)`} value={money(data.stats.salesCaptured)} icon={<TrendingUp size={18} />} />
            <StatCard label="GST collected" value={money(data.stats.gstCollected)} icon={<Receipt size={18} />} />
            <StatCard label="GST refunded" value={money(data.stats.gstRefunded)} icon={<Receipt size={18} />} accent="text-red-600" />
            <StatCard label="Net revenue" value={money(data.stats.netRevenue)} icon={<TrendingUp size={18} />} accent="text-primary-700" />
            <StatCard label="Card fee collected" value={money(data.stats.cpfCollected)} icon={<CreditCard size={18} />} />
            <StatCard label="Card fee retained on refunds" value={money(data.stats.cpfCollected - data.stats.cpfRefunded)} icon={<CreditCard size={18} />} />
            <StatCard label="Card fee refunded (exceptions)" value={money(data.stats.cpfRefunded)} icon={<CreditCard size={18} />} accent="text-amber-600" />
            <StatCard label="Total refunded" value={money(data.stats.totalRefunded)} icon={<Receipt size={18} />} accent="text-red-600" />
          </div>

          {/* 4. Refunds table */}
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Refunds</h2>
              <Link to="/refunds" className="text-xs text-primary-600 hover:underline">Open in Refunds →</Link>
            </div>
            {data.refunds.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">No refunds in this range.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2">Order</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">GST portion</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Initiated by</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.refunds.map((r) => {
                    const key = `${r.orderNumber}-${r.refundId}`;
                    const isOpen = expanded.has(key);
                    return (
                      <RowGroup key={key}>
                        <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggle(key)}>
                          <td className="px-4 py-2 text-gray-400">{isOpen ? '▾' : '▸'}</td>
                          <td className="px-4 py-2 font-mono text-xs">
                            <Link to={`/orders?search=${r.orderNumber}`} className="text-primary-700 hover:underline" onClick={(e) => e.stopPropagation()}>{r.orderNumber}</Link>
                            {r.isCpfException && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">CPF exception</span>}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">{money(r.amount)}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{money(r.gstPortion)}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'succeeded' ? 'bg-green-100 text-green-700' : r.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600 text-xs">{r.initiatedBy}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{new Date(r.refundedAt).toLocaleDateString()}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="px-6 py-3">
                              {r.lines.length === 0 ? (
                                <p className="text-xs text-gray-500">No line breakdown recorded (legacy refund).</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400 text-left">
                                      <th className="py-1 pr-4">Line</th>
                                      <th className="py-1 pr-4">Kind</th>
                                      <th className="py-1 pr-4 text-right">Qty</th>
                                      <th className="py-1 pr-4 text-right">Refunded</th>
                                      <th className="py-1 text-right">GST</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.lines.map((l, i) => (
                                      <tr key={i} className="text-gray-700">
                                        <td className="py-1 pr-4">{l.productName}</td>
                                        <td className="py-1 pr-4 capitalize">{l.kind}</td>
                                        <td className="py-1 pr-4 text-right">{l.quantity}</td>
                                        <td className="py-1 pr-4 text-right">{money(l.refundedAmount)}</td>
                                        <td className="py-1 text-right">{money(l.gstPortion)}</td>
                                      </tr>
                                    ))}
                                    {r.retained && (r.retained.engraving > 0 || r.retained.cpf > 0) && (
                                      <tr className="text-amber-700 border-t border-amber-100">
                                        <td className="py-1 pr-4" colSpan={3}>
                                          Retained: {r.retained.engraving > 0 ? `engraving ${money(r.retained.engraving)} (incl. GST ${money(r.retained.engravingGst)})` : ''}
                                          {r.retained.engraving > 0 && r.retained.cpf > 0 ? ' · ' : ''}
                                          {r.retained.cpf > 0 ? `card fee ${money(r.retained.cpf)}` : ''}
                                        </td>
                                        <td className="py-1 pr-4 text-right text-gray-400">—</td>
                                        <td className="py-1 text-right text-gray-400">—</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </RowGroup>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 2. GST ledger */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">GST ledger</h2>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2">Order</th>
                      <th className="px-4 py-2 text-right">GST charged</th>
                      <th className="px-4 py-2 text-right">GST refunded</th>
                      <th className="px-4 py-2 text-right">Net GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.gstLedger.map((row) => (
                      <tr key={row.orderNumber} className="border-t border-gray-50">
                        <td className="px-4 py-2 font-mono text-xs">{row.orderNumber}</td>
                        <td className="px-4 py-2 text-right">{money(row.gstCharged)}</td>
                        <td className="px-4 py-2 text-right text-red-600">{row.gstRefunded > 0 ? money(row.gstRefunded) : '—'}</td>
                        <td className="px-4 py-2 text-right font-medium">{money(row.gstNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. CPF ledger */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Card processing fee ledger</h2>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2">Order</th>
                      <th className="px-4 py-2">Network</th>
                      <th className="px-4 py-2 text-right">Fee charged</th>
                      <th className="px-4 py-2 text-right">Stripe fee</th>
                      <th className="px-4 py-2 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cpfLedger.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-sm text-gray-500">No card fees in this range (fee disabled or historical orders).</td></tr>
                    ) : data.cpfLedger.map((row) => (
                      <tr key={row.orderNumber} className="border-t border-gray-50">
                        <td className="px-4 py-2 font-mono text-xs">{row.orderNumber}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{row.cardNetwork || '—'}{row.cardCountry ? ` · ${row.cardCountry}` : ''}</td>
                        <td className="px-4 py-2 text-right">{money(row.cpfAmount)}{row.refundedAmount > 0 ? <span className="text-amber-600 text-xs"> (−{money(row.refundedAmount)})</span> : null}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{row.stripeFee === null ? '—' : money(row.stripeFee)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${row.variance !== null && row.variance < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                          {row.variance === null ? '—' : money(row.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 5. Exceptions queue */}
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">Exceptions</h2>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {data.exceptions.failedRefunds.length === 0 && data.exceptions.cpfExceptionCount === 0 ? (
                <p className="text-gray-500">No exceptions in this range.</p>
              ) : (
                <>
                  {data.exceptions.failedRefunds.map((f, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <span className="text-gray-700">
                        Failed refund — <Link className="text-primary-600 hover:underline font-mono text-xs" to="/refunds">{f.orderNumber}</Link>
                        <span className="text-gray-400 text-xs ml-2">{f.reason || 'no reason recorded'}</span>
                      </span>
                      <span className="text-red-600 font-medium">{money(f.amount)}</span>
                    </div>
                  ))}
                  {data.exceptions.cpfExceptionCount > 0 && (
                    <p className="text-amber-700">{data.exceptions.cpfExceptionCount} card fee exception refund(s) — see refund rows tagged "CPF exception".</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 6. Config footer */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-gray-500 inline-flex items-center gap-2">
              <Settings size={14} /> Card fee schedule and switch live in Commerce Settings — flipping the switch never requires a deployment.
            </span>
            <Link to="/commerce-settings" className="text-primary-600 hover:underline">Commerce Settings →</Link>
          </div>
        </>
      )}
    </div>
  );
}

/** Fragment helper — React tables need tr groups keyed together. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
