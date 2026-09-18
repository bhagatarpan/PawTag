import { AlertCircle, RefreshCw } from 'lucide-react';

interface CartPriceChangeBannerProps {
  changes: Array<{
    productName: string;
    oldPrice: number;
    newPrice: number;
  }>;
  onRefresh?: () => void;
}

export default function CartPriceChangeBanner({ changes, onRefresh }: CartPriceChangeBannerProps) {
  if (!changes || changes.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">Price update</p>
          <ul className="mt-1 text-sm text-blue-700 space-y-1">
            {changes.map((change, i) => (
              <li key={i}>
                {change.productName}: ${change.oldPrice.toFixed(2)} → ${change.newPrice.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:text-blue-800 p-1"
            aria-label="Refresh cart"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
