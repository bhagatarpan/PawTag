import { useState, useEffect } from 'react';
import api from '../../lib/api';

interface Subscription {
  _id: string;
  tagId: { tagId: string; status: string; tagType: string };
  planName: string;
  planType: string;
  status: string;
  price: number;
  startDate: string;
  freePeriodEndsAt?: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt?: string;
  cancelledAt?: string;
  autoRenew: boolean;
  renewalMethod: string;
  totalScans: number;
  lastScannedAt?: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  billingPeriod: { start: string; end: string };
  paidAt?: string;
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

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ subscription: Subscription; invoices: Invoice[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);

  useEffect(() => { fetchSubscriptions(); }, []);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); }, [selectedId]);

  async function fetchSubscriptions() {
    try {
      const res = await api.get('/customer/subscriptions');
      setSubscriptions(res.data.data);
    } catch (err) { console.error('Failed:', err); } finally { setLoading(false); }
  }

  async function fetchDetail(id: string) {
    setDetailLoading(true);
    try {
      const [subRes, invRes] = await Promise.all([
        api.get(`/customer/subscriptions/${id}`),
        api.get(`/customer/subscriptions/${id}/invoices`),
      ]);
      setDetail({ subscription: subRes.data.data, invoices: invRes.data.data });
    } catch (err) { console.error('Failed:', err); } finally { setDetailLoading(false); }
  }

  async function handleRenew(id: string) {
    if (!confirm('Renew this subscription now?')) return;
    setActionLoading(true);
    try { await api.put(`/customer/subscriptions/${id}/renew`); await fetchSubscriptions(); if (selectedId === id) await fetchDetail(id); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel? It remains active until end of billing period.')) return;
    setActionLoading(true);
    try { await api.put(`/customer/subscriptions/${id}/cancel`, { reason: 'Customer request' }); await fetchSubscriptions(); if (selectedId === id) await fetchDetail(id); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  }

  async function handleToggleAutoRenew(id: string, current: boolean) {
    setActionLoading(true);
    try { await api.put(`/customer/subscriptions/${id}/auto-renew`, { autoRenew: !current }); await fetchSubscriptions(); if (selectedId === id) await fetchDetail(id); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  }

  async function handleChangePlan(id: string, planType: string) {
    setActionLoading(true);
    try { await api.post(`/customer/subscriptions/${id}/change-plan`, { planType }); setShowChangePlan(false); await fetchSubscriptions(); if (selectedId === id) await fetchDetail(id); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed'); } finally { setActionLoading(false); }
  }

  function formatDate(d: string) { return new Date(d).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function daysUntil(d: string) { return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)); }

  if (selectedId && detail) {
    const sub = detail.subscription;
    return (
      <div className="space-y-6">
        <button onClick={() => { setSelectedId(null); setDetail(null); }} className="text-teal-600 hover:text-teal-800 text-sm">&larr; Back to Subscriptions</button>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{sub.tagId?.tagId || 'N/A'}</h2>
              <p className="text-sm text-gray-500">{sub.planName}</p>
            </div>
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[sub.status]}`}>{sub.status.replace('_', ' ')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div><div className="text-xs text-gray-500 uppercase">Price</div><div className="text-sm font-semibold">${sub.price.toFixed(2)}/mo</div></div>
            <div><div className="text-xs text-gray-500 uppercase">Purchased</div><div className="text-sm font-semibold">{formatDate(sub.startDate)}</div></div>
            <div><div className="text-xs text-gray-500 uppercase">{sub.freePeriodEndsAt ? 'Free Until' : 'Period End'}</div><div className="text-sm font-semibold">{formatDate(sub.freePeriodEndsAt || sub.currentPeriodEnd)}</div></div>
            <div><div className="text-xs text-gray-500 uppercase">Scans</div><div className="text-sm font-semibold">{sub.totalScans}</div></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div><div className="text-xs text-gray-500 uppercase">Auto-renew</div><div className="text-sm font-semibold">{sub.autoRenew ? 'On' : 'Off'}</div></div>
            <div><div className="text-xs text-gray-500 uppercase">Billing</div><div className="text-sm font-semibold capitalize">{sub.renewalMethod}</div></div>
            {sub.gracePeriodEndsAt && <div><div className="text-xs text-gray-500 uppercase">Grace Ends</div><div className="text-sm font-semibold text-yellow-600">{formatDate(sub.gracePeriodEndsAt)} ({daysUntil(sub.gracePeriodEndsAt)}d)</div></div>}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
            {(sub.status === 'expired' || sub.status === 'grace_period') && <button onClick={() => handleRenew(sub._id)} disabled={actionLoading} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">Renew Now</button>}
            {sub.status === 'active' && <>
              <button onClick={() => handleToggleAutoRenew(sub._id, sub.autoRenew)} disabled={actionLoading} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">{sub.autoRenew ? 'Disable Auto-renew' : 'Enable Auto-renew'}</button>
              <button onClick={() => setShowChangePlan(true)} disabled={actionLoading} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">Change Plan</button>
              <button onClick={() => handleCancel(sub._id)} disabled={actionLoading} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">Cancel</button>
            </>}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Invoices</h3>
          {detail.invoices.length === 0 ? <p className="text-sm text-gray-500">No invoices</p> : <div className="space-y-3">{detail.invoices.map(inv => <div key={inv._id} className="flex items-center justify-between py-3 border-b last:border-0"><div><div className="text-sm font-mono">{inv.invoiceNumber}</div><div className="text-xs text-gray-500">{formatDate(inv.billingPeriod.start)} — {formatDate(inv.billingPeriod.end)}</div></div><div className="text-right"><div className="text-sm font-semibold">${inv.amount.toFixed(2)}</div><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>{inv.status}</span></div></div>)}</div>}
        </div>
        {showChangePlan && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-lg p-6 w-full max-w-sm"><h3 className="text-lg font-semibold mb-4">Change Plan</h3><div className="space-y-2"><button onClick={() => handleChangePlan(sub._id, 'annual')} disabled={sub.planType === 'annual'} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"><div className="font-medium">Annual — $0.99/mo</div><div className="text-xs text-gray-500">$11.88/year</div></button><button onClick={() => handleChangePlan(sub._id, 'monthly')} disabled={sub.planType === 'monthly'} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"><div className="font-medium">Monthly — $1.99/mo</div></button></div><button onClick={() => setShowChangePlan(false)} className="w-full mt-4 px-4 py-2 border rounded-lg text-sm">Cancel</button></div></div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Subscriptions</h1>
      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : subscriptions.length === 0 ? <div className="text-center py-12"><p className="text-gray-500">No subscriptions yet</p></div> : (
        <div className="space-y-4">
          {subscriptions.map(sub => (
            <div key={sub._id} onClick={() => setSelectedId(sub._id)} className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div><div className="flex items-center gap-3"><span className="font-mono font-bold text-gray-900">{sub.tagId?.tagId || 'N/A'}</span><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status]}`}>{sub.status.replace('_', ' ')}</span></div><p className="text-sm text-gray-500 mt-1">{sub.planName} — ${sub.price.toFixed(2)}/mo</p></div>
                <div className="text-right text-sm text-gray-500"><div>Scans: {sub.totalScans}</div>{sub.freePeriodEndsAt && <div className="text-xs text-gray-400">{daysUntil(sub.freePeriodEndsAt)}d free left</div>}</div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400"><span>Purchased: {formatDate(sub.startDate)}</span><span>{sub.autoRenew ? 'Auto-renew on' : 'Off'}</span>{sub.gracePeriodEndsAt && <span className="text-yellow-600">Grace: {formatDate(sub.gracePeriodEndsAt)}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
