import { AlertTriangle, RefreshCw } from 'lucide-react';

interface CheckoutBannersProps {
  priceChanged?: boolean;
  inventoryIssue?: string;
  onRefresh?: () => void;
}

export default function CheckoutBanners({ priceChanged, inventoryIssue, onRefresh }: CheckoutBannersProps) {
  if (!priceChanged && !inventoryIssue) return null;

  return (
    <div className="space-y-3 mb-4">
      {priceChanged && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-blue-600" />
            <p className="text-sm text-blue-700">
              A price in your cart has been updated to reflect current pricing.
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-blue-600 hover:text-blue-800 p-1"
              aria-label="Refresh cart"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      )}

      {inventoryIssue && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600" />
          <p className="text-sm text-amber-700">{inventoryIssue}</p>
        </div>
      )}
    </div>
  );
}
