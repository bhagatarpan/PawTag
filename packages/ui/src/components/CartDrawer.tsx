import React, { useEffect, useRef } from 'react';
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
  customisationTexts?: string[];
  customizable?: boolean;
  customizationLabel?: string;
  customizationPrice?: number;
  customisation?: boolean;
  autoRenew?: boolean;
  isSubscription?: boolean;
  monthlyPrice?: number;
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
  isGuest?: boolean;
  priceChanged?: boolean;
  className?: string;
  /** Points earning info for logged-in Guardian members */
  pointsEarning?: { points: number; isGoldMember?: boolean } | null;
  /** User's Guardian tier */
  guardianTier?: string | null;
  /** Toggle auto-renew for a subscription cart item */
  onToggleAutoRenew?: (itemId: string, autoRenew: boolean) => void;
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
  isGuest = false,
  priceChanged = false,
  className = '',
  pointsEarning = null,
  guardianTier = null,
  onToggleAutoRenew,
}: CartDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: move focus into drawer when opened
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  // Keyboard handling: Escape to close
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            Your Cart ({items.length})
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Guest mode banner */}
        {isGuest && items.length > 0 && (
          <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700" role="status">
            You're shopping as a guest. <strong>Log in</strong> to save your cart and check out.
            <br />
            <a href="/guardian" className="text-primary-600 hover:underline mt-1 inline-block">
              Join Guardian and earn rewards on every purchase
            </a>
          </div>
        )}

        {/* Price changed warning */}
        {priceChanged && (
          <div className="mx-4 mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700" role="status">
            A price in your cart has been updated to reflect current pricing.
          </div>
        )}

        {/* Loyalty messaging */}
        {items.length > 0 && (
          <div className="mx-4 mt-3" role="status">
            {!guardianTier && isGuest ? (
              <div className="px-3 py-2 bg-primary-50 border border-primary-100 rounded-lg text-xs text-primary-700">
                <strong>You could be earning rewards on this purchase.</strong>{' '}
                <a href="/guardian" className="text-primary-600 hover:underline">
                  Join Guardian and start earning Points
                </a>.
              </div>
            ) : pointsEarning && pointsEarning.points > 0 ? (
              <div className={`px-3 py-2 rounded-lg text-xs ${pointsEarning.isGoldMember ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-primary-50 border border-primary-100 text-primary-700'}`}>
                This order could earn you <strong>{pointsEarning.points} Guardian Points</strong>
                {pointsEarning.isGoldMember && ' (Gold 2x)'}.
                {/* Gold upsell for non-Gold Guardian members */}
                {!pointsEarning.isGoldMember && (
                  <a href="/gold" className="text-amber-600 hover:underline ml-1 font-medium">
                    Earn 2× with Gold →
                  </a>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" role="list" aria-label="Cart items">
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
                role="listitem"
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
                  {item.customisationTexts && item.customisationTexts.length > 0 && item.customisationTexts.some(t => t) && (
                    <div className="text-xs text-primary-600">
                      {item.customisationTexts.filter(t => t).map((t, i) => (
                        <p key={i}>Pet name: {t}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-sm font-bold text-primary-700 mt-1">
                    ${(itemPrice * item.quantity).toFixed(2)}
                  </p>
                  {item.isSubscription && item.monthlyPrice != null && onToggleAutoRenew && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-gray-400">Auto-renew</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.autoRenew !== false}
                        aria-label={`Auto-renew for ${itemName}`}
                        onClick={() => onToggleAutoRenew(itemId, item.autoRenew === false)}
                        className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          item.autoRenew !== false ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            item.autoRenew !== false ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => onRemoveItem(itemId)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                    aria-label={`Remove ${itemName} from cart`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateQuantity(itemId, Math.max(1, item.quantity - 1))}
                      disabled={item.quantity <= 1}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Decrease quantity of ${itemName}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium text-gray-700 w-6 text-center" aria-label={`Quantity: ${item.quantity}`}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(itemId, item.quantity + 1)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
                      aria-label={`Increase quantity of ${itemName}`}
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
                className="w-full bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Checkout — ${total.toFixed(2)}
              </button>
            )}
            <a
              href="/cart"
              className="block w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium py-1"
            >
              View Cart
            </a>
            <button
              onClick={onClearCart}
              className="w-full text-sm text-gray-500 hover:text-red-500 transition-colors py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
              aria-label="Clear all items from cart"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
});
