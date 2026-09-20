import { RefreshCw } from 'lucide-react';

export interface AutoRenewToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  productName?: string;
}

export default function AutoRenewToggle({
  enabled,
  onChange,
  disabled = false,
  productName,
}: AutoRenewToggleProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <RefreshCw size={14} className={enabled ? 'text-primary-600' : 'text-gray-400'} />
        <span className="text-sm text-gray-700">
          Auto-renew
          {productName && <span className="text-gray-500 ml-1">for {productName}</span>}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${
          enabled ? 'bg-primary-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
