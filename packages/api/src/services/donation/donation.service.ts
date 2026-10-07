/**
 * One-time donation service (Phase 15).
 * Server owns amounts; Stripe webhook is authoritative for success.
 * Repository-style access via models but business rules isolated here.
 */
import { Donation, DonationPayment, DonationReceipt, User, Setting } from '@pawtag/db';
import { stripePaymentProvider } from '../../commerce/providers/stripe';
import { isFakeMode } from '../../commerce/payment-mode';
import { getStripeClient } from '../../lib/stripe-client';
import { sendMail } from '../email.service';
import logger from '../../lib/logger';
import {
  getDonationSettings,
  validateDonationAmount,
  isDonationModuleEnabled,
  invalidateDonationSettingsCache,
} from './donation-config';

export interface CreateDonationInput {
  amount: number;
  currency?: string;
  frequency?: 'one_time' | 'monthly';
  email: string;
  name?: string;
  marketingConsent?: boolean;
  idempotencyKey?: string;
}

export interface CreateDonationResult {
  donationId: string;
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  status: string;
}

export class DonationService {
  /** Idempotent create + PaymentIntent for one-time donations. */
  async createOneTimeDonation(input: CreateDonationInput): Promise<CreateDonationResult> {
    if (!(await isDonationModuleEnabled())) {
      throw new Error('Donations are currently unavailable');
    }

    const frequency = input.frequency || 'one_time';
    if (frequency !== 'one_time') {
      throw new Error('Only one-time donations are enabled in this release');
    }

    const email = (input.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('A valid email address is required');
    }

    const amountCheck = await validateDonationAmount(Number(input.amount));
    if (!amountCheck.ok) {
      throw new Error(amountCheck.error);
    }
    const amountCents = amountCheck.amountCents;
    const settings = await getDonationSettings();
    const currency = (input.currency || settings.currency || 'NZD').toUpperCase();

    // Idempotent create
    if (input.idempotencyKey) {
      const existing = await Donation.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) {
        return this.toCreateResult(existing, existing.stripePaymentIntentId || '', existing.stripePaymentIntentId || '');
      }
    }

    // Supporter: reuse or create User in DONATION context — never reveal existence via response shape
    const supporter = await this.resolveOrCreateSupporter(email, input.name);

    // Stripe customer (best-effort for save; not required for one-time)
    let stripeCustomerId: string | undefined;
    if (!isFakeMode()) {
      try {
        const stripe = getStripeClient();
        const existingCust = await stripe.customers.list({ email, limit: 1 });
        if (existingCust.data[0]) {
          stripeCustomerId = existingCust.data[0].id;
        } else {
          const created = await stripe.customers.create({
            email,
            name: input.name || undefined,
            metadata: { userId: String(supporter._id), source: 'pawtag-donation' },
          });
          stripeCustomerId = created.id;
        }
      } catch (err) {
        logger.warn({ err, email }, 'Donation: failed to ensure Stripe customer');
      }
    }

    const donation = await Donation.create({
      supporterUserId: supporter._id,
      emailSnapshot: email,
      nameSnapshot: input.name || supporter.fullName || '',
      amountCents,
      currency,
      frequency: 'one_time',
      status: 'pending',
      stripeCustomerId,
      registrationContext: 'DONATION',
      idempotencyKey: input.idempotencyKey,
      marketingConsent: !!input.marketingConsent,
    });

    // PaymentIntent — amount in major units for existing provider API
    const paymentIntent = await stripePaymentProvider.createPaymentIntent({
      amount: amountCents / 100,
      currency,
      orderId: `DON-${String(donation._id).slice(-8)}`,
      orderNumber: `DON-${String(donation._id).slice(-8)}`,
      customerEmail: email,
      customerName: input.name || undefined,
      stripeCustomerId,
      description: `PawTag donation ${donation._id}`,
      metadata: {
        domain: 'donation',
        donationId: String(donation._id),
        amountCents: String(amountCents),
      },
    });

    donation.stripePaymentIntentId = paymentIntent.id;
    await donation.save();

    await DonationPayment.create({
      donationId: donation._id,
      amountCents,
      currency,
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
    });

    return this.toCreateResult(donation, paymentIntent.id, paymentIntent.clientSecret);
  }

  private toCreateResult(donation: any, paymentIntentId: string, clientSecret: string): CreateDonationResult {
    return {
      donationId: String(donation._id),
      clientSecret,
      paymentIntentId,
      amountCents: donation.amountCents,
      currency: donation.currency,
      status: donation.status,
    };
  }

  private async resolveOrCreateSupporter(email: string, name?: string): Promise<any> {
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      // Do not force pet onboarding; ensure donation context metadata if missing
      if (!(existing as any).registrationContext) {
        await User.updateOne({ _id: existing._id }, { $set: { registrationContext: 'DONATION' } });
      }
      return existing;
    }
    // Concurrent-safe-ish: unique email on User
    try {
      return await User.create({
        email,
        passwordHash: 'donation-supporter-no-login-yet',
        fullName: name || 'Supporter',
        phoneNumber: '',
        role: 'customer',
        status: 'active',
        emailVerified: false,
        phoneVerified: false,
        registrationContext: 'DONATION',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        const again = await User.findOne({ email }).lean();
        if (again) return again;
      }
      throw err;
    }
  }

  async getStatus(donationId: string, userId?: string): Promise<any> {
    const donation = await Donation.findById(donationId);
    if (!donation) throw new Error('Donation not found');
    if (userId && String(donation.supporterUserId) !== userId) {
      throw new Error('Donation not found');
    }
    const receipt = donation.receiptId ? await DonationReceipt.findById(donation.receiptId).lean() : null;
    return {
      id: String(donation._id),
      status: donation.status,
      amountCents: donation.amountCents,
      currency: donation.currency,
      frequency: donation.frequency,
      createdAt: donation.createdAt,
      receiptNumber: receipt?.receiptNumber,
      organisationName: receipt?.organisationName,
      taxClassification: receipt?.taxClassification,
      statement: receipt?.statement,
    };
  }

  /**
   * Webhook: mark donation payment succeeded/failed by PaymentIntent.
   * Idempotent.
   */
  async handlePaymentIntentUpdate(paymentIntentId: string, status: 'succeeded' | 'failed', webhookEventId?: string): Promise<void> {
    if (!paymentIntentId) return;
    const donation = await Donation.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!donation) return;

    if (status === 'succeeded') {
      if (donation.status === 'succeeded') return; // idempotent
      donation.status = 'succeeded';
      await donation.save();

      await DonationPayment.updateOne(
        { stripePaymentIntentId: paymentIntentId },
        {
          $set: {
            status: 'succeeded',
            paidAt: new Date(),
            webhookEventId,
          },
        },
      );

      // Issue receipt (idempotent by donationId)
      const receipt = await this.issueReceipt(donation);
      if (receipt) {
        donation.receiptId = receipt._id;
        await donation.save();
      }

      // Email — best-effort, fail-closed production path already in sendMail
      try {
        await this.sendDonationReceiptEmail(donation, receipt);
      } catch (err) {
        logger.error({ err, donationId: String(donation._id) }, 'Failed to send donation receipt email');
      }
    } else if (status === 'failed') {
      if (donation.status === 'succeeded' || donation.status === 'refunded') return;
      donation.status = 'failed';
      donation.failureReason = 'Payment failed';
      await donation.save();
      await DonationPayment.updateOne(
        { stripePaymentIntentId: paymentIntentId },
        { $set: { status: 'failed', failureReason: 'Payment failed', webhookEventId } },
      );
    }
  }

  async issueReceipt(donation: any): Promise<any> {
    const existing = await DonationReceipt.findOne({ donationId: donation._id, status: 'issued' });
    if (existing) return existing;

    const settings = await getDonationSettings();
    // Unique sequence via counters collection (same pattern as invoices/orders)
    const counter = await Donation.db!.collection('counters').findOneAndUpdate(
      { _id: 'donationReceiptNumber' as any },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    const seq = (counter as any)?.value?.seq ?? (counter as any)?.seq ?? 1;
    const receiptNumber = `DNR-${String(seq).padStart(6, '0')}`;

    // Tax classification must stay neutral unless explicitly approved in settings
    const taxClassification = settings.taxClassification === 'neutral' || !settings.taxClassification
      ? 'neutral'
      : settings.taxClassification;

    return DonationReceipt.create({
      receiptNumber,
      donationId: donation._id,
      amountCents: donation.amountCents,
      currency: donation.currency,
      donorNameSnapshot: donation.nameSnapshot || '',
      organisationName: settings.organisationName,
      irdNumber: (await readOptionalSetting('donation.receipt.irdNumber')) || undefined,
      charitiesNumber: (await readOptionalSetting('donation.receipt.charitiesNumber')) || undefined,
      taxClassification,
      statement: settings.receiptStatement,
      signatory: (await readOptionalSetting('donation.receipt.signatory')) || undefined,
      status: 'issued',
      issuedAt: new Date(),
    });
  }

  async sendDonationReceiptEmail(donation: any, receipt: any): Promise<void> {
    const to = donation.emailSnapshot;
    if (!to) return;

    const amount = (donation.amountCents / 100).toFixed(2);
    const vars = {
      donorName: donation.nameSnapshot || 'Supporter',
      amount,
      currency: donation.currency,
      receiptNumber: receipt?.receiptNumber || '',
      organisationName: receipt?.organisationName || 'PawTag',
      statement: receipt?.statement || 'Thank you for your donation to PawTag.',
      taxClassification: receipt?.taxClassification || 'neutral',
    };

    // Neutral wording only — never tax-credit claims unless settings say approved
    const fallbackSubject = `Thank you for your donation — ${vars.receiptNumber || 'PawTag'}`;
    const fallbackHtml = `
      <p>Hi ${vars.donorName},</p>
      <p>${vars.statement}</p>
      <p><strong>Amount:</strong> ${vars.currency} $${amount}</p>
      <p><strong>Receipt number:</strong> ${vars.receiptNumber}</p>
      <p>${vars.organisationName}</p>
    `;

    await sendMail(
      to,
      fallbackSubject,
      fallbackHtml,
      undefined,
      {
        templateSlug: 'donation-receipt',
        businessFlow: 'donations',
        relatedEntityType: 'donation' as any,
        relatedEntityDisplay: vars.receiptNumber,
        idempotencyKey: `donation-receipt-email:${donation._id}`,
      },
    );
  }
}

async function readOptionalSetting(key: string): Promise<string> {
  const doc = await Setting.findOne({ key }).lean();
  return doc?.value || '';
}

export const donationService = new DonationService();
