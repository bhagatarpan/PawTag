import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Loader2 } from 'lucide-react';
import { OrderDetailView } from '@pawtag/ui';
import type { OrderData, InvoiceData } from '@pawtag/ui';
import api from '../../lib/api';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  }, [id]);

  // 30s polling — pauses when tab is hidden
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

  const handleCancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this order? A full refund will be processed.')) return;
    try {
      const res = await api.post(`/customer/returns/orders/${order._id}/cancel`, { reason: 'Cancelled by customer' });
      if (res.data.success) {
        alert('Order cancelled and refund initiated. You should see the refund in 5-10 business days.');
        fetchOrder();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  return (
    <OrderDetailView
      order={order}
      invoice={invoice}
      onViewInvoice={handleViewInvoice}
      onRequestReturn={() => navigate(`/account/orders/${order._id}/return`)}
      onCancelOrder={handleCancelOrder}
      onBackToOrders={() => navigate('/account/orders')}
    />
  );
}
