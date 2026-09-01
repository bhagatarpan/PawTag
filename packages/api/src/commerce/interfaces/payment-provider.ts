/**
 * @module PaymentProvider
 * @description Interface for payment provider adapters in PawTag Commerce.
 *
 * All payment operations go through this interface. The Stripe adapter
 * implements this for production. A demo adapter exists for development.
 *
 * Design principle: PawTag owns the business rules (what happens when payment
 * succeeds/fails). The provider only handles the external payment gateway interaction.
 */

/**
 * Represents a payment intent created by the provider.
 * This is the authoritative record of a payment attempt.
 */
export interface PaymentIntent {
  /** Provider-specific payment intent ID (e.g., Stripe's pi_xxx) */
  id: string;

  /** Client secret for frontend confirmation */
  clientSecret: string;

  /** Amount in major units (dollars, not cents) */
  amount: number;

  /** ISO 4217 currency code (e.g., 'NZD') */
  currency: string;

  /** Current status of the payment intent */
  status: PaymentIntentStatus;

  /** Card brand (visa, mastercard, amex, etc.) — populated after payment */
  cardBrand?: string;

  /** Last 4 digits of the card — populated after payment */
  cardLast4?: string;

  /** Provider metadata (raw response from provider) */
  metadata?: Record<string, string>;
}

/**
 * Payment intent status values.
 * Maps to Stripe's PaymentIntent statuses.
 */
export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'requires_capture'
  | 'canceled'
  | 'failed';

/**
 * Result of a refund operation.
 */
export interface RefundResult {
  /** Whether the refund was successfully created */
  success: boolean;

  /** Provider-specific refund ID (e.g., Stripe's re_xxx) */
  refundId?: string;

  /** Refund amount in major units */
  amount?: number;

  /** Current refund status from the provider (pending, succeeded, failed, canceled) */
  status?: string;

  /** Acquirer Reference Number (bank reference) — populated after settlement */
  arn?: string;

  /** Expected date when funds reach the merchant account */
  expectedArrival?: Date;

  /** Error message if refund failed */
  error?: string;
}

/**
 * Webhook event from the payment provider.
 * Normalised to a common format regardless of provider.
 */
export interface PaymentWebhookEvent {
  /** Provider-specific event ID */
  id: string;

  /** Normalised event type (e.g., 'payment_intent.succeeded') */
  type: string;

  /** Raw event data from provider */
  data: Record<string, unknown>;

  /** Timestamp when the event was created at the provider */
  createdAt: Date;
}

/**
 * Payment provider interface.
 *
 * Implementations must be stateless — all state is stored in the database.
 * Provider credentials come from CMS settings via the commerce config service.
 */
export interface IPaymentProvider {
  /** Unique identifier for this provider (e.g., 'stripe') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /**
   * Create a payment intent for an order.
   *
   * @param params - Payment intent parameters
   * @returns The created payment intent with client secret
   * @throws ExternalServiceError if provider is unavailable
   */
  createPaymentIntent(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerEmail: string;
    customerName?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntent>;

  /**
   * Retrieve the current status of a payment intent.
   *
   * @param paymentIntentId - Provider-specific payment intent ID
   * @returns Current payment intent status
   */
  retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;

  /**
   * Create a refund for a payment.
   *
   * @param params - Refund parameters
   * @returns Refund result with provider refund ID and status
   */
  createRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, string>;
  }): Promise<RefundResult>;

  /**
   * Retrieve the current status of a refund.
   *
   * @param refundId - Provider-specific refund ID
   * @returns Refund result with latest status, ARN, and expected arrival
   */
  retrieveRefund(refundId: string): Promise<RefundResult>;

  /**
   * List refunds for reconciliation.
   *
   * @param params - Date range and pagination options
   * @returns Array of refunds
   */
  listRefunds(params?: {
    since?: Date;
    until?: Date;
    limit?: number;
  }): Promise<RefundResult[]>;

  /**
   * Verify a webhook signature from the provider.
   *
   * @param payload - Raw request body (Buffer or string)
   * @param signature - Signature header value
   * @returns Parsed and verified webhook event
   * @throws AuthenticationError if signature is invalid
   */
  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
  ): Promise<PaymentWebhookEvent>;

  /**
   * Check if the provider is configured and healthy.
   *
   * @returns true if the provider can accept requests
   */
  isConfigured(): boolean;
}
