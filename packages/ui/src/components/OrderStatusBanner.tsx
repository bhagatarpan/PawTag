import React from 'react';
import { XCircle, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getOrderRefundDisplay,
  type OrderRefundDisplay,
} from '@pawtag/shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OrderStatusBannerProps {
  status: string;
  amount?: number;
  refundDisplay?: OrderRefundDisplay;
  refundStatus?: string | null;
  refundAmount?: number | null;
  destinationLabel?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Status Config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, {
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  icon: LucideIcon;
  message: (amount?: number, refundAmount?: number | null, destinationLabel?: string) => string;
}> = {
  cancelled: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
    icon: XCircle,
    message: () => 'This order has been cancelled',
  },
  refunded: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    iconColor: 'text-green-500',
    icon: CheckCircle,
    message: (amount) => amount
      ? `Refund of $${amount.toFixed(2)} has been processed`
      : 'This order has been refunded',
  },
  partial: {
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-600',
    icon: AlertTriangle,
    message: (_amount, refundAmount, destinationLabel) => {
      const amt = refundAmount != null ? ` $${refundAmount.toFixed(2)}` : '';
      const dest = destinationLabel ? ` · ${destinationLabel}` : '';
      return `Partially refunded${amt}${dest}`;
    },
  },
  'full_pending': {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
    icon: RefreshCw,
    message: (_amount, refundAmount) => {
      const amt = refundAmount != null ? `$${refundAmount.toFixed(2)} ` : '';
      return `${amt}Refund processing — usually 5–10 business days`;
    },
  },
  'full_failed': {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
    icon: XCircle,
    message: () => 'Refund failed — support will arrange another method',
  },
  'full_canceled': {
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    iconColor: 'text-gray-400',
    icon: XCircle,
    message: () => 'Refund canceled',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OrderStatusBanner({
  status,
  amount,
  refundDisplay,
  refundStatus,
  refundAmount,
  destinationLabel,
  className,
}: OrderStatusBannerProps) {
  // Prefer explicit refund display when provided; fall back to order.status terminal states
  const display: OrderRefundDisplay =
    refundDisplay ||
    getOrderRefundDisplay({ status, refundStatus });

  // Cancelled without refund fields still uses cancelled banner
  const configKey =
    display !== 'none' && status !== 'cancelled'
      ? display
      : status === 'cancelled' && display !== 'none'
        ? display
        : status;

  const config = STATUS_CONFIG[configKey] || STATUS_CONFIG[status];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <div
      className={`${config.bgColor} border ${config.borderColor} rounded-lg p-3 flex items-center gap-2 ${className || ''}`}
    >
      <Icon size={16} className={`${config.iconColor} shrink-0`} />
      <span className={`text-sm font-medium ${config.textColor}`}>
        {config.message(amount, refundAmount, destinationLabel)}
      </span>
    </div>
  );
}

export default OrderStatusBanner;
