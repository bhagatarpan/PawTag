import { useState, useEffect } from 'react';
import { MapPin, Truck, Loader2 } from 'lucide-react';
import { AddressAutocomplete, type AddressComponents } from '@pawtag/ui';

interface ShippingStepProps {
  shippingAddress: AddressComponents;
  onAddressChange: (address: AddressComponents) => void;
  shippingMethods: Array<{ id: string; name: string; cost: number; description?: string }>;
  selectedShipping: string | null;
  onSelectShipping: (methodId: string, cost: number) => void;
  isGoldMember?: boolean;
  onContinue: () => void;
  onBack: () => void;
}

export default function ShippingStep({
  shippingAddress,
  onAddressChange,
  shippingMethods,
  selectedShipping,
  onSelectShipping,
  isGoldMember,
  onContinue,
  onBack,
}: ShippingStepProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Left 70% - Address + Shipping */}
      <div className="space-y-6">
        {/* Shipping Address */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={20} />
            Shipping Address
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <AddressAutocomplete
                value={shippingAddress.line1}
                onChange={(value) => onAddressChange({ ...shippingAddress, line1: value })}
                onAddressSelect={(address) => onAddressChange(address)}
                placeholder="Start typing your address..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={shippingAddress.city}
                  onChange={(e) => onAddressChange({ ...shippingAddress, city: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                <input
                  type="text"
                  value={shippingAddress.zip}
                  onChange={(e) => onAddressChange({ ...shippingAddress, zip: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Method */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Truck size={20} />
            Shipping Method
          </h2>

          <div className="space-y-3">
            {shippingMethods.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 size={16} className="animate-spin" />
                Loading shipping options...
              </div>
            ) : (
              shippingMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedShipping === method.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      value={method.id}
                      checked={selectedShipping === method.id}
                      onChange={() => onSelectShipping(method.id, method.cost)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{method.name}</p>
                      {method.description && (
                        <p className="text-xs text-gray-500">{method.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">
                    {method.cost === 0 ? 'Free' : `$${method.cost.toFixed(2)}`}
                  </span>
                </label>
              ))
            )}
          </div>

          {isGoldMember && (
            <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
              <span>👑</span> Gold members get free shipping on orders over $50
            </p>
          )}
        </div>
      </div>

      {/* Right 30% - Summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <OrderSummaryPlaceholder onContinue={onContinue} onBack={onBack} />
      </div>
    </div>
  );
}

function OrderSummaryPlaceholder({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
      <p className="text-sm text-gray-500 mb-4">Complete shipping to see your total</p>
      <button
        onClick={onContinue}
        className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
      >
        Continue to Payment
      </button>
      <button
        onClick={onBack}
        className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        Back to Cart
      </button>
    </div>
  );
}
