import React from 'react';
import { XCircle } from 'lucide-react';

export interface CancellationInfoData {
  status: string;
  cancelledBy?: string;
  cancelledByType?: string;
  cancelledByPortal?: string;
  cancelledByDescription?: string;
  cancellationReason?: string;
  cancellationNotes?: string;
  cancelledAt?: string;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-NZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function portalLabel(portal: string) {
  switch (portal) {
    case 'customer-web': return 'Customer Web Portal';
    case 'customer-mobile': return 'Customer Mobile App';
    case 'admin-web': return 'Admin Web Portal';
    case 'system': return 'System (Auto)';
    default: return portal;
  }
}

export function CancellationInfoCard({ data }: { data: CancellationInfoData }) {
  if (data.status !== 'cancelled') return null;
  if (!data.cancelledBy && !data.cancellationReason && !data.cancelledByDescription) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
        <XCircle size={16} />
        Cancellation Details
      </h3>
      <div className="space-y-2 text-sm">
        {data.cancelledByDescription && (
          <div className="text-red-800">{data.cancelledByDescription}</div>
        )}
        {data.cancelledBy && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Cancelled by</span>
            <span className="text-red-900 font-medium text-right">{data.cancelledBy}</span>
          </div>
        )}
        {data.cancelledByType && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Role</span>
            <span className="text-red-900 font-medium">{data.cancelledByType}</span>
          </div>
        )}
        {data.cancelledByPortal && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Portal</span>
            <span className="text-red-900 font-medium">{portalLabel(data.cancelledByPortal)}</span>
          </div>
        )}
        {data.cancellationReason && (
          <div className="flex justify-between gap-4">
            <span className="text-red-700">Reason</span>
            <span className="text-red-900 font-medium text-right">{data.cancellationReason}</span>
          </div>
        )}
        {data.cancellationNotes && (
          <div className="pt-2 border-t border-red-200">
            <div className="text-red-700 text-xs uppercase tracking-wide mb-1">Additional notes</div>
            <div className="text-red-900">{data.cancellationNotes}</div>
          </div>
        )}
        {data.cancelledAt && (
          <div className="flex justify-between gap-4 pt-2 border-t border-red-200">
            <span className="text-red-700">Cancelled at</span>
            <span className="text-red-900 font-medium">{formatDateTime(data.cancelledAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
