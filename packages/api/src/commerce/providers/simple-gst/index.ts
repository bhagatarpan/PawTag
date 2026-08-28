/**
 * @module NZ GST Tax Provider
 * @description Simple NZ GST (Goods and Services Tax) calculator.
 *
 * New Zealand charges 15% GST on most goods and services.
 * NZ GST is typically tax-inclusive — prices shown to customers include tax.
 *
 * This provider calculates GST for order totals and line items.
 * It does NOT interface with any external tax API — NZ GST is simple enough
 * to calculate directly.
 *
 * Tax rules (simplified for PawTag):
 * - All physical products are taxable at 15%
 * - Shipping is taxable at 15% (if shipping is charged)
 * - Digital services follow the same rules
 * - No tax-exempt items for PawTag's current catalog
 *
 * @example
 * ```typescript
 * import { nzGstProvider } from '../providers/simple-gst';
 * const result = await nzGstProvider.calculate({ items: [...], shippingCost: 0 });
 * ```
 */

import type { ITaxProvider, TaxCalculationResult, LineItemTax } from '../../interfaces/tax-provider';
import { getNumberSetting, getSetting, getBooleanSetting } from '../../config';
import logger from '../../../lib/logger';

/**
 * NZ GST tax provider for PawTag Commerce.
 */
export class NzGstProvider implements ITaxProvider {
  readonly id = 'nz-gst';
  readonly name = 'NZ GST (15%)';

  /**
   * Calculate tax for an order.
   *
   * For tax-inclusive pricing (default in NZ), the tax is already
   * included in the item prices. This method calculates the tax
   * component for display and reporting purposes.
   *
   * @param params - Calculation parameters
   * @returns Tax calculation result
   */
  async calculate(params: {
    items: Array<{ id: string; price: number; quantity: number; taxable?: boolean }>;
    shippingCost?: number;
    discountAmount?: number;
  }): Promise<TaxCalculationResult> {
    const rate = await this.getRate();
    const label = await this.getLabel();
    const inclusive = await this.isInclusive();

    const lineItems: LineItemTax[] = params.items.map((item) => {
      const taxable = item.taxable !== false; // Default to taxable
      const lineTotal = item.price * item.quantity;
      const taxAmount = taxable ? lineTotal * (inclusive ? rate / (1 + rate) : rate) : 0;

      return {
        lineItemId: item.id,
        rate: taxable ? rate : 0,
        amount: Math.round(taxAmount * 100) / 100,
        label: taxable ? label : '',
        taxable,
      };
    });

    const totalItemTax = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const shippingTax = params.shippingCost ? params.shippingCost * (inclusive ? rate / (1 + rate) : rate) : 0;
    const totalTax = totalItemTax + shippingTax;

    return {
      lineItems,
      totalTax: Math.round(totalTax * 100) / 100,
      taxRate: rate,
      taxLabel: label,
      inclusive,
    };
  }

  /**
   * Get the current GST rate.
   *
   * @returns GST rate (0.15 for 15%)
   */
  async getRate(): Promise<number> {
    return getNumberSetting('commerce.tax.rate');
  }

  /**
   * Get the tax label for display.
   *
   * @returns Label (e.g., 'GST')
   */
  async getLabel(): Promise<string> {
    return getSetting('commerce.tax.label');
  }

  /**
   * Check if prices are tax-inclusive.
   *
   * In NZ, prices are typically displayed inclusive of GST.
   *
   * @returns true if prices include tax
   */
  async isInclusive(): Promise<boolean> {
    return getBooleanSetting('commerce.tax.inclusive');
  }

  /**
   * Check if the provider is configured.
   */
  isConfigured(): boolean {
    return true; // NZ GST is always configured
  }
}

/** Singleton instance */
export const nzGstProvider = new NzGstProvider();
