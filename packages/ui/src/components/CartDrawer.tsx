import React from 'react';
import { X, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';

export interface CartItem {
  _id?: string;
  variantId?: string;
  productId?: string;
  name?: string;
  productName?: string;
  price?: number;
  unitPrice?: number;
  quantity: number;
  image?: string;
  petName?: string;
}

export interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onCheckout?: () => void;
  className?: string;
}

export const CartDrawer = React.memo(function CartDrawer({
  open,
  onClose,
  items,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  className = '',
}: CartDrawerProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            Your Cart ({items.length})
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="h-12 w-12 mb-3" />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : (
            items.map((item) => {
              const itemId = item._id || item.variantId || item.productId || '';
              const itemName = item.name || item.productName || 'Item';
              const itemPrice = item.price || item.unitPrice || 0;
              return (
              <div
                key={itemId}
                className="flex gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={itemName} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingCart className="h-6 w-6 text-primary-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{itemName}</h4>
                  {item.petName && (
                    <p className="text-xs text-gray-400">For {item.petName}</p>
                  )}
                  <p className="text-sm font-bold text-primary-700 mt-1">
                    ${(itemPrice * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => onRemoveItem(itemId)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateQuantity(itemId, Math.max(1, item.quantity - 1))}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium text-gray-700 w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(itemId, item.quantity + 1)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Subtotal</span>
              <span className="text-lg font-bold text-gray-900">${total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400">Shipping calculated at checkout</p>
            {onCheckout && (
              <button
                onClick={onCheckout}
                className="w-full bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all"
              >
                Checkout — ${total.toFixed(2)}
              </button>
            )}
            <button
              onClick={onClearCart}
              className="w-full text-sm text-gray-500 hover:text-red-500 transition-colors py-1"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
});
