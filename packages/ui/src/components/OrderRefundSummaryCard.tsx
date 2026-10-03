import React from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, CreditCard } from 'lucide-react';
import {
  getOrderRefundDisplay,
  getRefundDisplayLabel,
  formatRefundDestination,
  type OrderRefundDisplay,
} from '@pawtag/shared';
import { StatusBadge } from './StatusBadge';

export interface OrderRefundSummaryCardProps {
  status?: string;
  refundStatus?: string | null;
  refundAmount?: number | null;
  originalAmount?: number | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  refundId?: string | null;
  refundArn?: string | null;
  expectedArrival?: string | null;
  settledAt?: string | null;
  failureReason?: string | null;
  refundedAt?: string | null;
  destinationLabel?: string;
  /** Admin-only controls (Sync/Retry) */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Shared refund summary for customer order detail and admin order drawer.
 * Shows full or partial refund state — money truth from server order fields.
 */
export function OrderRefundSummaryCard({
  status,
  refundStatus,
  refundAmount,
  originalAmount,
  cardBrand,
  cardLast4,
  refundId,
  refundArn,
  expectedArrival,
  settledAt,
  failureReason,
  refundedAt,
  destinationLabel,
  actions,
  className,
}: OrderRefundSummaryCardProps) {
  const display: OrderRefundDisplay = getOrderRefundDisplay({ status, refundStatus });
  if (display === 'none') return null;

  const destination =
    destinationLabel ||
    formatRefundDestination(cardBrand || undefined, cardLast4 || undefined) ||
    'Original payment method';

  const tone =
    display === 'full_succeeded' ? 'green' :
    display === 'full_failed' ? 'red' :
    display === 'partial' || display === 'full_pending' ? 'amber' : 'gray';

  const toneClasses =
    tone === 'green' ? 'bg-green-50 border-green-200' :
    tone === 'red' ? 'bg-red-50 border-red-200' :
    tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200';

  const Icon =
    display === 'full_succeeded' ? CheckCircle :
    display === 'full_failed' ? XCircle :
    display === 'full_pending' ? RefreshCw : AlertTriangle;

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses} ${className || ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Icon size={16} className="shrink-0" />
          Refund
        </h2>
        <StatusBadge
          label={getRefundDisplayLabel(display, refundStatus)}
          variant={
            display === 'full_succeeded' ? 'success' :
            display === 'full_failed' ? 'danger' :
            display === 'partial' || display === 'full_pending' ? 'warning' : 'neutral'
          }
          size="sm"
        />
      </div>
      <div className="mt-2 space-y-1.5 text-sm text-gray-700">
        {refundAmount != null && (
          <div className="flex justify-between">
            <span className="text-gray-500">
              {display === 'partial' ? 'Refunded so far' : 'Refund amount'}
            </span>
            <span className="font-medium">
              ${Number(refundAmount).toFixed(2)}
              {originalAmount != null && display === 'partial'
                ? ` of $${Number(originalAmount).toFixed(2)}`
                : ''}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Destination</span>
          <span className="font-medium">{destination}</span>
        </div>
        {refundStatus && (
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className="font-medium capitalize">{refundStatus}</span>
          </div>
        )}
        {refundId && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Refund ID</span>
            <span className="font-mono text-xs break-all text-right">{refundId}</span>
          </div>
        )}
        {refundArn && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">ARN</span>
            <span className="font-mono text-xs break-all text-right">{refundArn}</span>
          </div>
        )}
        {expectedArrival && (
          <div className="flex justify-between">
            <span className="text-gray-500">Expected arrival</span>
            <span>{expectedArrival}</span>
          </div>
        )}
        {settledAt && (
          <div className="flex justify-between">
            <span className="text-gray-500">Settled</span>
            <span>{settledAt}</span>
          </div>
        )}
        {refundedAt && (
          <div className="flex justify-between">
            <span className="text-gray-500">Refunded at</span>
            <span>{refundedAt}</span>
          </div>
        )}
        {failureReason && (
          <p className="text-xs text-red-700">{failureReason}</p>
        )}
        {display === 'full_pending' && (
          <p className="text-xs text-gray-500">
            Refunds typically appear on your statement within 5–10 business days.
          </p>
        )}
        {display === 'full_failed' && (
          <p className="text-xs text-red-700">
            Contact support to arrange an alternate refund method.
          </p>
        )}
      </div>
      {actions && <div className="mt-3 pt-3 border-t border-gray-200/60">{actions}</div>}
    </div>
  );
}

export default OrderRefundSummaryCard;
