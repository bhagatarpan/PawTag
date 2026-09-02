import React from 'react';
import { XCircle, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OrderStatusBannerProps {
  status: string;
  amount?: number;
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
  message: (amount?: number) => string;
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
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OrderStatusBanner({ status, amount, className }: OrderStatusBannerProps) {
  const config = STATUS_CONFIG[status];

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
        {config.message(amount)}
      </span>
    </div>
  );
}

export default OrderStatusBanner;
