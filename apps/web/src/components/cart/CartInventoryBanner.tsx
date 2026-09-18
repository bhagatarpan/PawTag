import { Package, AlertTriangle } from 'lucide-react';

interface CartInventoryBannerProps {
  issues: Array<{
    productName: string;
    requested: number;
    available: number;
  }>;
}

export default function CartInventoryBanner({ issues }: CartInventoryBannerProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <Package size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Availability update</p>
          <ul className="mt-1 text-sm text-amber-700 space-y-1">
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.productName}: {issue.available > 0
                  ? `${issue.available} available (you requested ${issue.requested})`
                  : 'Out of stock'
                }
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
