/**
 * @module Stripe Payment Provider
 * @description Direct Stripe payment adapter for PawTag Commerce.
 *
 * Direct Stripe payment adapter for PawTag Commerce.
 * Handles payment intent creation, retrieval, refunds, webhook verification,
 * and reconciliation.
 *
 * This provider is stateless — all state is stored in MongoDB via the Order
 * and PaymentTransaction models. Stripe is only used for payment processing.
 *
 * Security:
 * - Webhook signatures MUST be verified in production
 * - Payment intent amounts are validated server-side
 * - No card data is ever stored by PawTag
 *
 * Reconciliation:
 * - Comprehensive metadata is sent to Stripe for accounting and reporting
 * - Refund status, ARN, and expected arrival are tracked through webhooks
 * - `retrieveRefund()` and `listRefunds()` support daily reconciliation
 *
 * @example
 * ```typescript
 * import { stripePaymentProvider } from '../providers/stripe';
 * const intent = await stripePaymentProvider.createPaymentIntent({
 *   amount: 59.99, currency: 'NZD', orderId: 'PT-000001', orderNumber: 'PT-000001',
 *   customerEmail: 'customer@example.com', customerName: 'Sarah Johnson',
 *   customerId: 'user-uuid', description: 'PawTag Order PT-000001',
 * });
 * ```
 */

import Stripe from 'stripe';
import type {
  IPaymentProvider,
  PaymentIntent,
  PaymentIntentStatus,
  RefundResult,
  PaymentWebhookEvent,
} from '../../interfaces/payment-provider';
import { PaymentFailedError, PaymentSignatureError } from '../../errors';
import { getSetting, getBooleanSetting } from '../../config';
import logger from '../../../lib/logger';

/**
 * Map Stripe PaymentIntent statuses to our normalised statuses.
 */
const STATUS_MAP: Record<string, PaymentIntentStatus> = {
  requires_payment_method: 'requires_payment_method',
  requires_confirmation: 'requires_confirmation',
  requires_action: 'requires_action',
  processing: 'processing',
  succeeded: 'succeeded',
  requires_capture: 'requires_capture',
  canceled: 'canceled',
  failed: 'failed',
};

/**
 * Detect environment for metadata tagging.
 */
function detectEnvironment(): string {
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'development';
}

/**
 * Stripe payment provider for PawTag Commerce.
 *
 * Uses the Stripe Node SDK directly.
 */
export class StripePaymentProvider implements IPaymentProvider {
  readonly id = 'stripe';
  readonly name = 'Stripe';

  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;

  /**
   * Initialise the Stripe client with API key from environment.
   * Lazy initialisation — only creates client when first needed.
   */
  private getClient(): Stripe {
    if (this.stripe) return this.stripe;

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey || apiKey === 'sk_test_demo_key') {
      throw new PaymentFailedError('Stripe is not configured (no STRIPE_SECRET_KEY)');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    });

    return this.stripe;
  }

  /**
   * Get the webhook signing secret for signature verification.
   */
  private getWebhookSecret(): string {
    if (this.webhookSecret) return this.webhookSecret;

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new PaymentSignatureError('STRIPE_WEBHOOK_SECRET is not configured');
    }

    this.webhookSecret = secret;
    return secret;
  }

  /**
   * Create a payment intent for an order.
   *
   * Sends comprehensive metadata to Stripe for reconciliation:
   * - orderId, orderNumber
   * - customerId, customerName, customerEmail, customerPhone
   * - description (human-readable order summary)
   * - statement_descriptor (what shows on bank statement)
   * - shipping (if available)
   * - environment (dev/staging/prod)
   *
   * @param params - Payment parameters
   * @returns Payment intent with client secret for frontend confirmation
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    customerId?: string;
    customerPhone?: string;
    description?: string;
    itemCount?: number;
    shipping?: {
      name: string;
      address: { line1: string; line2?: string; city: string; state: string; postal_code: string; country: string };
    };
    metadata?: Record<string, string>;
  }): Promise<PaymentIntent> {
    // Demo mode: auto-succeed
    const isTestMode = await getBooleanSetting('commerce.payment.testMode');
    if (isTestMode) {
      const demoId = `pi_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: demoId,
        clientSecret: `${demoId}_secret_demo`,
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        status: 'succeeded',
      };
    }

    const stripe = this.getClient();
    const amountInCents = Math.round(params.amount * 100);

    // Build comprehensive metadata for reconciliation
    const metadata: Record<string, string> = {
      orderId: params.orderId,
      orderNumber: params.orderNumber || params.orderId,
      environment: detectEnvironment(),
      source: 'pawtag',
      ...params.metadata,
    };
    if (params.customerId) metadata.customerId = params.customerId;
    if (params.itemCount !== undefined) metadata.itemCount = String(params.itemCount);

    // Build description with template
    let description = params.description;
    if (!description) {
      const template = await getSetting('commerce.stripe.descriptionTemplate');
      description = template
        ? template.replace('{orderNumber}', metadata.orderNumber)
        : `PawTag Order ${metadata.orderNumber}`;
    }

    // Build statement descriptor
    const statementDescriptor = await getSetting('commerce.stripe.statementDescriptor');

    try {
      const intentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: params.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: params.customerEmail,
        description,
        metadata,
      };

      if (statementDescriptor) {
        intentParams.statement_descriptor = statementDescriptor.slice(0, 22);
      }

      if (params.shipping) {
        intentParams.shipping = {
          name: params.shipping.name,
          address: {
            line1: params.shipping.address.line1,
            line2: params.shipping.address.line2,
            city: params.shipping.address.city,
            state: params.shipping.address.state,
            postal_code: params.shipping.address.postal_code,
            country: params.shipping.address.country,
          },
        };
      }

      const intent = await stripe.paymentIntents.create(intentParams);

      return {
        id: intent.id,
        clientSecret: intent.client_secret || '',
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        status: STATUS_MAP[intent.status] || 'processing',
        metadata: intent.metadata as Record<string, string>,
      };
    } catch (err: any) {
      logger.error({ err, orderId: params.orderId }, 'Failed to create Stripe payment intent');
      throw new PaymentFailedError(`Stripe error: ${err.message}`);
    }
  }

  /**
   * Retrieve the current status of a payment intent.
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    // Demo mode
    if (paymentIntentId.startsWith('pi_demo_')) {
      return {
        id: paymentIntentId,
        clientSecret: `${paymentIntentId}_secret_demo`,
        amount: 0,
        currency: 'nzd',
        status: 'succeeded',
      };
    }

    const stripe = this.getClient();

    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges', 'charges.data.payment_method_details', 'latest_charge'],
      });

      let cardBrand: string | undefined;
      let cardLast4: string | undefined;
      const charges = (intent as any).charges?.data;
      if (charges?.length > 0) {
        const card = charges[0].payment_method_details?.card;
        if (card) {
          cardBrand = card.brand;
          cardLast4 = card.last4;
        }
      }

      return {
        id: intent.id,
        clientSecret: intent.client_secret || '',
        amount: (intent.amount || 0) / 100,
        currency: intent.currency,
        status: STATUS_MAP[intent.status] || 'processing',
        cardBrand,
        cardLast4,
        metadata: intent.metadata as Record<string, string>,
      };
    } catch (err: any) {
      logger.error({ err, paymentIntentId }, 'Failed to retrieve Stripe payment intent');
      throw new PaymentFailedError(`Stripe error: ${err.message}`);
    }
  }

  /**
   * Create a refund for a payment.
   *
   * Sends full reconciliation metadata to Stripe:
   * - orderId, orderNumber
   * - cancelledBy (Customer / Dave Macenzie (Customer Service))
   * - cancelledByType (Customer / Customer Service / System)
   * - cancelledByPortal (customer-web / admin-web / system)
   * - cancellationReason (selected from CMS dropdown)
   * - cancellationNotes (free-text)
   * - initiatedBy (customer / admin / system)
   * - environment (dev/staging/prod)
   *
   * @param params - Refund parameters
   * @returns Refund result with status, ARN, expected arrival
   */
  async createRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, string>;
  }): Promise<RefundResult> {
    // Demo mode
    if (params.paymentIntentId.startsWith('pi_demo_')) {
      return {
        success: true,
        refundId: `re_demo_${Date.now()}`,
        amount: params.amount,
        status: 'succeeded',
        expectedArrival: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    }

    const stripe = this.getClient();

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: params.paymentIntentId,
        metadata: {
          environment: detectEnvironment(),
          source: 'pawtag',
          ...(params.metadata || {}),
        },
      };

      if (params.amount) {
        refundParams.amount = Math.round(params.amount * 100);
      }

      if (params.reason) {
        refundParams.reason = params.reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await stripe.refunds.create(refundParams);

      return this.mapRefund(refund);
    } catch (err: any) {
      logger.error({ err, paymentIntentId: params.paymentIntentId }, 'Failed to create Stripe refund');
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Retrieve the current status of a refund.
   *
   * @param refundId - Stripe refund ID (e.g., re_xxx)
   * @returns Refund result with latest status, ARN, expected arrival
   */
  async retrieveRefund(refundId: string): Promise<RefundResult> {
    if (refundId.startsWith('re_demo_')) {
      return {
        success: true,
        refundId,
        status: 'succeeded',
        expectedArrival: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
    }

    const stripe = this.getClient();

    try {
      const refund = await stripe.refunds.retrieve(refundId, {
        expand: ['charge'],
      });
      return this.mapRefund(refund);
    } catch (err: any) {
      logger.error({ err, refundId }, 'Failed to retrieve Stripe refund');
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * List refunds for reconciliation.
   *
   * @param params - Date range and pagination options
   * @returns Array of refunds in the date range
   */
  async listRefunds(params: { since?: Date; until?: Date; limit?: number } = {}): Promise<RefundResult[]> {
    const stripe = this.getClient();
    const limit = Math.min(params.limit || 100, 100);

    try {
      const listParams: Stripe.RefundListParams = {
        limit,
        expand: ['data.charge'],
      };
      if (params.since) {
        listParams.created = { gte: Math.floor(params.since.getTime() / 1000) };
      }
      if (params.until) {
        const existing = (listParams.created as any) || {};
        listParams.created = { ...existing, lte: Math.floor(params.until.getTime() / 1000) };
      }

      const refunds = await stripe.refunds.list(listParams);
      return refunds.data.map((r) => this.mapRefund(r));
    } catch (err: any) {
      logger.error({ err, params }, 'Failed to list Stripe refunds');
      return [];
    }
  }

  /**
   * Map a Stripe refund object to our RefundResult format.
   * @internal
   */
  private mapRefund(refund: Stripe.Refund): RefundResult {
    return {
      success: refund.status === 'succeeded' || refund.status === 'pending',
      refundId: refund.id,
      amount: (refund.amount || 0) / 100,
      status: refund.status ?? undefined,
      arn: undefined,
      expectedArrival: undefined,
    };
  }

  /**
   * Verify a webhook signature from Stripe.
   *
   * CRITICAL: This must be called for all incoming Stripe webhooks.
   */
  async verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
  ): Promise<PaymentWebhookEvent> {
    const stripe = this.getClient();
    const webhookSecret = this.getWebhookSecret();

    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      return {
        id: event.id,
        type: event.type,
        data: event.data.object as Record<string, unknown>,
        createdAt: new Date(event.created * 1000),
      };
    } catch (err: any) {
      logger.warn({ err, eventType: (err as any).message }, 'Stripe webhook signature verification failed');
      throw new PaymentSignatureError(`Invalid webhook signature: ${err.message}`);
    }
  }

  /**
   * Check if the provider is configured and healthy.
   */
  isConfigured(): boolean {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    return !!apiKey && apiKey !== 'sk_test_demo_key';
  }
}

/** Singleton instance */
export const stripePaymentProvider = new StripePaymentProvider();
