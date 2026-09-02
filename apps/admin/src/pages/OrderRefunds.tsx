import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, Filter, Search, XCircle, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';
import RefundStatusCard from '../components/RefundStatusCard';

interface RefundListItem {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: string;
  refundId: string;
  arn?: string;
  initiatedBy: string;
  cancelledBy: string;
  cancellationReason: string;
  refundSettledAt?: string;
  refundCreatedAt: string;
  paymentIntentId: string;
  attemptCount: number;
}

interface RefundsResponse {
  items: RefundListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  { value: '', label: 'All', color: 'bg-gray-100 text-gray-700' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-700' },
  { value: 'pending', label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  { value: 'succeeded', label: 'Succeeded', color: 'bg-green-100 text-green-700' },
];

const STATUS_BADGE: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: 'Processing', icon: Clock, color: 'bg-blue-100 text-blue-700' },
  succeeded: { label: 'Succeeded', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-100 text-red-700' },
  canceled: { label: 'Canceled', icon: AlertTriangle, color: 'bg-gray-100 text-gray-700' },
};

const DATE_PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'month', label: 'Current month' },
  { value: 'custom', label: 'Custom' },
];

export default function OrderRefunds() {
  const [data, setData] = useState<RefundsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [datePreset, setDatePreset] = useState('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<RefundListItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [reconciling, setReconciling] = useState(false);

  const toggleRow = (orderId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleReconcileNow = async () => {
    setReconciling(true);
    try {
      const res = await api.post('/admin/commerce/refunds/reconcile');
      if (res.data.success) {
        const d = res.data.data;
        toast.success(`Reconciliation done: ${d.synced} synced, ${d.retried} retried, ${d.errors} errors`);
        fetchRefunds();
      } else {
        toast.error(res.data.error || 'Reconciliation failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50, status: statusFilter };
      if (datePreset === 'custom' && dateFrom) params.dateFrom = dateFrom;
      if (datePreset === 'custom' && dateTo) params.dateTo = dateTo;
      if (datePreset === '7') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        params.dateFrom = d.toISOString();
      }
      if (datePreset === '30') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        params.dateFrom = d.toISOString();
      }
      if (datePreset === 'month') {
        const d = new Date(); d.setDate(1);
        params.dateFrom = d.toISOString();
      }
      if (search) params.search = search;

      const res = await api.get('/admin/commerce/refunds', { params });
      setData(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [page, statusFilter]);

  const handleExport = async (format: 'csv' | 'gl' | 'xero') => {
    setExporting(true);
    try {
      const params: any = { format };
      if (datePreset === 'custom' && dateFrom) params.dateFrom = dateFrom;
      if (datePreset === 'custom' && dateTo) params.dateTo = dateTo;
      if (datePreset === '7') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        params.dateFrom = d.toISOString();
      }
      if (datePreset === '30') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        params.dateFrom = d.toISOString();
      }
      if (datePreset === 'month') {
        const d = new Date(); d.setDate(1);
        params.dateFrom = d.toISOString();
      }
      const res = await api.get('/admin/commerce/refunds/export', {
        params,
        responseType: format === 'csv' || format === 'gl' ? 'blob' : 'json',
      });
      if (format === 'xero') {
        if (res.data.success) {
          toast.success(`Created ${res.data.data.created} Xero journals (${res.data.data.failed} failed)`);
        } else {
          toast.error(res.data.error || res.data.data?.errors?.[0] || 'Xero export failed');
        }
      } else {
        const blob = new Blob([res.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `refunds-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export downloaded');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleSync = async (orderId: string) => {
    try {
      const res = await api.post(`/admin/commerce/refunds/${orderId}/sync`);
      if (res.data.success) {
        toast.success('Refund synced with Stripe');
        fetchRefunds();
      } else {
        toast.error(res.data.error || 'Sync failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Sync failed');
    }
  };

  const handleRetry = async (orderId: string) => {
    try {
      const res = await api.post(`/admin/commerce/refunds/${orderId}/retry`);
      if (res.data.success) {
        toast.success('Refund retry initiated');
        fetchRefunds();
      } else {
        toast.error(res.data.error || 'Retry failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Retry failed');
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-NZ', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return `$${amount.toFixed(2)} ${currency}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and reconcile refunds. Failed refunds are retried automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReconcileNow}
            disabled={reconciling}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Run daily reconciliation against Stripe now"
          >
            {reconciling ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Reconcile Now
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            CSV
          </button>
          <button
            onClick={() => handleExport('gl')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            GL
          </button>
          <button
            onClick={() => handleExport('xero')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Xero
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchRefunds(); }}
              placeholder="Search order #, refund ID, reason..."
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={fetchRefunds}
              className="px-3 py-1.5 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              Search
            </button>
          </div>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {datePreset === 'custom' && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                statusFilter === f.value ? f.color : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 text-primary-600 animate-spin" />
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-20 text-gray-500">
            <p>No refunds found</p>
            <p className="text-sm mt-1">Refunds will appear here when orders are cancelled.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8"></th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Order #</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Customer</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500">Amount</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Reason</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">Created</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => {
                const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                const BadgeIcon = badge.icon;
                const isExpanded = expandedRows.has(r.orderId);
                return (
                  <React.Fragment key={r.orderId}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-3">
                        <button
                          onClick={() => toggleRow(r.orderId)}
                          className="p-1 text-gray-400 hover:text-gray-700"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-900">{r.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{r.customerName}</div>
                        <div className="text-xs text-gray-400">{r.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatAmount(r.amount, r.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                          <BadgeIcon size={11} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">
                        {r.cancellationReason}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(r.refundCreatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSync(r.orderId)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            title="Sync with Stripe"
                          >
                            <RefreshCw size={14} />
                          </button>
                          {r.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(r.orderId)}
                              className="p-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                              title="Retry refund"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Refund details</h4>
                              <dl className="space-y-1 text-sm">
                                <div className="flex justify-between gap-4">
                                  <dt className="text-gray-500">Refund ID</dt>
                                  <dd className="text-gray-900 font-mono text-xs">{r.refundId || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-gray-500">ARN</dt>
                                  <dd className="text-gray-900 font-mono text-xs">{r.arn || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-gray-500">Initiated by</dt>
                                  <dd className="text-gray-900">{r.initiatedBy}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-gray-500">Cancelled by</dt>
                                  <dd className="text-gray-900">{r.cancelledBy || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-gray-500">Settled at</dt>
                                  <dd className="text-gray-900">{formatDate(r.refundSettledAt)}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-gray-500">Retry attempts</dt>
                                  <dd className="text-gray-900">{r.attemptCount}</dd>
                                </div>
                              </dl>
                            </div>
                            <div>
                              <RefundStatusCard
                                orderId={r.orderId}
                                orderNumber={r.orderNumber}
                                details={{
                                  refundId: r.refundId,
                                  refundArn: r.arn,
                                  refundStatus: (r.status as any) || null,
                                  refundSettledAt: r.refundSettledAt,
                                  refundLastSyncedAt: r.refundCreatedAt,
                                  refundAttemptCount: r.attemptCount,
                                  cancelledBy: r.cancelledBy,
                                  cancellationReason: r.cancellationReason,
                                }}
                                onSynced={fetchRefunds}
                                compact
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{data.total} total refunds</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {page} of {data.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
