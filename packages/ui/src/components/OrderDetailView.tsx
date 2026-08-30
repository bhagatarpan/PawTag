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
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type {
  OrderData,
  InvoiceData,
  OrderDetailViewProps,
  BadgeVariant,
} from '../types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ORDER_STATUS_STEPS = ['pending', 'paid', 'packing', 'shipped', 'delivered'];

const STEP_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  packing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning',
  paid: 'primary',
  packing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
};

const STEP_ICON: Record<string, React.FC<{ className?: string }>> = {
  pending: Clock,
  paid: CreditCard,
  packing: Package,
  shipped: Truck,
  delivered: CheckCircle,
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

function OrderHeader({
  order,
  onBackToOrders,
}: {
  order: OrderData;
  onBackToOrders?: () => void;
}) {
  const variant = STATUS_BADGE_VARIANT[order.status] || 'neutral';
  const label = STEP_LABELS[order.status] || order.status;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
        <StatusBadge label={label} variant={variant} size="md" />
      </div>
    </div>
  );
}

function OrderProgressStepper({ order }: { order: OrderData }) {
  const currentStep = ORDER_STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

  if (isCancelled) {
    return (
      <div className={`p-4 rounded-xl border ${
        order.status === 'cancelled'
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-gray-50 border-gray-200 text-gray-700'
      }`}>
        <p className="font-medium">This order has been {order.status}.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-5">Order Progress</h2>

      {/* Stepper */}
      <div className="relative mb-8">
        {/* Track background */}
        <div className="absolute top-[15px] left-[15px] right-[15px] h-1 bg-gray-200 rounded-full" />
        {/* Fill */}
        <div
          className="absolute top-[15px] left-[15px] h-1 bg-primary-500 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `calc(${Math.min(currentStep, ORDER_STATUS_STEPS.length - 1)} / ${ORDER_STATUS_STEPS.length - 1} * (100% - 30px))`,
          }}
        />
        {/* Steps */}
        <div className="relative flex justify-between">
          {ORDER_STATUS_STEPS.map((step, i) => {
            const isDone = i <= currentStep;
            const isCurrent = i === currentStep;
            const StepIcon = STEP_ICON[step] || Clock;
            return (
              <div key={step} className="flex flex-col items-center" style={{ width: `${100 / ORDER_STATUS_STEPS.length}%` }}>
                <div
                  className={`w-[30px] h-[30px] rounded-full flex items-center justify-center z-10 transition-all ${
                    isDone
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  } ${isCurrent ? 'ring-2 ring-offset-2 ring-primary-200' : ''}`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </div>
                <span
                  className={`text-xs mt-2 font-medium text-center capitalize ${
                    isDone ? 'text-primary-700' : 'text-gray-400'
                  }`}
                >
                  {STEP_LABELS[step] || step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status summary */}
      <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
        <CheckCircle className="h-5 w-5 text-primary-600" />
        <div>
          <p className="text-sm font-medium text-primary-800">
            Order Status: <StatusBadge label={STEP_LABELS[order.status] || order.status} variant="primary" size="sm" />
          </p>
          <p className="text-xs text-primary-600 mt-0.5">
            {order.activity && order.activity.length > 0
              ? `${order.activity[0].message} on ${formatDateTime(order.activity[0].timestamp)}`
              : `Order placed and paid on ${formatDateTime(order.createdAt)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function OrderItemsList({ order }: { order: OrderData }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Order Items</h2>
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Order Summary</h2>
      <div className="space-y-2 text-sm">
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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

      {/* Progress Stepper */}
      <OrderProgressStepper order={order} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: Items + Actions */}
        <div className="lg:col-span-3 space-y-6">
          <OrderItemsList order={order} />
          <OrderActions
            order={order}
            onRequestReturn={onRequestReturn}
            onCancelOrder={onCancelOrder}
          />
        </div>

        {/* Right column: Payment, Summary, Invoice, Address */}
        <div className="lg:col-span-2 space-y-6">
          <PaymentInformationCard order={order} />
          <OrderSummaryCard order={order} />
          {invoice && (
            <InvoiceCard invoice={invoice} onViewInvoice={onViewInvoice} />
          )}
          <ShippingAddressCard
            order={order}
            contactPhone={contactPhone}
            contactEmail={contactEmail}
          />
        </div>
      </div>
    </div>
  );
}
