import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Package, Loader2, Shield, Clock, RefreshCw, CheckCircle } from 'lucide-react';
import { OrderDetailView, ConfirmDialog } from '@pawtag/ui';
import type { OrderData, InvoiceData } from '@pawtag/ui';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';

const DEFAULT_REASONS = [
  'Ordered by mistake',
  'Found a better price',
  'Shipping takes too long',
  'Need to change address or payment',
  'Item not as described',
  'Duplicate order',
  'Financial reasons',
  'Other',
];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reasons, setReasons] = useState<string[]>(DEFAULT_REASONS);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  const fetchOrder = async () => {
    if (!id) return;
    try {
      const res = await api.get(API.customer.orders.get(id));
      setOrder(res.data.data);
      setError('');
    } catch (err: any) {
      if (!order) {
        setError(err.response?.data?.error || 'Order not found');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchOrder();

    api.get(API.customer.orders.invoice(id))
      .then((res) => setInvoice(res.data.data))
      .catch(() => {});

    api.get(API.customer.orders.subscriptions(id))
      .then((res) => setSubscriptions(res.data.data || []))
      .catch(() => {});

    api.get(API.public.commerce.cancellationReasons)
      .then((res) => {
        if (Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setReasons(res.data.data);
        }
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const POLL_INTERVAL = 30_000;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchOrder();
        }
      }, POLL_INTERVAL);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOrder();
        startPolling();
      } else if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startPolling();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (interval) clearInterval(interval);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-20">
        <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">{error || 'Order not found'}</h2>
        <button
          onClick={() => navigate('/account/orders')}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          ← Back to Orders
        </button>
      </div>
    );
  }

  const handleViewInvoice = async () => {
    if (!invoice) return;
    try {
      const res = await api.post(API.customer.invoices.access(invoice._id));
      const { secureUrl } = res.data.data;
      if (secureUrl) window.open(secureUrl, '_blank');
    } catch {
      window.open(`/invoice/${invoice._id}`, '_blank');
    }
  };

  const openCancelModal = () => {
    setSelectedReason('');
    setNotes('');
    setCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedReason) return;
    if (selectedReason === 'Other' && !notes.trim()) return;
    setCancelLoading(true);
    try {
      await api.post(API.customer.orders.cancel(order._id), {
        reason: selectedReason,
        notes: selectedReason === 'Other' ? notes : undefined,
        portal: 'customer-web',
      });
      alert('Order cancelled. A refund will be processed within 5–10 business days.');
      setCancelOpen(false);
      fetchOrder();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      <OrderDetailView
        order={order}
        invoice={invoice}
        onViewInvoice={handleViewInvoice}
        onRequestReturn={() => navigate(`/account/orders/${order._id}/return`)}
        onCancelOrder={openCancelModal}
        onBackToOrders={() => navigate('/account/orders')}
      />

      {subscriptions.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" /> Subscriptions
          </h2>
          <div className="space-y-3">
            {subscriptions.map((sub: any) => {
              const isActive = sub.status === 'active';
              const isGrace = sub.status === 'grace_period';
              const isExpired = sub.status === 'expired';
              const isCancelled = sub.status === 'cancelled';
              return (
                <Link
                  key={sub._id}
                  to="/account/subscriptions"
                  className="block p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-50' : isGrace ? 'bg-amber-50' : 'bg-gray-50'}`}>
                        <Shield size={18} className={isActive ? 'text-emerald-600' : isGrace ? 'text-amber-600' : 'text-gray-400'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 text-sm">{sub.tagId?.tagId || sub.planName || 'Subscription'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${isCancelled ? 'bg-gray-100 text-gray-600' : isActive ? 'bg-emerald-50 text-emerald-700' : isGrace ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {sub.status.replace('_', ' ')}
                          </span>
                        </div>
                        {(sub.petName || sub.planId?.name) && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {sub.petName && <span className="font-medium text-gray-700">{sub.petName}</span>}
                            {sub.petType && <span className="text-gray-400"> · {sub.petType}</span>}
                            {(sub.petName || sub.petType) && sub.planId?.name && <span className="text-gray-300 mx-1">·</span>}
                            {sub.planId?.name && <span>{sub.planId.name}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">${sub.planId?.price?.toFixed(2) || '0.00'}<span className="text-xs font-normal text-gray-400">{sub.renewalMethod === 'annual' ? '/yr' : '/mo'}</span></div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        {sub.autoRenew ? <RefreshCw size={10} className="text-emerald-500" /> : <Clock size={10} />}
                        {sub.autoRenew ? 'Auto-renew on' : 'Auto-renew off'}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Order"
        message="Are you sure you want to cancel this order?"
        confirmLabel="Confirm Cancellation"
        variant="danger"
        loading={cancelLoading}
        reasons={reasons}
        selectedReason={selectedReason}
        onReasonChange={setSelectedReason}
        showNotes={selectedReason === 'Other'}
        notesRequired={selectedReason === 'Other'}
        notes={notes}
        onNotesChange={setNotes}
        notesLabel="Additional notes"
        notesPlaceholder="Please provide more detail about why you're cancelling"
        footnote={
          <div>
            <p className="font-medium mb-1">What happens next?</p>
            <ul className="list-disc pl-5 space-y-0.5 text-primary-800">
              <li>A full refund will be processed automatically</li>
              <li>Refunds typically take 5–10 business days to appear on your statement</li>
              <li>Your order status will update to "Cancelled"</li>
            </ul>
          </div>
        }
      />
    </>
  );
}
