import { useEffect, useState, useCallback, useRef } from 'react';
import api, { PaginatedData } from '../lib/api';
import { toast } from '../lib/toast';
import {
  SummaryCards, SearchBar, FilterChips, Pagination, EmptyState, ErrorState,
  DetailDrawer, Section, DetailRow, StatusBadge, ConfirmDialog,
} from '@pawtag/ui';
import {
  Search, X, ChevronDown, Download, Loader2, ShoppingCart, CreditCard,
  Truck, Package, CheckCircle, AlertCircle, Info, Clock, FileText,
  RefreshCw, Ban, Send, Eye, Printer, Copy, ExternalLink, AlertTriangle, XCircle,
} from 'lucide-react';
import {
  ORDER_STATUS_LABELS,
  getStatusBadgeVariant,
  getStatusBorderColor,
  getTrackingUrl,
} from '@pawtag/shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrderItem {
  productId: string;
  productName: string;
  variantName?: string;
  petName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizationTotal?: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId: { _id: string; fullName: string; email: string } | null;
  items: OrderItem[];
  status: string;
  payment: {
    method: string;
    status: string;
    transactionId?: string;
    amount: number;
    currency: string;
    paidAt?: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  cancellationReason?: string;
  refundReason?: string;
  deliveredAt?: string;
  activity?: Array<{
    type: string;
    message: string;
    timestamp: string;
    actor: 'system' | 'admin' | 'customer';
    metadata?: Record<string, any>;
  }>;
  latestInvoice: {
    _id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
  } | null;
  createdAt: string;
}

interface SummaryData {
  total: number;
  pending: number;
  pendingPayment: number;
  paid: number;
  packing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  refunded: number;
  totalRevenue: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['pending_payment', 'paid', 'cancelled'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['packing', 'cancelled', 'refund_initiated'],
  packing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refund_initiated'],
  cancelled: [],
  refund_initiated: ['refunded'],
  refunded: [],
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'packing', label: 'Packing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refund_initiated', label: 'Refund Initiated' },
  { value: 'refunded', label: 'Refunded' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Credit Card',
  paypal: 'PayPal',
  bank_transfer: 'Bank Transfer',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(amount: number, currency = 'NZD'): string {
  return `${currency} $${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered': return <CheckCircle size={13} />;
    case 'shipped': return <Truck size={13} />;
    case 'paid': return <CreditCard size={13} />;
    case 'packing': return <Package size={13} />;
    case 'pending': return <Clock size={13} />;
    case 'pending_payment': return <Clock size={13} />;
    case 'cancelled': return <Ban size={13} />;
    case 'refund_initiated': return <RefreshCw size={13} />;
    case 'refunded': return <CheckCircle size={13} />;
    default: return <Info size={13} />;
  }
}

function getInvoiceStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'paid': return 'success';
    case 'pending': return 'warning';
    case 'overdue': return 'danger';
    default: return 'neutral';
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-28" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-12" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-gray-200 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

export function OrderDetailDrawer({
  order,
  onClose,
  onRefresh,
}: {
  order: Order | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'shipping' | 'activity'>('info');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!order) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [order, onClose]);

  useEffect(() => {
    if (order) {
      setActiveTab('info');
      setStatusFilter('');
    }
  }, [order]);

  if (!order) return null;

  const availableTransitions = ORDER_STATUS_TRANSITIONS[order.status] || [];

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading('status');
    try {
      await api.put(`/admin/orders/${order._id}/status`, { status: newStatus });
      toast.success(`Order status updated to ${ORDER_STATUS_LABELS[newStatus]}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateShipment = async () => {
    setActionLoading('shipment');
    try {
      const res = await api.post(`/admin/orders/${order._id}/create-shipment`);
      toast.success(`Shipment created — Tracking: ${res.data.data.trackingNumber}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create shipment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkDelivered = async () => {
    setActionLoading('deliver');
    try {
      await api.post(`/admin/orders/${order._id}/mark-delivered`);
      toast.success('Order marked as delivered');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark as delivered');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvoiceAction = async (action: 'view' | 'email' | 'print') => {
    if (!order.latestInvoice) return;
    const id = order.latestInvoice._id;
    setActionLoading(`invoice-${action}`);
    try {
      if (action === 'view') {
        const res = await api.get(`/admin/invoices/${id}/view`);
        if (res.data.success) window.open(res.data.data.secureUrl, '_blank');
      } else if (action === 'email') {
        const res = await api.post(`/admin/invoices/${id}/email`);
        toast.success(res.data.data?.message || 'Invoice emailed');
      } else {
        const res = await api.get(`/admin/invoices/${id}/print`);
        const w = window.open('', '_blank');
        if (w) { w.document.write(res.data); w.document.close(); }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${action} invoice`);
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = [
    { key: 'info' as const, label: 'Order Info' },
    { key: 'items' as const, label: `Items (${order.items?.length || 0})` },
    { key: 'shipping' as const, label: 'Shipping & Payment' },
    { key: 'activity' as const, label: `Activity (${order.activity?.length || 0})` },
  ];

  return (
    <DetailDrawer
      open={!!order}
      onClose={onClose}
      title={`Order ${order.orderNumber}`}
      subtitle={order.userId?.fullName || 'Unknown customer'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as typeof activeTab)}
      headerActions={
        <div className="flex items-center gap-2">
          <StatusBadge
            label={ORDER_STATUS_LABELS[order.status] || order.status}
            variant={getStatusBadgeVariant(order.status)}
            icon={getStatusIcon(order.status)}
          />
        </div>
      }
    >
      {activeTab === 'info' && (
        <div className="space-y-6">
          <Section title="Order Details" icon={<ShoppingCart size={16} />}>
            <DetailRow label="Order Number" value={<span className="font-mono font-medium">{order.orderNumber}</span>} />
            <DetailRow label="Customer" value={order.userId?.fullName || 'N/A'} />
            <DetailRow label="Email" value={order.userId?.email || 'N/A'} />
            <DetailRow label="Status" value={
              <StatusBadge
                label={ORDER_STATUS_LABELS[order.status] || order.status}
                variant={getStatusBadgeVariant(order.status)}
                icon={getStatusIcon(order.status)}
                size="md"
              />
            } />
            <DetailRow label="Items" value={`${order.items?.length || 0} item(s)`} />
            <DetailRow label="Total Amount" value={<span className="font-semibold">{formatCurrency(order.payment.amount, order.payment.currency)}</span>} />
            <DetailRow label="Created" value={formatDateTime(order.createdAt)} />
            {order.deliveredAt && (
              <DetailRow label="Delivered" value={formatDateTime(order.deliveredAt)} />
            )}
            {order.cancellationReason && (
              <DetailRow label="Cancel Reason" value={<span className="text-red-600">{order.cancellationReason}</span>} />
            )}
            {order.refundReason && (
              <DetailRow label="Refund Reason" value={<span className="text-red-600">{order.refundReason}</span>} />
            )}
            {order.notes && (
              <DetailRow label="Notes" value={order.notes} />
            )}
          </Section>

          {order.latestInvoice && (
            <Section title="Invoice" icon={<FileText size={16} />}>
              <DetailRow label="Invoice #" value={<span className="font-mono">{order.latestInvoice.invoiceNumber}</span>} />
              <DetailRow label="Amount" value={formatCurrency(order.latestInvoice.amount)} />
              <DetailRow label="Status" value={
                <StatusBadge
                  label={order.latestInvoice.status}
                  variant={getInvoiceStatusVariant(order.latestInvoice.status)}
                  size="md"
                />
              } />
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleInvoiceAction('view')}
                  disabled={actionLoading === 'invoice-view'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50"
                >
                  {actionLoading === 'invoice-view' ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                  View
                </button>
                <button
                  onClick={() => handleInvoiceAction('email')}
                  disabled={actionLoading === 'invoice-email'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                >
                  {actionLoading === 'invoice-email' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Email
                </button>
                <button
                  onClick={() => handleInvoiceAction('print')}
                  disabled={actionLoading === 'invoice-print'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  {actionLoading === 'invoice-print' ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                  Print
                </button>
              </div>
            </Section>
          )}

          {availableTransitions.length > 0 && (
            <Section title="Actions" icon={<RefreshCw size={16} />}>
              <div className="flex flex-wrap gap-2">
                {availableTransitions.includes('packing') && (
                  <button
                    onClick={() => handleStatusChange('packing')}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <Package size={12} /> Start Packing
                  </button>
                )}
                {availableTransitions.includes('shipped') && (
                  <button
                    onClick={handleCreateShipment}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    {actionLoading === 'shipment' ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
                    Create Shipment
                  </button>
                )}
                {availableTransitions.includes('delivered') && (
                  <button
                    onClick={handleMarkDelivered}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    {actionLoading === 'deliver' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Mark Delivered
                  </button>
                )}
                {availableTransitions.includes('cancelled') && (
                  <button
                    onClick={() => setStatusFilter('cancel')}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <Ban size={12} /> Cancel Order
                  </button>
                )}
                {availableTransitions.includes('refunded') && (
                  <button
                    onClick={() => setStatusFilter('refund')}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50"
                  >
                    <RefreshCw size={12} /> Refund Order
                  </button>
                )}
              </div>
            </Section>
          )}

          {order.trackingNumber && (
            <Section title="Tracking" icon={<Truck size={16} />}>
              <DetailRow label="Tracking #" value={
                <span className="font-mono">{order.trackingNumber}</span>
              } />
              {order.carrier && (
                <DetailRow label="Carrier" value={order.carrier} />
              )}
            </Section>
          )}
        </div>
      )}

      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Product</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Variant</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-500">Qty</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Unit Price</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      {item.petName && (
                        <div className="text-xs text-gray-500">For: {item.petName}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{item.variantName || '—'}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right font-medium text-gray-700">Total:</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(order.payment.amount, order.payment.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'shipping' && (
        <div className="space-y-6">
          <Section title="Shipping Address" icon={<Truck size={16} />}>
            <div className="text-sm text-gray-700 space-y-0.5">
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
              <p>{order.shippingAddress.country}</p>
            </div>
          </Section>

          <Section title="Payment" icon={<CreditCard size={16} />}>
            <DetailRow label="Method" value={PAYMENT_METHOD_LABELS[order.payment.method] || order.payment.method} />
            <DetailRow label="Amount" value={formatCurrency(order.payment.amount, order.payment.currency)} />
            <DetailRow label="Status" value={
              <StatusBadge
                label={order.payment.status}
                variant={order.payment.status === 'completed' ? 'success' : order.payment.status === 'refunded' ? 'danger' : 'warning'}
                size="md"
              />
            } />
            {order.payment.transactionId && (
              <DetailRow label="Transaction ID" value={
                <span className="font-mono text-xs">{order.payment.transactionId}</span>
              } />
            )}
            {order.payment.paidAt && (
              <DetailRow label="Paid At" value={formatDateTime(order.payment.paidAt)} />
            )}
          </Section>

          {order.trackingNumber && (
            <Section title="Shipment" icon={<Package size={16} />}>
              <DetailRow label="Tracking #" value={
                <div className="flex items-center gap-2">
                  <span className="font-mono">{order.trackingNumber}</span>
                  <button onClick={() => copyToClipboard(order.trackingNumber!)} className="text-gray-400 hover:text-gray-600" title="Copy tracking number">
                    <Copy size={12} />
                  </button>
                </div>
              } />
              {order.carrier && <DetailRow label="Carrier" value={order.carrier} />}
              {(() => {
                const url = order.trackingNumber && order.carrier
                  ? getTrackingUrl(order.carrier, order.trackingNumber)
                  : '';
                return url ? (
                  <div className="mt-3">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-all"
                    >
                      <Truck size={14} />
                      Track on {order.carrier}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ) : null;
              })()}
            </Section>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          {order.activity && order.activity.length > 0 ? (
            <>
              {/* Progress Stepper */}
              <div className="relative mb-6">
                <div className="absolute top-[15px] left-[15px] right-[15px] h-1 bg-gray-200 rounded-full" />
                <div className="relative flex justify-between">
                  {['pending', 'paid', 'packing', 'shipped', 'delivered'].map((step, i) => {
                    const STEPS = ['pending', 'paid', 'packing', 'shipped', 'delivered'];
                    // Map order statuses to stepper positions: pending_payment is treated as pending
                    const statusToStep: Record<string, string> = { pending: 'pending', pending_payment: 'pending', paid: 'paid', packing: 'packing', shipped: 'shipped', delivered: 'delivered' };
                    const mappedStatus = statusToStep[order.status] || order.status;
                    const stepIdx = STEPS.indexOf(mappedStatus);
                    const isDone = i <= stepIdx;
                    const isCurrent = i === stepIdx;
                    return (
                      <div key={step} className="flex flex-col items-center" style={{ width: '20%' }}>
                        <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center z-10 text-xs font-bold ${
                          isDone ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-400'
                        } ${isCurrent ? 'ring-2 ring-offset-1 ring-teal-200' : ''}`}>
                          {isDone ? '✓' : i + 1}
                        </div>
                        <span className={`text-[11px] mt-1 font-medium capitalize ${isDone ? 'text-teal-700' : 'text-gray-400'}`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
                <div className="space-y-0">
                  {[...order.activity]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((entry, i) => {
                      const dotColor = entry.type === 'order_placed' ? 'bg-gray-400'
                        : entry.type === 'payment_confirmed' ? 'bg-blue-500'
                        : entry.type === 'packing' ? 'bg-amber-500'
                        : entry.type === 'shipped' ? 'bg-purple-500'
                        : entry.type === 'delivered' ? 'bg-green-500'
                        : entry.type === 'cancelled' ? 'bg-red-500'
                        : entry.type === 'refunded' ? 'bg-orange-500'
                        : 'bg-gray-300';
                      const iconMap: Record<string, any> = {
                        order_placed: Package, payment_confirmed: CreditCard, packing: Package,
                        shipped: Truck, delivered: CheckCircle, cancelled: XCircle, refunded: RefreshCw,
                      };
                      const EntryIcon = iconMap[entry.type] || Clock;
                      return (
                        <div key={i} className="relative flex items-start gap-3 pb-5 last:pb-0">
                          <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${dotColor} ${i === 0 ? 'ring-2 ring-offset-1 ring-teal-200' : ''}`}>
                            <EntryIcon size={14} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className={`text-sm ${i === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                              {entry.message}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-gray-400">
                                {new Date(entry.timestamp).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {' at '}
                                {new Date(entry.timestamp).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <span className="text-xs text-gray-300 capitalize">· {entry.actor}</span>
                            </div>
                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {entry.metadata.trackingNumber && (
                                  <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-mono">
                                    Tracking: {entry.metadata.trackingNumber}
                                  </span>
                                )}
                                {entry.metadata.carrier && (
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                    {entry.metadata.carrier}
                                  </span>
                                )}
                                {entry.metadata.reason && (
                                  <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                                    Reason: {entry.metadata.reason}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No activity recorded yet.</p>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Orders() {
  const [data, setData] = useState<PaginatedData<Order> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionModal, setActionModal] = useState<{ orderId: string; action: 'cancel' | 'refund' } | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/admin/orders', { params });
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/admin/orders', { params: { limit: 1000 } });
      const items: Order[] = res.data.data?.items || [];
      const s: SummaryData = {
        total: res.data.data?.total || 0,
        pending: 0,
        pendingPayment: 0,
        paid: 0,
        packing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        refunded: 0,
        totalRevenue: 0,
      };
      for (const o of items) {
        switch (o.status) {
          case 'pending': s.pending++; break;
          case 'pending_payment': s.pendingPayment++; break;
          case 'paid': s.paid++; break;
          case 'packing': s.packing++; break;
          case 'shipped': s.shipped++; break;
          case 'delivered': s.delivered++; break;
          case 'cancelled': s.cancelled++; break;
          case 'refunded': s.refunded++; break;
        }
        if (o.payment?.status === 'completed') s.totalRevenue += o.payment.amount || 0;
      }
      setSummary(s);
    } catch {
      // Summary is non-critical — silently fail
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders();
      fetchSummary();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchSummary]);

  const executeAction = async () => {
    if (!actionModal || !reason.trim()) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/orders/${actionModal.orderId}/${actionModal.action}`, { reason: reason.trim() });
      toast.success(actionModal.action === 'cancel' ? 'Order cancelled' : 'Order refunded');
      setActionModal(null);
      setReason('');
      fetchOrders();
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    if (!data?.items?.length) return;
    const headers = ['Order #', 'Customer', 'Items', 'Amount', 'Status', 'Payment Method', 'Created'];
    const rows = data.items.map((o) => [
      o.orderNumber,
      o.userId?.fullName || 'N/A',
      o.items?.length || 0,
      o.payment.amount,
      ORDER_STATUS_LABELS[o.status] || o.status,
      PAYMENT_METHOD_LABELS[o.payment.method] || o.payment.method,
      formatDate(o.createdAt),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Orders exported');
  };

  const chips = [];
  if (statusFilter) chips.push({ key: 'status', label: `Status: ${ORDER_STATUS_LABELS[statusFilter] || statusFilter}` });
  if (search.trim()) chips.push({ key: 'search', label: `Search: "${search}"` });

  const handleRemoveChip = (key: string) => {
    if (key === 'status') setStatusFilter('');
    if (key === 'search') { setSearch(''); setPage(1); }
  };

  const handleClearChips = () => {
    setStatusFilter('');
    setSearch('');
    setPage(1);
  };

  const canCancel = (status: string) => ORDER_STATUS_TRANSITIONS[status]?.includes('cancelled');
  const canRefund = (status: string) => ORDER_STATUS_TRANSITIONS[status]?.includes('refunded');
  const canShip = (status: string) => ORDER_STATUS_TRANSITIONS[status]?.includes('shipped');
  const canDeliver = (status: string) => ORDER_STATUS_TRANSITIONS[status]?.includes('delivered');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards cards={[
        { label: 'Total Orders', value: summary?.total, icon: <ShoppingCart size={20} />, color: 'default' },
        { label: 'Pending', value: summary?.pending, icon: <Clock size={20} />, color: 'warning', clickable: !!summary?.pending, onClick: () => { setStatusFilter('pending'); setPage(1); } },
        { label: 'Paid', value: summary?.paid, icon: <CreditCard size={20} />, color: 'primary', clickable: !!summary?.paid, onClick: () => { setStatusFilter('paid'); setPage(1); } },
        { label: 'Shipped', value: summary?.shipped, icon: <Truck size={20} />, color: 'primary', clickable: !!summary?.shipped, onClick: () => { setStatusFilter('shipped'); setPage(1); } },
        { label: 'Delivered', value: summary?.delivered, icon: <CheckCircle size={20} />, color: 'success', clickable: !!summary?.delivered, onClick: () => { setStatusFilter('delivered'); setPage(1); } },
      ]} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <SearchBar
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search by order number..."
            debounceMs={300}
            className="w-full sm:w-72"
          />
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={!data?.items?.length}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <FilterChips chips={chips} onRemove={handleRemoveChip} onClearAll={handleClearChips} />

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchOrders} />}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Order #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Customer</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Items</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Invoice</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<ShoppingCart size={20} className="text-gray-400" />}
                    message="No orders found"
                    description={search || statusFilter ? 'Try adjusting your filters' : 'Orders will appear here once customers start shopping'}
                  />
                </td>
              </tr>
            ) : (
              data?.items.map((order) => (
                <tr
                  key={order._id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-gray-900">{order.orderNumber}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                    {order.userId?.fullName || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {order.items?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(order.payment.amount, order.payment.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={ORDER_STATUS_LABELS[order.status] || order.status}
                      variant={getStatusBadgeVariant(order.status)}
                      icon={getStatusIcon(order.status)}
                    />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {order.latestInvoice ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-gray-600">{order.latestInvoice.invoiceNumber}</span>
                        <StatusBadge
                          label={order.latestInvoice.status}
                          variant={getInvoiceStatusVariant(order.latestInvoice.status)}
                          size="sm"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No invoice</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}

      {/* Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onRefresh={() => { fetchOrders(); fetchSummary(); }}
      />

      {/* Cancel / Refund Modal */}
      {actionModal && (
        <ConfirmDialog
          open={!!actionModal}
          onClose={() => { setActionModal(null); setReason(''); }}
          onConfirm={executeAction}
          title={actionModal.action === 'cancel' ? 'Cancel Order' : 'Refund Order'}
          message={
            actionModal.action === 'cancel'
              ? 'This will cancel the order and restore stock. This action cannot be undone.'
              : 'This will refund the payment via Stripe and mark the order as refunded. This action cannot be undone.'
          }
          confirmLabel={actionModal.action === 'cancel' ? 'Cancel Order' : 'Refund Order'}
          variant={actionModal.action === 'cancel' ? 'danger' : 'warning'}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
