import React from 'react';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Check,
  Clock,
  XCircle,
  CreditCard,
  MapPin,
  FileText,
  ExternalLink,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { OrderProgressStepper } from './OrderProgressStepper';
import { OrderStatusBanner } from './OrderStatusBanner';
import type {
  OrderData,
  InvoiceData,
  OrderDetailViewProps,
  BadgeVariant,
} from '../types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning',
  pending_payment: 'warning',
  paid: 'primary',
  packing: 'primary',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'success',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  if (!trackingNumber || !carrier) return '';
  const c = carrier.toLowerCase();
  if (c.includes('nz post') || c.includes('nzpost'))
    return `https://www.nzpost.co.nz/tools/tracking/result?trackid=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('courierpost') || c.includes('courier post'))
    return `https://www.courierpost.co.nz/tracking/${encodeURIComponent(trackingNumber)}`;
  if (c.includes('aramex'))
    return `https://www.aramex.co.nz/track/shipment?ShipmentNumber=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('dhl'))
    return `https://www.dhl.com/nz-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`;
  return '';
}

/* ------------------------------------------------------------------ */
/*  Card Brand SVG Icons                                                */
/* ------------------------------------------------------------------ */

function CardBrandIcon({ brand }: { brand: string }) {
  const b = brand.toLowerCase();
  if (b === 'visa') {
    return (
      <svg viewBox="0 0 48 32" width="32" height="20" className="inline-block">
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <text x="24" y="20" textAnchor="middle" fill="#fff" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="700" fontStyle="italic">VISA</text>
      </svg>
    );
  }
  if (b === 'mastercard') {
    return (
      <svg viewBox="0 0 48 32" width="32" height="20" className="inline-block">
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="9" fill="#EB001B" />
        <circle cx="29" cy="16" r="9" fill="#F79E1B" />
        <path d="M24 9.3a9 9 0 010 13.4 9 9 0 000-13.4z" fill="#FF5F00" />
      </svg>
    );
  }
  if (b === 'amex' || b === 'american_express') {
    return (
      <svg viewBox="0 0 48 32" width="32" height="20" className="inline-block">
        <rect width="48" height="32" rx="4" fill="#006FCF" />
        <text x="24" y="20" textAnchor="middle" fill="#fff" fontFamily="system-ui,sans-serif" fontSize="9" fontWeight="700">AMEX</text>
      </svg>
    );
  }
  // Default: generic card icon
  return (
    <svg viewBox="0 0 48 32" width="32" height="20" className="inline-block">
      <rect width="48" height="32" rx="4" fill="#6B7280" />
      <rect x="4" y="8" width="40" height="4" rx="1" fill="#fff" opacity="0.5" />
      <rect x="4" y="18" width="16" height="3" rx="1" fill="#fff" opacity="0.4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-Components                                                     */
/* ------------------------------------------------------------------ */

function getStepLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    pending_payment: 'Pending Payment',
    paid: 'Paid',
    packing: 'Packing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };
  return labels[status] || status;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered': return <CheckCircle size={16} />;
    case 'shipped': return <Truck size={16} />;
    case 'paid': return <CreditCard size={16} />;
    case 'packing': return <Package size={16} />;
    case 'pending': return <Clock size={16} />;
    case 'pending_payment': return <Clock size={16} />;
    case 'cancelled': return <XCircle size={16} />;
    case 'refunded': return <CheckCircle size={16} />;
    default: return <Clock size={16} />;
  }
}

function OrderHeader({
  order,
  onBackToOrders,
}: {
  order: OrderData;
  onBackToOrders?: () => void;
}) {
  const variant = STATUS_BADGE_VARIANT[order.status] || 'neutral';
  const label = getStepLabel(order.status);

  return (
    <div className="flex items-start justify-between">
      <div>
        {onBackToOrders && (
          <button
            onClick={onBackToOrders}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900">
          Order {order.orderNumber || `#${order._id.slice(-8).toUpperCase()}`}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Placed on {formatDateTime(order.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {order.payment?.status && (
          <StatusBadge
            label={order.payment.status === 'completed' ? 'Payment Confirmed' : order.payment.status === 'refunded' ? 'Refunded' : order.payment.status === 'pending' ? 'Awaiting Payment' : order.payment.status}
            variant={order.payment.status === 'completed' ? 'success' : order.payment.status === 'refunded' ? 'neutral' : order.payment.status === 'pending' ? 'warning' : 'danger'}
          />
        )}
        <StatusBadge
          label={label}
          variant={variant}
          icon={getStatusIcon(order.status)}
        />
      </div>
    </div>
  );
}

function OrderItemsList({ order }: { order: OrderData }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Items</h2>
      <div className="space-y-4">
        {order.items?.map((item, i) => (
          <div key={i} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
            {item.image ? (
              <img src={item.image} alt={item.productName} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900">{item.productName}</h3>
              {item.variantName && (
                <p className="text-sm text-gray-500">{item.variantName}</p>
              )}
              {item.petName && (
                <p className="text-sm text-primary-600">For: {item.petName}</p>
              )}
              {item.sku && (
                <p className="text-xs text-gray-400 mt-1">SKU: {item.sku}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">${item.totalPrice.toFixed(2)}</p>
              <p className="text-xs text-gray-500">
                Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}
              </p>
              {item.customizationTotal ? (
                <p className="text-xs text-primary-600">
                  +${item.customizationTotal.toFixed(2)} engraving
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentInformationCard({ order }: { order: OrderData }) {
  if (!order.payment) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment Information</h2>
      <div className="space-y-3">
        {order.payment.cardBrand && (
          <div className="flex items-center gap-3">
            <CardBrandIcon brand={order.payment.cardBrand} />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Paid via {order.payment.cardBrand.charAt(0).toUpperCase() + order.payment.cardBrand.slice(1)}{' '}
                &bull;&bull;&bull;&bull; {order.payment.cardLast4 || '****'}
              </p>
            </div>
          </div>
        )}
        {!order.payment.cardBrand && (
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-gray-400" />
            <p className="text-sm font-medium text-gray-900">
              Paid via {order.payment.method || 'Card'}
            </p>
          </div>
        )}
        {order.payment.stripePaymentIntentId && (
          <p className="text-xs text-gray-500">
            Transaction ID: <span className="font-mono">{order.payment.stripePaymentIntentId}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function OrderSummaryCard({ order }: { order: OrderData }) {
  const subtotal = order.subtotal ?? order.items?.reduce((s, i) => s + (i.totalPrice || 0), 0) ?? order.payment?.amount ?? 0;
  const shipping = order.shippingCost ?? 0;
  const tax = order.tax ?? 0;
  const discount = order.discount?.amount ?? 0;
  const total = order.payment?.amount ?? order.totalAmount ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-1.5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Summary</h2>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal:</span>
          <span className="text-gray-900 font-medium">NZ${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Shipping:</span>
          <span className={shipping === 0 ? 'text-primary-600 font-medium' : 'text-gray-900 font-medium'}>
            {shipping === 0 ? 'Free' : `NZ$${shipping.toFixed(2)}`}
          </span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Discount:</span>
            <span className="text-primary-600 font-medium">-NZ${discount.toFixed(2)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">GST (15%):</span>
            <span className="text-gray-900 font-medium">NZ${tax.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
          <span className="font-semibold text-gray-900">Total:</span>
          <span className="font-bold text-primary-700 text-base">NZ${total.toFixed(2)} NZD</span>
        </div>
      </div>
    </div>
  );
}

function InvoiceCard({
  invoice,
  onViewInvoice,
}: {
  invoice: InvoiceData;
  onViewInvoice?: () => void;
}) {
  const statusVariant: BadgeVariant =
    invoice.status === 'paid'
      ? 'success'
      : invoice.status === 'pending'
      ? 'warning'
      : invoice.status === 'refunded'
      ? 'danger'
      : 'neutral';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4" /> Invoice
      </h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Invoice #</span>
          <span className="font-mono font-medium text-gray-900">{invoice.invoiceNumber}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Status:</span>
          <StatusBadge
            label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            variant={statusVariant}
            size="sm"
          />
        </div>
      </div>
      {onViewInvoice && (
        <button
          onClick={onViewInvoice}
          className="w-full mt-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
        >
          <FileText size={14} />
          View Invoice
          <ExternalLink size={12} />
        </button>
      )}
    </div>
  );
}

function ShippingAddressCard({
  order,
  contactPhone,
  contactEmail,
}: {
  order: OrderData;
  contactPhone?: string;
  contactEmail?: string;
}) {
  if (!order.shippingAddress) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4" /> Shipping Address
      </h2>
      <div className="text-sm text-gray-600 space-y-0.5">
        <p>{order.shippingAddress.line1}</p>
        {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
        <p>
          {order.shippingAddress.city}
          {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''}{' '}
          {order.shippingAddress.zip}
        </p>
        <p>{order.shippingAddress.country}</p>
      </div>
      {(contactPhone || contactEmail) && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
          {contactPhone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              {contactPhone}
            </div>
          )}
          {contactEmail && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-3.5 w-3.5 text-gray-400" />
              {contactEmail}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderActions({
  order,
  onRequestReturn,
  onCancelOrder,
}: {
  order: OrderData;
  onRequestReturn?: () => void;
  onCancelOrder?: () => void;
}) {
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  if (isCancelled) return null;

  const showReturn = order.status === 'delivered' || order.status === 'paid' || order.status === 'packing';
  const showCancel = order.status === 'paid' || order.status === 'packing';

  if (!showReturn && !showCancel) return null;

  return (
    <div className="flex gap-3">
      {showReturn && onRequestReturn && (
        <button
          onClick={onRequestReturn}
          className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          <Package size={14} />
          Request Return
        </button>
      )}
      {showCancel && onCancelOrder && (
        <button
          onClick={onCancelOrder}
          className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
        >
          <XCircle size={14} />
          Cancel Order
        </button>
      )}
    </div>
  );
}

function CancellationInfoCard({ order }: { order: OrderData }) {
  if (order.status !== 'cancelled') return null;
  if (!order.cancelledBy && !order.cancellationReason && !order.cancelledByDescription) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
        <XCircle size={16} />
        Cancellation Details
      </h3>
      <div className="space-y-2 text-sm">
        {order.cancelledByDescription && (
          <div className="text-red-800">{order.cancelledByDescription}</div>
        )}
        {order.cancelledBy && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Cancelled by</span>
            <span className="text-red-900 font-medium text-right">{order.cancelledBy}</span>
          </div>
        )}
        {order.cancelledByType && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Role</span>
            <span className="text-red-900 font-medium">{order.cancelledByType}</span>
          </div>
        )}
        {order.cancelledByPortal && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Portal</span>
            <span className="text-red-900 font-medium">
              {order.cancelledByPortal === 'customer-web' && 'Customer Web Portal'}
              {order.cancelledByPortal === 'customer-mobile' && 'Customer Mobile App'}
              {order.cancelledByPortal === 'admin-web' && 'Admin Web Portal'}
              {order.cancelledByPortal === 'system' && 'System (Auto)'}
            </span>
          </div>
        )}
        {order.cancellationReason && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Reason</span>
            <span className="text-red-900 font-medium text-right">{order.cancellationReason}</span>
          </div>
        )}
        {order.cancellationNotes && (
          <div className="pt-2 border-t border-red-200">
            <div className="text-red-700 text-xs uppercase tracking-wide mb-1">Additional notes</div>
            <div className="text-red-900">{order.cancellationNotes}</div>
          </div>
        )}
        {order.cancelledAt && (
          <div className="flex justify-between gap-4 pt-2 border-t border-red-200">
            <span className="text-red-700">Cancelled at</span>
            <span className="text-red-900 font-medium">{formatDateTime(order.cancelledAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RefundStatusCard({ order }: { order: OrderData }) {
  if (order.status !== 'cancelled' && order.status !== 'refunded') return null;
  if (!order.refundStatus) return null;

  const statusConfig: Record<string, { label: string; bg: string; border: string; text: string; icon: any }> = {
    pending: { label: 'Refund Processing', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Clock },
    succeeded: { label: 'Refund Succeeded', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: CheckCircle },
    failed: { label: 'Refund Failed', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: XCircle },
    canceled: { label: 'Refund Canceled', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: XCircle },
  };

  const config = statusConfig[order.refundStatus] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={`${config.bg} ${config.border} border rounded-2xl p-5`}>
      <h3 className={`text-sm font-semibold ${config.text} mb-3 flex items-center gap-2`}>
        <Icon size={16} />
        {config.label}
      </h3>
      <div className="space-y-2 text-sm">
        {order.refundId && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Refund ID</span>
            <span className="text-gray-900 font-mono text-xs">{order.refundId}</span>
          </div>
        )}
        {order.refundArn && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">ARN (Bank Ref)</span>
            <span className="text-gray-900 font-mono text-xs">{order.refundArn}</span>
          </div>
        )}
        {order.refundExpectedArrival && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Expected arrival</span>
            <span className="text-gray-900">{formatDateTime(order.refundExpectedArrival)}</span>
          </div>
        )}
        {order.refundSettledAt && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Settled at</span>
            <span className="text-gray-900">{formatDateTime(order.refundSettledAt)}</span>
          </div>
        )}
        {order.refundFailureReason && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Failure reason</span>
            <span className="text-red-700 text-right">{order.refundFailureReason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function OrderDetailView({
  order,
  invoice,
  onViewInvoice,
  onRequestReturn,
  onCancelOrder,
  onBackToOrders,
  contactPhone,
  contactEmail,
  className,
}: OrderDetailViewProps) {
  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <OrderHeader order={order} onBackToOrders={onBackToOrders} />

      {/* Progress Stepper or Status Banner */}
      {['cancelled', 'refunded'].includes(order.status) ? (
        <OrderStatusBanner status={order.status} amount={order.payment?.amount} />
      ) : (
        <OrderProgressStepper status={order.status} variant="full" />
      )}

      {/* Refund pending card — shown when order is cancelled but payment hasn't been refunded yet */}
      {order.status === 'cancelled' && order.payment?.status === 'completed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw size={20} className="text-amber-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-amber-800">Refund Pending</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Your payment of ${(order.payment?.amount ?? 0).toFixed(2)} has been captured but not yet refunded. Contact support to process your refund.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column: Items + Summary */}
        <div className="lg:col-span-3 space-y-6">
          <OrderItemsList order={order} />
          <OrderSummaryCard order={order} />
        </div>

        {/* Right column: Payment, Invoice, Address, Actions */}
        <div className="lg:col-span-2 space-y-6">
          <PaymentInformationCard order={order} />
          {invoice && (
            <InvoiceCard invoice={invoice} onViewInvoice={onViewInvoice} />
          )}
          <ShippingAddressCard
            order={order}
            contactPhone={contactPhone}
            contactEmail={contactEmail}
          />
          <OrderActions
            order={order}
            onRequestReturn={onRequestReturn}
            onCancelOrder={onCancelOrder}
          />
          <CancellationInfoCard order={order} />
          <RefundStatusCard order={order} />
        </div>
      </div>
    </div>
  );
}
