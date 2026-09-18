import { AlertTriangle } from 'lucide-react';

interface CartIssueBannerProps {
  issues: string[];
}

export default function CartIssueBanner({ issues }: CartIssueBannerProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            {issues.length === 1 ? 'There is an issue with your cart' : 'There are issues with your cart'}
          </p>
          <ul className="mt-1 text-sm text-amber-700 space-y-1">
            {issues.map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
