import React from 'react';
import { ShoppingCart, Check, PawPrint } from 'lucide-react';

export interface ProductCardProduct {
  id: string;
  name: string;
  shortDescription?: string;
  price: number;
  currency?: string;
  image?: string;
  sku: string;
  stock: number;
  monthlyPrice?: number;
  badge?: { label: string; color: string } | null;
  features?: string[];
}

export interface ProductCardProps {
  product: ProductCardProduct;
  onAddToCart?: (product: ProductCardProduct) => void;
  onDetails?: (product: ProductCardProduct) => void;
  added?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  onAddToCart,
  onDetails,
  added = false,
  disabled = false,
  className = '',
}: ProductCardProps) {
  const isOutOfStock = product.stock <= 0;
  const isHighlight = product.badge?.label === 'Most Ordered';

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300 overflow-hidden relative ${isHighlight ? 'ring-2 ring-amber-400 scale-[1.02]' : ''} ${className}`}
    >
      {product.badge && (
        <div className={`absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-xs font-bold ${product.badge.color}`}>
          {product.badge.label}
        </div>
      )}

      <div className="relative h-48 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <PawPrint className="h-20 w-20 text-primary-300" />
        )}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{product.name}</h3>
        {product.shortDescription && (
          <p className="text-sm text-gray-500 mb-4">{product.shortDescription}</p>
        )}

        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-primary-700">${product.price.toFixed(2)}</span>
            <span className="text-sm text-gray-500">{product.currency || 'NZD'}</span>
          </div>
          {product.monthlyPrice != null && product.monthlyPrice > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              + ${product.monthlyPrice.toFixed(2)}/mo after 12 months free
            </p>
          )}
        </div>

        {product.features && product.features.length > 0 && (
          <div className="space-y-2 mb-6">
            {product.features.map((feat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {onDetails && (
            <button
              onClick={() => onDetails(product)}
              className="flex-1 py-3 border border-primary-600 text-primary-600 rounded-xl font-medium hover:bg-primary-50 transition-all text-center text-sm"
            >
              Details
            </button>
          )}
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              disabled={isOutOfStock || disabled}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all text-sm ${
                added
                  ? 'bg-green-500 text-white'
                  : isOutOfStock
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              {added ? 'Added!' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
