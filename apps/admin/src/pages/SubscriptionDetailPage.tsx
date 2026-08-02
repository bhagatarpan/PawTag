import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface SubscriptionDetail {
  subscription: {
    _id: string;
    userId: { _id: string; fullName: string; email: string; phoneNumber?: string };
    tagId: { _id: string; tagId: string; status: string; tagType: string };
    planName: string;
    planType: string;
    status: string;
    price: number;
    startDate: string;
    freePeriodEndsAt?: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    gracePeriodEndsAt?: string;
    cancelledAt?: string;
    cancellationReason?: string;
    autoRenew: boolean;
    totalScans: number;
    lastScannedAt?: string;
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    reminderStates?: any;
  };
  invoices: Array<{
    _id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    billingPeriod: { start: string; end: string };
    paidAt?: string;
    dueDate: string;
    paymentMethod?: string;
  }>;
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
};

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [extendReason, setExtendReason] = useState('');

  useEffect(() => {
    fetchDetail();
  }, [id]);

  async function fetchDetail() {
    try {
      const res = await api.get(`/admin/subscriptions/${id}`);
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!confirm(`Change subscription status to "${newStatus}"?`)) return;
    setActionLoading(true);
    try {
      await api.put(`/admin/subscriptions/${id}/status`, {
        status: newStatus,
        reason: `Admin changed to ${newStatus}`,
      });
      await fetchDetail();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExtend() {
    setActionLoading(true);
    try {
      await api.post(`/admin/subscriptions/${id}/extend`, {
        days: extendDays,
        reason: extendReason || 'Admin support',
      });
      setShowExtendModal(false);
      await fetchDetail();
    } catch (err) {
      console.error('Failed to extend:', err);
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-NZ', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-gray-500">Subscription not found</div>;

  const { subscription: sub, invoices } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/subscriptions')} className="text-teal-600 hover:text-teal-800 text-sm mb-2">&larr; Back to Subscriptions</button>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Detail</h1>
        </div>
        <div className="flex gap-2">
          {sub.status !== 'active' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Set Active
            </button>
          )}
          <button
            onClick={() => setShowExtendModal(true)}
            disabled={actionLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Extend
          </button>
          {sub.status === 'active' && (
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Status">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-700'}`}>
                  {sub.status.replace('_', ' ')}
                </span>
              </InfoRow>
              <InfoRow label="Plan" value={sub.planName} />
              <InfoRow label="Price" value={`$${sub.price.toFixed(2)}/mo`} />
              <InfoRow label="Auto-renew" value={sub.autoRenew ? 'Yes' : 'No'} />
              <InfoRow label="Start Date" value={formatDate(sub.startDate)} />
              <InfoRow label="Free Period Ends" value={sub.freePeriodEndsAt ? formatDate(sub.freePeriodEndsAt) : 'N/A'} />
              <InfoRow label="Current Period Start" value={formatDate(sub.currentPeriodStart)} />
              <InfoRow label="Current Period End" value={formatDate(sub.currentPeriodEnd)} />
              {sub.gracePeriodEndsAt && (
                <InfoRow label="Grace Period Ends" value={formatDate(sub.gracePeriodEndsAt)} />
              )}
              {sub.cancelledAt && (
                <>
                  <InfoRow label="Cancelled At" value={formatDateTime(sub.cancelledAt)} />
                  {sub.cancellationReason && <InfoRow label="Reason" value={sub.cancellationReason} />}
                </>
              )}
              <InfoRow label="Total Scans" value={String(sub.totalScans)} />
              {sub.lastScannedAt && <InfoRow label="Last Scanned" value={formatDateTime(sub.lastScannedAt)} />}
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoices ({invoices.length})</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-500">No invoices yet</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Invoice</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Amount</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Period</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Paid</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => (
                    <tr key={inv._id}>
                      <td className="py-2 text-sm font-mono">{inv.invoiceNumber}</td>
                      <td className="py-2 text-sm">${inv.amount.toFixed(2)}</td>
                      <td className="py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-700'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {formatDate(inv.billingPeriod.start)} — {formatDate(inv.billingPeriod.end)}
                      </td>
                      <td className="py-2 text-sm">{inv.paidAt ? formatDate(inv.paidAt) : '—'}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/admin/invoices/${inv._id}/view`, {
                                  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
                                });
                                const data = await res.json();
                                if (data.success) window.open(data.data.secureUrl, '_blank');
                              } catch {}
                            }}
                            className="text-teal-600 hover:text-teal-700 text-xs font-medium border border-teal-200 px-2 py-1 rounded hover:bg-teal-50"
                          >
                            View
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/admin/invoices/${inv._id}/email`, {
                                  method: 'POST',
                                  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token'), 'Content-Type': 'application/json' },
                                });
                                const data = await res.json();
                                if (data.success) alert(data.data.message);
                                else alert(data.error || 'Failed to email');
                              } catch { alert('Failed to email invoice'); }
                            }}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            Email
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/admin/invoices/${inv._id}/print`, {
                                  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
                                });
                                const html = await res.text();
                                const w = window.open('', '_blank');
                                if (w) { w.document.write(html); w.document.close(); }
                              } catch { alert('Failed to print invoice'); }
                            }}
                            className="text-gray-600 hover:text-gray-700 text-xs font-medium border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
                          >
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Name</div>
                <div className="text-sm font-medium">{sub.userId?.fullName || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Email</div>
                <div className="text-sm font-medium">{sub.userId?.email || 'Unknown'}</div>
              </div>
              {sub.userId?.phoneNumber && (
                <div>
                  <div className="text-sm text-gray-500">Phone</div>
                  <div className="text-sm font-medium">{sub.userId.phoneNumber}</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tag</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Tag ID</div>
                <div className="text-sm font-mono font-medium">{sub.tagId?.tagId || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Type</div>
                <div className="text-sm font-medium capitalize">{sub.tagId?.tagType || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div className="text-sm font-medium capitalize">{sub.tagId?.status || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extend Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Extend Subscription</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days to Extend</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Admin support"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowExtendModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button
                onClick={handleExtend}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Extending...' : 'Extend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      {children || <div className="text-sm font-medium">{value || '—'}</div>}
    </div>
  );
}
