/**
 * @module Stripe Payment Provider
 * @description Direct Stripe payment adapter for PawTag Commerce.
 *
 * Direct Stripe payment adapter for PawTag Commerce.
 * Handles payment intent creation, retrieval, refunds, and webhook verification.
 *
 * This provider is stateless — all state is stored in MongoDB via the Order
 * and PendingOrder models. Stripe is only used for payment processing.
 *
 * Security:
 * - Webhook signatures MUST be verified in production
 * - Payment intent amounts are validated server-side
 * - No card data is ever stored by PawTag
 *
 * @example
 * ```typescript
 * import { stripePaymentProvider } from '../providers/stripe';
 * const intent = await stripePaymentProvider.createPaymentIntent({
 *   amount: 59.99, currency: 'NZD', orderId: 'PT-000001', customerEmail: 'customer@example.com',
 * });
 * ```
 */

import Stripe from 'stripe';
import type { IPaymentProvider, PaymentIntent, PaymentIntentStatus, RefundResult, PaymentWebhookEvent } from '../../interfaces/payment-provider';
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
   * @param params - Payment parameters
   * @returns Payment intent with client secret for frontend confirmation
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerEmail: string;
    customerName?: string;
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

    // Stripe expects amounts in cents (minor units)
    const amountInCents = Math.round(params.amount * 100);

    try {
      const intent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: params.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: params.customerEmail,
        metadata: {
          orderId: params.orderId,
          ...params.metadata,
        },
      });

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
   *
   * @param paymentIntentId - Stripe PaymentIntent ID
   * @returns Current payment intent
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
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return {
        id: intent.id,
        clientSecret: intent.client_secret || '',
        amount: (intent.amount || 0) / 100, // Convert from cents
        currency: intent.currency,
        status: STATUS_MAP[intent.status] || 'processing',
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
   * @param params - Refund parameters
   * @returns Refund result
   */
  async createRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
  }): Promise<RefundResult> {
    // Demo mode
    if (params.paymentIntentId.startsWith('pi_demo_')) {
      return {
        success: true,
        refundId: `re_demo_${Date.now()}`,
        amount: params.amount,
      };
    }

    const stripe = this.getClient();

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: params.paymentIntentId,
      };

      if (params.amount) {
        refundParams.amount = Math.round(params.amount * 100); // Convert to cents
      }

      if (params.reason) {
        refundParams.reason = params.reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await stripe.refunds.create(refundParams);

      return {
        success: true,
        refundId: refund.id,
        amount: (refund.amount || 0) / 100,
      };
    } catch (err: any) {
      logger.error({ err, paymentIntentId: params.paymentIntentId }, 'Failed to create Stripe refund');
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Verify a webhook signature from Stripe.
   *
   * CRITICAL: This must be called for all incoming Stripe webhooks.
   * Without signature verification, an attacker can fake payment events.
   *
   * @param payload - Raw request body (Buffer)
   * @param signature - Stripe-Signature header value
   * @returns Verified webhook event
   * @throws PaymentSignatureError if signature is invalid
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
