import Stripe from 'stripe';
import { logIntegration } from '../lib/timing';
import { ExternalServiceError } from '../lib/app-errors';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key', {
  apiVersion: '2024-06-20' as any,
});

export interface PaymentIntentData {
  amount: number;        // in cents
  currency: string;
  orderId: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  error?: string;
}

export async function createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult> {
  // Demo mode: if no real Stripe key, simulate success
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_demo_key') {
    const demoId = `pi_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      success: true,
      clientSecret: `${demoId}_secret_demo`,
      paymentIntentId: demoId,
    };
  }

  return logIntegration('Stripe', 'createPaymentIntent', async () => {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100),
        currency: data.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId: data.orderId,
          ...data.metadata,
        },
        receipt_email: data.customerEmail,
      });

      return {
        success: true,
        clientSecret: intent.client_secret || undefined,
        paymentIntentId: intent.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Payment processing failed',
      };
    }
  }, { orderId: data.orderId, amount: data.amount, currency: data.currency });
}

export async function confirmPayment(paymentIntentId: string): Promise<{ status: string; error?: string }> {
  // Demo mode
  if (paymentIntentId.startsWith('pi_demo_')) {
    return { status: 'succeeded' };
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return { status: intent.status };
  } catch (error: any) {
    return { status: 'failed', error: error.message };
  }
}

/**
 * Simulate a successful payment webhook for demo mode.
 * This triggers the same webhook handler as a real Stripe event.
 */
export async function simulatePaymentSuccess(orderNumber: string): Promise<{ success: boolean; error?: string }> {
  if (!orderNumber.startsWith('PT-')) {
    return { success: false, error: 'Invalid order number format' };
  }

  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: `pi_demo_${Date.now()}`,
            metadata: { orderNumber },
          },
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: 'Webhook simulation failed' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Simulate a failed payment webhook for demo mode.
 */
export async function simulatePaymentFailure(orderNumber: string): Promise<{ success: boolean; error?: string }> {
  if (!orderNumber.startsWith('PT-')) {
    return { success: false, error: 'Invalid order number format' };
  }

  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: `pi_demo_${Date.now()}`,
            metadata: { orderNumber },
          },
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: 'Webhook simulation failed' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createRefund(paymentIntentId: string, amount?: number): Promise<{ success: boolean; refundId?: string; error?: string }> {
  // Demo mode
  if (paymentIntentId.startsWith('pi_demo_')) {
    return { success: true, refundId: `re_demo_${Date.now()}` };
  }

  return logIntegration('Stripe', 'createRefund', async () => {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });
      return { success: true, refundId: refund.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, { paymentIntentId, amount });
}
