import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Loader2 } from 'lucide-react';
import { OrderDetailView, ConfirmDialog } from '@pawtag/ui';
import type { OrderData, InvoiceData } from '@pawtag/ui';
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

  const fetchOrder = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/customer/orders/${id}`);
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

    api.get(`/customer/orders/${id}/invoice`)
      .then((res) => setInvoice(res.data.data))
      .catch(() => {});

    api.get('/public/commerce/cancellation-reasons')
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
      const res = await api.post(`/customer/invoices/${invoice._id}/access`);
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
      await api.post(`/customer/returns/orders/${order._id}/cancel`, {
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
