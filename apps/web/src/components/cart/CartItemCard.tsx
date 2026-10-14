import { useState } from 'react';
import { Minus, Plus, Trash2, Tag, Loader2, AlertTriangle, Pencil, Check } from 'lucide-react';

interface CartItemCardProps {
  item: {
    _id?: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    image?: string;
    customisation?: boolean;
    customisationTexts?: string[];
    customizationTotal?: number;
    customizationLabel?: string;
    customizable?: boolean;
    customizationPrice?: number;
    autoRenew?: boolean;
    isSubscription?: boolean;
    /** Stock status from server */
    stock?: number;
    /** Price change from server */
    priceChanged?: boolean;
    /** Server is refreshing this item */
    refreshing?: boolean;
  };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  /** Save engraving texts for this item (server-backed). */
  onUpdateTexts?: (id: string, texts: string[]) => Promise<void> | void;
  /** Turn engraving on/off for this item (server-backed). */
  onToggleCustomisation?: (id: string, enable: boolean) => Promise<void> | void;
  /** Whether this item was just added (triggers highlight animation) */
  isNew?: boolean;
}

export default function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  onUpdateTexts,
  onToggleCustomisation,
  isNew = false,
}: CartItemCardProps) {
  const [updating, setUpdating] = useState(false);
  const [editingEngraving, setEditingEngraving] = useState(false);
  const [draftTexts, setDraftTexts] = useState<string[]>([]);
  const [savingTexts, setSavingTexts] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [actionError, setActionError] = useState('');
  const lineTotal = (item.unitPrice + (item.customizationTotal || 0)) * item.quantity;
  const hasCustomization = item.customisation && item.customisationTexts && item.customisationTexts.length > 0;
  const itemId = item._id || item.productId;

  // Determine stock status
  const isOutOfStock = item.stock === 0;
  const isLowStock = item.stock !== undefined && item.stock > 0 && item.stock <= 5;
  const quantityExceedsStock = item.stock !== undefined && item.quantity > item.stock;

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    setUpdating(true);
    try {
      onUpdateQuantity(item._id || item.productId, newQuantity);
    } finally {
      setUpdating(false);
    }
  };

  /* ---- Pet name engraving editing (customizable products) ---- */
  const startEditEngraving = () => {
    const saved = item.customisationTexts || [];
    const qty = item.quantity || 1;
    const padded = [...saved, ...Array(Math.max(0, qty - saved.length)).fill('')];
    setDraftTexts(padded);
    setEditingEngraving(true);
    setActionError('');
  };

  const handleAddEngraving = async () => {
    if (!onToggleCustomisation) return;
    setActionError('');
    try {
      await onToggleCustomisation(itemId, true);
      startEditEngraving();
    } catch {
      setActionError('Could not enable the pet name. Please try again.');
    }
  };

  const handleRemoveEngraving = async () => {
    if (!onToggleCustomisation) return;
    setActionError('');
    try {
      await onToggleCustomisation(itemId, false);
      setEditingEngraving(false);
    } catch {
      setActionError('Could not remove the pet name. Please try again.');
    }
  };

  const handleSaveEngraving = async () => {
    if (!onUpdateTexts) return;
    setSavingTexts(true);
    setActionError('');
    try {
      await onUpdateTexts(itemId, draftTexts.map((t) => t.trim()).filter(Boolean));
      setEditingEngraving(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setActionError('Could not save the pet name. Please try again.');
    } finally {
      setSavingTexts(false);
    }
  };

  // Determine card status border
  const statusBorder = isOutOfStock
    ? 'border-red-200 bg-red-50/30'
    : quantityExceedsStock
    ? 'border-amber-200 bg-amber-50/30'
    : 'border-gray-200 bg-white';

  return (
    <div
      className={`relative rounded-xl border p-5 transition-all duration-300 ease-out ${statusBorder} ${
        isNew ? 'ring-2 ring-primary-500 ring-offset-2 animate-[highlight_0.5s_ease-out]' : ''
      } ${item.refreshing ? 'opacity-60 pointer-events-none' : ''}`}
      style={{
        animation: isNew ? 'highlight 0.5s ease-out' : undefined,
      }}
    >
      {/* Refreshing overlay */}
      {item.refreshing && (
        <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center z-10">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      )}

      <div className="flex gap-4">
        {/* Product Image */}
        <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={item.productName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Tag size={24} />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-[15px]">{item.productName}</h3>

              {/* Subscription badge */}
              {item.isSubscription && (
                <span className="inline-flex items-center gap-1 text-xs text-primary-600 mt-1 bg-primary-50 px-2 py-0.5 rounded-full">
                  <Tag size={12} /> Auto-renew
                </span>
              )}

              {/* Customisation details / editing */}
              {item.customizable && editingEngraving && (
                <div className="mt-2 bg-primary-50/60 border border-primary-100 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-primary-700 mb-2">
                    {item.customizationLabel || 'Pet name'}
                  </p>
                  <div className="space-y-1.5">
                    {draftTexts.map((text, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {item.quantity > 1 && (
                          <span className="text-[11px] text-gray-500 w-12 shrink-0">Tag {i + 1}</span>
                        )}
                        <input
                          type="text"
                          maxLength={16}
                          value={text}
                          onChange={(e) =>
                            setDraftTexts((prev) => {
                              const next = [...prev];
                              next[i] = e.target.value.slice(0, 16);
                              return next;
                            })
                          }
                          placeholder={item.customizationLabel || 'Pet name'}
                          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          aria-label={`${item.customizationLabel || 'Pet name'} ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSaveEngraving}
                      disabled={savingTexts}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {savingTexts ? (
                        <><Loader2 size={12} className="animate-spin" /> Saving…</>
                      ) : savedFlash ? (
                        <><Check size={12} /> Saved</>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      onClick={() => setEditingEngraving(false)}
                      disabled={savingTexts}
                      className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRemoveEngraving}
                      disabled={savingTexts}
                      className="ml-auto text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Remove engraving
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Max 16 characters per name
                    {item.customizationPrice ? ` · +$${item.customizationPrice.toFixed(2)} per unit` : ''}
                  </p>
                </div>
              )}

              {hasCustomization && !editingEngraving && (
                <div className="mt-2 bg-primary-50/60 border border-primary-100 rounded-lg px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary-700 mb-1">
                        {item.customizationLabel || 'Customisation'}
                      </p>
                      {item.customisationTexts?.map((text, i) => (
                        <p key={i} className="text-sm text-primary-800">"{text}"</p>
                      ))}
                      {item.customizationTotal ? (
                        <p className="text-xs text-primary-600 mt-1">
                          +${item.customizationTotal.toFixed(2)} per unit
                        </p>
                      ) : null}
                    </div>
                    {onUpdateTexts && item.customizable && (
                      <button
                        onClick={startEditEngraving}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 bg-white border border-primary-200 rounded-lg px-2.5 py-1.5 transition-colors"
                        aria-label={`Edit ${item.customizationLabel || 'customisation'} for ${item.productName}`}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>
                </div>
              )}

              {item.customizable && !item.customisation && onToggleCustomisation && (
                <button
                  onClick={handleAddEngraving}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 border border-primary-100 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Pencil size={12} />
                  Add {item.customizationLabel?.toLowerCase() || 'pet name'}
                  {item.customizationPrice ? ` (+$${item.customizationPrice.toFixed(2)})` : ''}
                </button>
              )}

              {actionError && (
                <p role="alert" className="mt-2 text-xs text-red-600">{actionError}</p>
              )}
            </div>

            {/* Line total */}
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-gray-900 text-[15px]">
                ${lineTotal.toFixed(2)}
              </p>
              {item.quantity > 1 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  ${item.unitPrice.toFixed(2)} each
                </p>
              )}
            </div>
          </div>

          {/* Stock warnings */}
          {isOutOfStock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={12} />
              <span>Out of stock</span>
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={12} />
              <span>Only {item.stock} left in stock</span>
            </div>
          )}
          {quantityExceedsStock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={12} />
              <span>Maximum available: {item.stock}</span>
            </div>
          )}

          {/* Quantity controls + Remove */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleQuantityChange(item.quantity - 1)}
                disabled={updating || item.quantity <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-sm font-medium text-gray-900">
                {updating ? <Loader2 className="animate-spin mx-auto" size={14} /> : item.quantity}
              </span>
              <button
                onClick={() => handleQuantityChange(item.quantity + 1)}
                disabled={updating || (item.stock !== undefined && item.quantity >= item.stock)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              onClick={() => onRemove(item._id || item.productId)}
              disabled={updating}
              className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
              aria-label={`Remove ${item.productName}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
