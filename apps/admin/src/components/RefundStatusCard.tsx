import { useState } from 'react';
import { API } from '@pawtag/shared/api';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Copy } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled' | null;

export interface RefundDetails {
  refundId?: string;
  refundArn?: string;
  refundStatus?: RefundStatus;
  refundExpectedArrival?: string;
  refundSettledAt?: string;
  refundLastSyncedAt?: string;
  refundFailureReason?: string;
  refundAttemptCount?: number;
  cancelledBy?: string;
  cancelledByType?: string;
  cancellationReason?: string;
  cancellationNotes?: string;
  cancelledAt?: string;
  cancelledByDescription?: string;
  refundDestination?: string;
  refundAmount?: number;
  paymentCardBrand?: string;
  paymentCardLast4?: string;
}

interface RefundStatusCardProps {
  orderId: string;
  orderNumber: string;
  details: RefundDetails;
  onSynced?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

const STATUS_CONFIG: Record<NonNullable<RefundStatus>, { label: string; icon: any; color: string; bg: string; border: string }> = {
  pending: {
    label: 'Refund Processing',
    icon: Clock,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  succeeded: {
    label: 'Refund Succeeded',
    icon: CheckCircle,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  failed: {
    label: 'Refund Failed',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  canceled: {
    label: 'Refund Canceled',
    icon: AlertTriangle,
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  },
};

export default function RefundStatusCard({
  orderId,
  orderNumber: _orderNumber,
  details,
  onSynced,
  showActions = true,
  compact = false,
}: RefundStatusCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!details.refundStatus) {
    return null;
  }

  const config = STATUS_CONFIG[details.refundStatus] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post(API.admin.commerce.refunds.sync(orderId));
      if (res.data.success) {
        toast.success('Refund synced with Stripe');
        onSynced?.();
      } else {
        toast.error(res.data.error || 'Sync failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await api.post(API.admin.commerce.refunds.retry(orderId));
      if (res.data.success) {
        toast.success('Refund retry initiated');
        onSynced?.();
      } else {
        toast.error(res.data.error || 'Retry failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-NZ', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const destinationLabel = details.refundDestination
    || (details.paymentCardBrand
      ? `${details.paymentCardBrand.charAt(0).toUpperCase() + details.paymentCardBrand.slice(1).toLowerCase()}${details.paymentCardLast4 ? ` ••••${details.paymentCardLast4}` : ''} (original payment method)`
      : 'Original payment method');

  return (
    <div className={`${config.bg} ${config.border} border rounded-2xl p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className={`text-sm font-semibold ${config.color} flex items-center gap-2`}>
          <Icon size={16} />
          {config.label}
        </h3>
        <div className="flex items-center gap-2">
          {showActions && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {syncing ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Sync with Stripe
              </button>
              {details.refundStatus === 'failed' && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {retrying ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Retry
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="text-xs text-gray-600">
          <div className="font-medium text-gray-700">Refund destination</div>
          <div className="text-gray-900">{destinationLabel}</div>
        </div>
        {typeof details.refundAmount === 'number' && details.refundAmount > 0 && (
          <div className="text-sm font-semibold text-gray-900">${details.refundAmount.toFixed(2)}</div>
        )}
      </div>

      {!compact && (
        <div className="space-y-2 text-sm">
          {details.refundId && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Refund ID</span>
              <button
                onClick={() => copyToClipboard(details.refundId!)}
                className="text-gray-900 font-mono text-xs flex items-center gap-1 hover:text-primary-600"
              >
                {details.refundId.slice(0, 16)}...
                <Copy size={10} />
              </button>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Refund destination</span>
            <span className="text-gray-900 text-right">{destinationLabel}</span>
          </div>
          {details.refundArn && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">ARN (Bank Ref)</span>
              <span className="text-gray-900 font-mono text-xs">{details.refundArn}</span>
            </div>
          )}
          {details.refundExpectedArrival && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Expected arrival</span>
              <span className="text-gray-900">{formatDate(details.refundExpectedArrival)}</span>
            </div>
          )}
          {details.refundSettledAt && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Settled at</span>
              <span className="text-gray-900">{formatDate(details.refundSettledAt)}</span>
            </div>
          )}
          {details.refundFailureReason && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Failure reason</span>
              <span className="text-red-700 text-right">{details.refundFailureReason}</span>
            </div>
          )}
          {(details.refundAttemptCount || 0) > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Retry attempts</span>
              <span className="text-gray-900">{details.refundAttemptCount}</span>
            </div>
          )}
          {details.refundLastSyncedAt && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Last synced</span>
              <span className="text-gray-900 text-xs">{formatDate(details.refundLastSyncedAt)}</span>
            </div>
          )}
        </div>
      )}

      {compact && details.refundId && (
        <div className="text-xs text-gray-600 font-mono truncate">Refund ID: {details.refundId}</div>
      )}
    </div>
  );
}
