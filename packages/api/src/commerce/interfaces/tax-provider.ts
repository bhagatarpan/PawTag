/**
 * @module TaxProvider
 * @description Interface for tax calculation adapters in PawTag Commerce.
 *
 * PawTag operates in New Zealand with 15% GST (Goods and Services Tax).
 * NZ GST is typically tax-inclusive (prices include tax).
 *
 * Design principle: PawTag owns tax business rules (which products are taxable,
 * tax-inclusive vs exclusive). The provider handles the calculation.
 *
 * For PawTag's current needs, a simple GST provider is sufficient.
 * This interface exists to support future multi-region expansion if needed.
 */

/**
 * Tax calculation result for a single line item.
 */
export interface LineItemTax {
  /** Line item identifier */
  lineItemId: string;

  /** Tax rate applied (e.g., 0.15 for 15% GST) */
  rate: number;

  /** Tax amount in major units */
  amount: number;

  /** Tax label (e.g., 'NZ GST') */
  label: string;

  /** Whether this line item is taxable */
  taxable: boolean;
}

/**
 * Complete tax calculation result for an order.
 */
export interface TaxCalculationResult {
  /** Tax amount for each line item */
  lineItems: LineItemTax[];

  /** Total tax amount */
  totalTax: number;

  /** Tax rate used */
  taxRate: number;

  /** Tax label */
  taxLabel: string;

  /** Whether prices are tax-inclusive */
  inclusive: boolean;
}

/**
 * Tax provider interface.
 *
 * Implementations must be stateless. Configuration comes from CMS settings.
 */
export interface ITaxProvider {
  /** Unique identifier (e.g., 'nz-gst') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /**
   * Calculate tax for an order.
   *
   * @param params - Calculation parameters
   * @returns Tax calculation result
   */
  calculate(params: {
    items: Array<{ id: string; price: number; quantity: number; taxable?: boolean }>;
    shippingCost?: number;
    discountAmount?: number;
  }): Promise<TaxCalculationResult>;

  /**
   * Get the tax rate for a given context.
   *
   * @returns Current tax rate (e.g., 0.15 for 15% GST)
   */
  getRate(): Promise<number>;

  /**
   * Get the tax label for display purposes.
   *
   * @returns Tax label (e.g., 'GST')
   */
  getLabel(): Promise<string>;

  /**
   * Check if prices should be treated as tax-inclusive.
   */
  isInclusive(): Promise<boolean>;

  /**
   * Check if the provider is configured and healthy.
   */
  isConfigured(): boolean;
}
