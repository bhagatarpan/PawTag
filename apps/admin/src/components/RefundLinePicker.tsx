import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Minus, Plus, AlertTriangle } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

/**
 * RefundLinePicker — admin line-item selection for cancellations/refunds
 * (docs/COMMERCE-FINANCE-PLAN-GST-CPF.md §8b/§9).
 *
 * - Product rows: qty steppers capped at the server-computed refundable qty
 * - Engraving rows: only for units WITHOUT a generated PawTag ID; tagged
 *   units are shown greyed with the reason (hard cap — never selectable)
 * - Card processing fee row: always locked ("non-refundable")
 * - Per-line GST portions come from the server (tax provider rate — the
 *   client NEVER hardcodes a GST rate)
 * - The server revalidates every selection; this component is display +
 *   intent only
 */

export interface RefundLineSelectionOut {
  lines: Array<{ orderItemId: string; productQuantity?: number; engravingQuantity?: number }>;
  /** Selected refund total (GST-inclusive) */
  total: number;
  /** GST contained in the selected total */
  totalGst: number;
}

interface EligibilityItem {
  orderItemId: string;
  productName: string;
  quantity: number;
  alreadyRefundedQuantity: number;
  unitPrice: number;
  customizationTotal: number;
  customisationTexts?: string[];
  taggedUnits: number;
  productRefundableQty: number;
  engravingRefundableUnits: number;
  engravingRetained: number;
  productUnitGst: number;
  engravingUnitGst: number;
}

interface EligibilityData {
  items: EligibilityItem[];
  capturedAmount: number;
  alreadyRefunded: number;
  maxRefundable: number;
  cpf: { amount: number; gst: number; cardNetwork?: string } | null;
  retainedCpf: number;
}

const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function RefundLinePicker({
  orderId,
  onChange,
  disabled = false,
}: {
  orderId: string;
  onChange: (selection: RefundLineSelectionOut | null) => void;
  disabled?: boolean;
}) {
  const [data, setData] = useState<EligibilityData | null>(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState<Record<string, { product: number; engraving: number }>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(API.admin.orders.refundEligibility(orderId));
        if (cancelled) return;
        const eligibility: EligibilityData = res.data?.data;
        setData(eligibility);
        // Prefill: full eligible selection (what a cancellation refunds)
        const prefill: Record<string, { product: number; engraving: number }> = {};
        for (const item of eligibility.items) {
          prefill[item.orderItemId] = {
            product: item.productRefundableQty,
            engraving: item.engravingRefundableUnits,
          };
        }
        setQty(prefill);
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load refundable items');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const selection = useMemo<RefundLineSelectionOut | null>(() => {
    if (!data) return null;
    const lines: RefundLineSelectionOut['lines'] = [];
    let totalCents = 0;
    let gstCents = 0;
    const round = (n: number) => Math.round(n * 100);
    for (const item of data.items) {
      const q = qty[item.orderItemId];
      if (!q) continue;
      if (q.product > 0) {
        lines.push({ orderItemId: item.orderItemId, productQuantity: q.product });
        totalCents += round(item.unitPrice) * q.product;
        gstCents += round(item.productUnitGst) * q.product;
      }
      if (q.engraving > 0) {
        lines.push({ orderItemId: item.orderItemId, engravingQuantity: q.engraving });
        totalCents += round(item.customizationTotal) * q.engraving;
        gstCents += round(item.engravingUnitGst) * q.engraving;
      }
    }
    return { lines, total: totalCents / 100, totalGst: gstCents / 100 };
  }, [data, qty]);

  useEffect(() => {
    onChange(data ? selection : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, data]);

  const adjust = (orderItemId: string, kind: 'product' | 'engraving', delta: number) => {
    setQty((prev) => {
      const cur = prev[orderItemId] || { product: 0, engraving: 0 };
      const max =
        kind === 'product'
          ? data?.items.find((i) => i.orderItemId === orderItemId)?.productRefundableQty || 0
          : data?.items.find((i) => i.orderItemId === orderItemId)?.engravingRefundableUnits || 0;
      const nextValue = Math.max(0, Math.min(max, cur[kind] + delta));
      return { ...prev, [orderItemId]: { ...cur, [kind]: nextValue } };
    });
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
        <AlertTriangle size={14} /> {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <Loader2 size={14} className="animate-spin" /> Loading refundable items…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
      {data.items.map((item) => {
        const q = qty[item.orderItemId] || { product: 0, engraving: 0 };
        const engravingLocked = item.customizationTotal > 0 && item.engravingRefundableUnits === 0 && item.taggedUnits > 0;
        return (
          <div key={item.orderItemId} className="p-3 space-y-2">
            {/* Product line */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                <p className="text-xs text-gray-500">
                  {money(item.unitPrice)} per unit{item.alreadyRefundedQuantity > 0 ? ` · ${item.alreadyRefundedQuantity} already refunded` : ''}
                  <span className="text-gray-400"> · incl. GST {money(item.productUnitGst)}/unit</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => adjust(item.orderItemId, 'product', -1)}
                  disabled={disabled || q.product <= 0}
                  className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  aria-label={`Decrease ${item.productName} refund quantity`}
                >
                  <Minus size={13} />
                </button>
                <span className="w-8 text-center text-sm font-medium">{q.product}</span>
                <button
                  type="button"
                  onClick={() => adjust(item.orderItemId, 'product', 1)}
                  disabled={disabled || q.product >= item.productRefundableQty}
                  className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                  aria-label={`Increase ${item.productName} refund quantity`}
                >
                  <Plus size={13} />
                </button>
                <span className="w-20 text-right text-sm font-semibold text-gray-900">
                  {money(item.unitPrice * q.product)}
                </span>
              </div>
            </div>

            {/* Engraving line */}
            {item.customizationTotal > 0 && (
              <div className="flex items-center justify-between gap-3 pl-3">
                <div className="min-w-0">
                  <p className={`text-sm ${engravingLocked ? 'text-gray-400' : 'text-primary-700'}`}>
                    Engraving{item.customisationTexts?.length ? ` — ${item.customisationTexts.filter(Boolean).join(', ')}` : ''}
                  </p>
                  <p className={`text-xs ${engravingLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                    {engravingLocked ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock size={11} /> PawTag ID generated — engraving service non-refundable ({item.taggedUnits} unit{item.taggedUnits > 1 ? 's' : ''})
                      </span>
                    ) : (
                      <>
                        {money(item.customizationTotal)} per unit
                        <span className="text-gray-400"> · incl. GST {money(item.engravingUnitGst)}/unit</span>
                      </>
                    )}
                  </p>
                </div>
                {!engravingLocked && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjust(item.orderItemId, 'engraving', -1)}
                      disabled={disabled || q.engraving <= 0}
                      className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                      aria-label={`Decrease ${item.productName} engraving refund quantity`}
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{q.engraving}</span>
                    <button
                      type="button"
                      onClick={() => adjust(item.orderItemId, 'engraving', 1)}
                      disabled={disabled || q.engraving >= item.engravingRefundableUnits}
                      className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                      aria-label={`Increase ${item.productName} engraving refund quantity`}
                    >
                      <Plus size={13} />
                    </button>
                    <span className="w-20 text-right text-sm font-semibold text-gray-900">
                      {money(item.customizationTotal * q.engraving)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Locked CPF row + retained summary */}
      <div className="p-3 bg-gray-50 space-y-1">
        {data.cpf && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 inline-flex items-center gap-1">
              <Lock size={12} /> Card payment fee{data.cpf.cardNetwork ? ` (${data.cpf.cardNetwork})` : ''} — non-refundable
            </span>
            <span className="font-medium text-gray-500">{money(data.cpf.amount)}</span>
          </div>
        )}
        {data.retainedCpf > 0 && (
          <p className="text-xs text-gray-400">Retained card fee is excluded from the refundable amount automatically.</p>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-900">
            Refund total <span className="text-xs text-gray-500 font-normal">(incl. GST {money(selection?.totalGst || 0)})</span>
          </span>
          <span className="text-base font-bold text-gray-900">{money(selection?.total || 0)}</span>
        </div>
        <p className="text-xs text-gray-400">
          Maximum refundable per finance rules: {money(data.maxRefundable)}
          {data.alreadyRefunded > 0 ? ` · already refunded ${money(data.alreadyRefunded)}` : ''}
        </p>
      </div>
    </div>
  );
}
