import { useState, useEffect, Component, ReactNode } from 'react';
import api from '../../lib/api';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
          <p className="text-red-700 font-medium">Something went wrong rendering this view.</p>
          <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} className="mt-2 text-sm text-red-600 underline">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  nextPaymentDate?: string;
  createdAt: string;
  petName?: string;
  petType?: string;
  productName?: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  periodStart?: string;
  periodEnd?: string;
  billingPeriod?: { start: string; end: string };
  paidAt?: string;
}

export default function Subscriptions() {
  return (
    <ErrorBoundary>
      <SubscriptionsInner />
    </ErrorBoundary>
  );
}

function SubscriptionsInner() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ subscription: Subscription; invoices: Invoice[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    try {
      const res = await api.get('/customer/subscriptions');
      setSubscriptions(res.data.data);
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDetail(id: string) {
    setDetailLoading(true);
    try {
      const [subRes, invRes] = await Promise.all([
        api.get(`/customer/subscriptions/${id}`),
        api.get(`/customer/subscriptions/${id}/invoices`),
      ]);
      const sub = subRes.data?.data;
      const invs = invRes.data?.data || [];
      if (!sub) {
        alert('Subscription not found');
        setSelectedId(null);
        return;
      }
      setDetail({ subscription: sub, invoices: invs });
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to load subscription details');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRenew(id: string) {
    if (!confirm('Renew this subscription now?')) return;
    setActionLoading(true);
    try {
      await api.put(`/customer/subscriptions/${id}/renew`);
      await fetchSubscriptions();
      if (selectedId === id) await fetchDetail(id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to renew');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this subscription? It will remain active until the end of the current billing period.')) return;
    setActionLoading(true);
    try {
      await api.put(`/customer/subscriptions/${id}/cancel`, { reason: 'Customer request' });
      await fetchSubscriptions();
      if (selectedId === id) await fetchDetail(id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleAutoRenew(id: string, current: boolean) {
    setActionLoading(true);
    try {
      await api.put(`/customer/subscriptions/${id}/auto-renew`, { autoRenew: !current });
      await fetchSubscriptions();
      if (selectedId === id) await fetchDetail(id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleChangePlan(id: string, planType: string) {
    setActionLoading(true);
    try {
      await api.post(`/customer/subscriptions/${id}/change-plan`, { planType });
      setShowChangePlan(false);
      await fetchSubscriptions();
      if (selectedId === id) await fetchDetail(id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change plan');
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function daysUntil(dateStr: string) {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  if (selectedId && detail) {
    const sub = detail.subscription;
    const isActive = sub.status === 'active';
    const isGrace = sub.status === 'grace_period';
    const isExpired = sub.status === 'expired';
    const priceLabel = sub.renewalMethod === 'annual' ? '/yr' : '/mo';
    const billingAmount = sub.renewalMethod === 'annual' ? (sub.price * 12) : sub.price;

    return (
      <div className="space-y-6 max-w-3xl">
        <button onClick={() => { setSelectedId(null); setDetail(null); }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Subscriptions
        </button>

        {/* Hero Header */}
        <div className={`relative overflow-hidden rounded-2xl p-6 ${isActive ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : isGrace ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-gray-700 to-gray-900'}`}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
                  <span className="text-white/80 text-xs font-medium uppercase tracking-wider">Active Tag</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{sub.tagId?.tagId || 'N/A'}</h1>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${isActive ? 'bg-white/20 text-white' : isGrace ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}>
                {sub.status.replace('_', ' ')}
              </span>
            </div>
            {sub.petName && (
              <div className="flex items-center gap-2 text-white/90">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/></svg>
                <span className="font-semibold">{sub.petName}</span>
                {sub.petType && <span className="text-white/60">· {sub.petType}</span>}
                <span className="text-white/40">·</span>
                <span className="text-white/70 text-sm">{sub.productName || sub.planName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Price</div>
            <div className="text-xl font-bold text-gray-900">${sub.price.toFixed(2)}<span className="text-sm font-normal text-gray-400">{priceLabel}</span></div>
            {sub.renewalMethod === 'annual' && <div className="text-xs text-gray-400 mt-0.5">${billingAmount.toFixed(2)}/yr total</div>}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Scans</div>
            <div className="text-xl font-bold text-gray-900">{sub.totalScans}</div>
            {sub.lastScannedAt && <div className="text-xs text-gray-400 mt-0.5">Last: {formatDate(sub.lastScannedAt)}</div>}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{isActive ? 'Renews' : isGrace ? 'Grace Ends' : 'Expired'}</div>
            {sub.gracePeriodEndsAt ? (
              <>
                <div className={`text-xl font-bold ${isGrace ? 'text-amber-600' : 'text-red-500'}`}>{formatDate(sub.gracePeriodEndsAt)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{daysUntil(sub.gracePeriodEndsAt)} days left</div>
              </>
            ) : sub.freePeriodEndsAt ? (
              <>
                <div className="text-xl font-bold text-gray-900">{formatDate(sub.freePeriodEndsAt)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{daysUntil(sub.freePeriodEndsAt)} days left</div>
              </>
            ) : (
              <div className="text-xl font-bold text-gray-900">{formatDate(sub.currentPeriodEnd)}</div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Subscription Timeline</h3>
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-100" />
            <div className="space-y-4">
              <div className="flex items-start gap-3 relative">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center ring-4 ring-white z-10">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Purchased</div>
                  <div className="text-xs text-gray-500">{formatDate(sub.startDate)} · {sub.productName || sub.planName} ({sub.renewalMethod})</div>
                </div>
              </div>
              {sub.freePeriodEndsAt && (
                <div className="flex items-start gap-3 relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10 ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#16a34a' : '#9ca3af'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Free Period Ends</div>
                    <div className="text-xs text-gray-500">{formatDate(sub.freePeriodEndsAt)}</div>
                  </div>
                </div>
              )}
              {sub.gracePeriodEndsAt && (
                <div className="flex items-start gap-3 relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10 ${isGrace ? 'bg-amber-100' : 'bg-gray-100'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isGrace ? '#d97706' : '#9ca3af'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Grace Period</div>
                    <div className={`text-xs ${isGrace ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>{formatDate(sub.gracePeriodEndsAt)} · {daysUntil(sub.gracePeriodEndsAt)} days remaining</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 relative">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10 ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#2563eb' : '#9ca3af'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{isActive ? 'Auto-renew' : 'Renewal'}</div>
                  <div className="text-xs text-gray-500">{sub.autoRenew ? `Auto-renew is on · next billing ${formatDate(sub.nextPaymentDate || sub.currentPeriodEnd)}` : 'Auto-renew is off'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions</h3>
          <div className="flex flex-wrap gap-3">
            {(isExpired || isGrace) && (
              <button
                onClick={() => handleRenew(sub._id)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                Renew — ${sub.price.toFixed(2)}{priceLabel}
              </button>
            )}
            {isActive && (
              <>
                <button
                  onClick={() => handleToggleAutoRenew(sub._id, sub.autoRenew)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all"
                >
                  {sub.autoRenew ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><circle cx="12" cy="5" r="2"/><line x1="12" x2="12" y1="7" y2="3"/></svg> Pause Auto-renew</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><circle cx="12" cy="5" r="2"/><line x1="12" x2="12" y1="3" y2="7"/></svg> Enable Auto-renew</>
                  )}
                </button>
                <button
                  onClick={() => setShowChangePlan(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                  Change Plan
                </button>
                <button
                  onClick={() => handleCancel(sub._id)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Invoices</h3>
            </div>
            <span className="text-xs text-gray-400">{detail.invoices.length} total</span>
          </div>
          {detail.invoices.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <svg className="mx-auto mb-2 text-gray-200" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
              <p className="text-sm text-gray-400">No invoices yet</p>
            </div>
          ) : (
            <div>
              {detail.invoices.map((inv) => {
                const start = inv.periodStart || inv.billingPeriod?.start;
                const end = inv.periodEnd || inv.billingPeriod?.end;
                return (
                  <div key={inv._id} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${inv.status === 'paid' ? 'bg-emerald-50' : inv.status === 'pending' ? 'bg-amber-50' : 'bg-red-50'}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={inv.status === 'paid' ? '#059669' : inv.status === 'pending' ? '#d97706' : '#dc2626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</div>
                        <div className="text-xs text-gray-400">
                          {start && end ? <>{formatDate(start)} — {formatDate(end)}</> : inv.paidAt ? <>Paid {formatDate(inv.paidAt)}</> : 'Date unavailable'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">${inv.amount.toFixed(2)}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : inv.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {inv.status === 'paid' && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          {inv.status}
                        </span>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await api.post(`/customer/invoices/${inv._id}/access`);
                            if (res.data.success) window.open(res.data.data.secureUrl, '_blank');
                          } catch {}
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Change Plan Modal */}
        {showChangePlan && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Change Plan</h3>
              <p className="text-sm text-gray-500 mb-5">Choose your new plan. Changes take effect at the next billing cycle.</p>
              <div className="space-y-3">
                <button
                  onClick={() => handleChangePlan(sub._id, 'annual')}
                  disabled={actionLoading || sub.planType === 'annual'}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${sub.planType === 'annual' ? 'border-teal-500 bg-teal-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'} disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">Annual Plan</div>
                    {sub.planType === 'annual' && <span className="text-xs font-bold text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">CURRENT</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Billed annually</div>
                </button>
                <button
                  onClick={() => handleChangePlan(sub._id, 'monthly')}
                  disabled={actionLoading || sub.planType === 'monthly'}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${sub.planType === 'monthly' ? 'border-teal-500 bg-teal-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'} disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">Monthly Plan</div>
                    {sub.planType === 'monthly' && <span className="text-xs font-bold text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">CURRENT</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Billed monthly</div>
                </button>
              </div>
              <button onClick={() => setShowChangePlan(false)} className="w-full mt-4 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (selectedId && detailLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <button onClick={() => { setSelectedId(null); setDetail(null); }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Subscriptions
        </button>
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-gray-400">
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span className="text-sm">Loading subscription details...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Subscriptions</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your PawTag subscriptions and billing</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-gray-400">
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span className="text-sm">Loading subscriptions...</span>
          </div>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
          <svg className="mx-auto mb-3 text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          <p className="text-gray-500 font-medium">No subscriptions yet</p>
          <p className="text-sm text-gray-400 mt-1">Subscribe when you purchase a PawTag product</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const isActive = sub.status === 'active';
            const isGrace = sub.status === 'grace_period';
            const isExpired = sub.status === 'expired';
            return (
              <div
                key={sub._id}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all duration-200"
              >
                <div
                  onClick={() => { setSelectedId(sub._id); fetchDetail(sub._id); }}
                  className="p-5 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-50' : isGrace ? 'bg-amber-50' : 'bg-gray-50'}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#059669' : isGrace ? '#d97706' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 text-sm">{sub.tagId?.tagId || 'N/A'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${isActive ? 'bg-emerald-50 text-emerald-700' : isGrace ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {sub.status.replace('_', ' ')}
                          </span>
                        </div>
                        {sub.petName && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            <span className="font-medium text-gray-700">{sub.petName}</span>
                            {sub.petType && <span className="text-gray-400"> · {sub.petType}</span>}
                            <span className="text-gray-300 mx-1">·</span>
                            <span>{sub.productName || sub.planName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">${sub.price.toFixed(2)}<span className="text-xs font-normal text-gray-400">{sub.renewalMethod === 'annual' ? '/yr' : '/mo'}</span></div>
                      <div className="text-xs text-gray-400 mt-0.5">{sub.totalScans} scans</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        {formatDate(sub.startDate)}
                      </span>
                      <span className={`flex items-center gap-1 ${sub.autoRenew ? 'text-emerald-500' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        {sub.autoRenew ? 'Auto-renew on' : 'Auto-renew off'}
                      </span>
                      {sub.gracePeriodEndsAt && (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Grace ends {formatDate(sub.gracePeriodEndsAt)}
                        </span>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-gray-400 transition-colors"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
                {(isGrace || isExpired) && (
                  <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-100/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span>{isGrace && sub.gracePeriodEndsAt ? `Grace period ends ${formatDate(sub.gracePeriodEndsAt)}` : 'Subscription expired'}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenew(sub._id); }}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                      Renew — ${sub.price.toFixed(2)}{sub.renewalMethod === 'annual' ? '/yr' : '/mo'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
