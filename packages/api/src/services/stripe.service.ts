import Stripe from 'stripe';

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

  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(data.amount * 100), // Convert NZD to cents
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

export async function createRefund(paymentIntentId: string, amount?: number): Promise<{ success: boolean; refundId?: string; error?: string }> {
  // Demo mode
  if (paymentIntentId.startsWith('pi_demo_')) {
    return { success: true, refundId: `re_demo_${Date.now()}` };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
    });
    return { success: true, refundId: refund.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
