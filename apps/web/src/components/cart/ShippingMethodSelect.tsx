import { Loader2, Truck } from 'lucide-react';

export interface ShippingOption {
  id: string;
  name: string;
  description?: string;
  cost: number;
  estimatedDays?: string;
}

export interface ShippingMethodSelectProps {
  options: ShippingOption[];
  selected?: string;
  onSelect: (option: ShippingOption) => void;
  loading?: boolean;
}

/**
 * Reusable shipping method selection component.
 * Used in Checkout Delivery step.
 *
 * Design tokens from DESIGN.md:
 * - Radio selected: border-primary-500, bg-primary-50
 * - Radio unselected: border-gray-200, hover:border-gray-300
 */
export default function ShippingMethodSelect({
  options,
  selected,
  onSelect,
  loading = false,
}: ShippingMethodSelectProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
        <span className="ml-2 text-sm text-gray-500">Loading shipping options...</span>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="text-center py-6">
        <Truck size={24} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No shipping options available for this address.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label
          key={option.id}
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            selected === option.id
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <input
            type="radio"
            name="shipping-method"
            value={option.id}
            checked={selected === option.id}
            onChange={() => onSelect(option)}
            className="w-4 h-4 text-primary-600 focus:ring-primary-500"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{option.name}</span>
              <span className={`font-semibold ${option.cost === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {option.cost === 0 ? 'FREE' : `$${option.cost.toFixed(2)}`}
              </span>
            </div>
            {option.description && (
              <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
            )}
            {option.estimatedDays && (
              <p className="text-xs text-gray-400 mt-0.5">{option.estimatedDays}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}
