/**
 * One-time donation service (Phase 15).
 * Server owns amounts; Stripe webhook is authoritative for success.
 * Repository-style access via models but business rules isolated here.
 */
import { Donation, DonationPayment, DonationReceipt, User, Setting } from '@pawtag/db';
import { stripePaymentProvider } from '../../commerce/providers/stripe';
import { isFakeMode, isFakePaymentIntentId } from '../../commerce/payment-mode';
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
  frequency?: 'one_time' | 'monthly';
  stripeSubscriptionId?: string;
}

export class DonationService {
  /** Create one-time or monthly donation (server-authoritative amount). */
  async createDonation(input: CreateDonationInput): Promise<CreateDonationResult> {
    if (!(await isDonationModuleEnabled())) {
      throw new Error('Donations are currently unavailable');
    }

    const frequency = input.frequency || 'one_time';
    const settings = await getDonationSettings();
    if (frequency === 'monthly' && settings.frequencies.indexOf('monthly') === -1) {
      throw new Error('Monthly donations are not enabled');
    }
    if (frequency !== 'one_time' && frequency !== 'monthly') {
      throw new Error('Unsupported donation frequency');
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
    const currency = (input.currency || settings.currency || 'NZD').toUpperCase();

    if (input.idempotencyKey) {
      const existing = await Donation.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) {
        return this.toCreateResult(existing, existing.stripePaymentIntentId || '', existing.stripePaymentIntentId || '');
      }
    }

    const supporter = await this.resolveOrCreateSupporter(email, input.name);

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
      frequency,
      status: 'pending',
      stripeCustomerId,
      registrationContext: 'DONATION',
      idempotencyKey: input.idempotencyKey,
      marketingConsent: !!input.marketingConsent,
    });

    if (frequency === 'monthly') {
      return this.createMonthlySubscription(donation, amountCents, currency, email, input.name);
    }

    return this.createOneTimePayment(donation, amountCents, currency, email, input.name, stripeCustomerId);
  }

  /** Back-compat wrapper */
  async createOneTimeDonation(input: CreateDonationInput): Promise<CreateDonationResult> {
    return this.createDonation({ ...input, frequency: input.frequency || 'one_time' });
  }

  private async createOneTimePayment(
    donation: any,
    amountCents: number,
    currency: string,
    email: string,
    name?: string,
    stripeCustomerId?: string,
  ): Promise<CreateDonationResult> {
    const paymentIntent = await stripePaymentProvider.createPaymentIntent({
      amount: amountCents / 100,
      currency,
      orderId: `DON-${String(donation._id).slice(-8)}`,
      orderNumber: `DON-${String(donation._id).slice(-8)}`,
      customerEmail: email,
      customerName: name || undefined,
      stripeCustomerId,
      description: `PawTag donation ${donation._id}`,
      metadata: {
        domain: 'donation',
        donationId: String(donation._id),
        amountCents: String(amountCents),
        frequency: 'one_time',
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

    // Fake/local mode only: complete immediately like shop demo path.
    // stripe_test / stripe_live never auto-succeed here — Stripe must confirm.
    if (isFakeMode() && isFakePaymentIntentId(paymentIntent.id)) {
      await this.handlePaymentIntentUpdate(paymentIntent.id, 'succeeded', 'local_fake_mode');
      const refreshed = await Donation.findById(donation._id);
      return this.toCreateResult(refreshed || donation, paymentIntent.id, paymentIntent.clientSecret);
    }

    return this.toCreateResult(donation, paymentIntent.id, paymentIntent.clientSecret);
  }

  private async createMonthlySubscription(
    donation: any,
    amountCents: number,
    currency: string,
    _email: string,
    name?: string,
  ): Promise<CreateDonationResult> {
    const donorName = name || donation.nameSnapshot || 'Supporter';

    if (isFakeMode()) {
      // Deterministic local subscription for tests/dev without live Stripe
      const fakeSubId = `sub_demo_donation_${String(donation._id).slice(-8)}`;
      donation.stripeSubscriptionId = fakeSubId;
      donation.status = 'pending';
      donation.currentPeriodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      donation.currentPeriodEnd = periodEnd;
      await donation.save();

      await DonationPayment.create({
        donationId: donation._id,
        amountCents,
        currency,
        status: 'pending',
        stripeInvoiceId: `in_demo_${fakeSubId}`,
      });

      return {
        donationId: String(donation._id),
        clientSecret: `${fakeSubId}_secret`,
        paymentIntentId: fakeSubId,
        amountCents,
        currency,
        status: donation.status,
        frequency: 'monthly',
        stripeSubscriptionId: fakeSubId,
      };
    }

    const stripe = getStripeClient();
    const customerId = donation.stripeCustomerId;
    if (!customerId) {
      throw new Error('Unable to create monthly donation without Stripe customer');
    }

    // Configurable amount via price_data — no hardcoded Stripe price IDs
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amountCents,
            recurring: { interval: 'month' },
            product_data: {
              name: `PawTag monthly donation — ${donorName}`,
            },
          } as any,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: {
        domain: 'donation',
        donationId: String(donation._id),
        amountCents: String(amountCents),
      },
      expand: ['latest_invoice.payment_intent'],
    });

    donation.stripeSubscriptionId = subscription.id;
    await donation.save();

    const latestInvoice = subscription.latest_invoice as any;
    const clientSecret =
      latestInvoice?.payment_intent?.client_secret ||
      `${subscription.id}_secret`;

    await DonationPayment.create({
      donationId: donation._id,
      amountCents,
      currency,
      status: 'pending',
      stripeInvoiceId: latestInvoice?.id,
    });

    return {
      donationId: String(donation._id),
      clientSecret,
      paymentIntentId: subscription.id,
      amountCents,
      currency,
      status: donation.status,
      frequency: 'monthly',
      stripeSubscriptionId: subscription.id,
    };
  }

  private toCreateResult(donation: any, paymentIntentId: string, clientSecret: string): CreateDonationResult {
    return {
      donationId: String(donation._id),
      clientSecret,
      paymentIntentId,
      amountCents: donation.amountCents,
      currency: donation.currency,
      status: donation.status,
      frequency: donation.frequency,
      stripeSubscriptionId: donation.stripeSubscriptionId || undefined,
    };
  }

  /** Cancel monthly recurring donation (idempotent). */
  async cancelRecurring(donationId: string, userId?: string): Promise<{ status: string; cancelledAt?: Date }> {
    const donation = await Donation.findById(donationId);
    if (!donation) throw new Error('Donation not found');
    if (userId && String(donation.supporterUserId) !== userId) {
      throw new Error('Donation not found');
    }
    if (donation.frequency !== 'monthly') {
      throw new Error('Only monthly donations can be cancelled');
    }
    if (donation.status === 'cancelled') {
      return { status: 'cancelled', cancelledAt: donation.cancelledAt };
    }

    if (donation.stripeSubscriptionId && !isFakeMode() && !donation.stripeSubscriptionId.startsWith('sub_demo_')) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(donation.stripeSubscriptionId);
      } catch (err) {
        logger.warn({ err, donationId }, 'Stripe cancel failed; marking local cancelled');
      }
    }

    donation.status = 'cancelled';
    donation.cancelledAt = new Date();
    donation.cancellationReason = 'Cancelled by supporter';
    await donation.save();

    return { status: 'cancelled', cancelledAt: donation.cancelledAt };
  }

  /** Customer portal list (ownership scoped). */
  async listForUser(userId: string): Promise<any[]> {
    const donations = await Donation.find({ supporterUserId: userId }).sort({ createdAt: -1 }).limit(100).lean();
    const payments = await DonationPayment.find({
      donationId: { $in: donations.map((d) => d._id) },
    }).sort({ createdAt: -1 }).lean();

    const paymentsByDonation = new Map<string, any[]>();
    for (const p of payments) {
      const key = String(p.donationId);
      if (!paymentsByDonation.has(key)) paymentsByDonation.set(key, []);
      paymentsByDonation.get(key)!.push(p);
    }

    return donations.map((d) => ({
      id: String(d._id),
      amountCents: d.amountCents,
      currency: d.currency,
      frequency: d.frequency,
      status: d.status,
      pastDue: !!d.pastDue,
      cancelledAt: d.cancelledAt,
      createdAt: d.createdAt,
      payments: (paymentsByDonation.get(String(d._id)) || []).map((p) => ({
        id: String(p._id),
        amountCents: p.amountCents,
        status: p.status,
        paidAt: p.paidAt,
        receiptId: p.receiptId ? String(p.receiptId) : undefined,
      })),
    }));
  }

  /** Admin list (permission enforced in route). */
  async listAdmin(filters: { status?: string; frequency?: string; q?: string } = {}): Promise<any[]> {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.frequency) query.frequency = filters.frequency;
    if (filters.q) {
      query.$or = [
        { emailSnapshot: { $regex: filters.q, $options: 'i' } },
        { nameSnapshot: { $regex: filters.q, $options: 'i' } },
      ];
    }
    const donations = await Donation.find(query).sort({ createdAt: -1 }).limit(200).lean();
    return donations.map((d) => ({
      id: String(d._id),
      email: d.emailSnapshot,
      name: d.nameSnapshot,
      amountCents: d.amountCents,
      currency: d.currency,
      frequency: d.frequency,
      status: d.status,
      pastDue: !!d.pastDue,
      stripeSubscriptionId: d.stripeSubscriptionId,
      createdAt: d.createdAt,
    }));
  }

  /** Neutral receipt HTML (same fields as stored receipt). */
  async getReceiptHtml(receiptId: string, userId?: string): Promise<string> {
    const receipt = await DonationReceipt.findById(receiptId);
    if (!receipt) throw new Error('Receipt not found');
    const donation = await Donation.findById(receipt.donationId).lean();
    if (userId && donation && String(donation.supporterUserId) !== userId) {
      throw new Error('Receipt not found');
    }

    const amount = (receipt.amountCents / 100).toFixed(2);
    // Tax classification from settings only — never invent IRD claims
    const taxNote =
      receipt.taxClassification === 'neutral' || !receipt.taxClassification
        ? 'This is a donation payment receipt. Tax treatment, if any, depends on your circumstances and applicable law.'
        : `Tax classification (configured): ${receipt.taxClassification}`;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Donation receipt ${receipt.receiptNumber}</title></head>
<body style="font-family: Georgia, serif; max-width: 640px; margin: 40px auto; color: #111;">
  <h1 style="margin-bottom: 0;">${escapeHtml(receipt.organisationName)}</h1>
  <p style="margin-top: 0; color: #555;">Donation receipt</p>
  <hr/>
  <p><strong>Receipt number:</strong> ${escapeHtml(receipt.receiptNumber)}</p>
  <p><strong>Issued:</strong> ${receipt.issuedAt ? new Date(receipt.issuedAt).toLocaleString('en-NZ') : ''}</p>
  <p><strong>Donor:</strong> ${escapeHtml(receipt.donorNameSnapshot || 'Supporter')}</p>
  <p><strong>Amount:</strong> ${escapeHtml(receipt.currency)} $${amount}</p>
  <p><strong>Statement:</strong> ${escapeHtml(receipt.statement)}</p>
  ${receipt.irdNumber ? `<p><strong>IRD number:</strong> ${escapeHtml(receipt.irdNumber)}</p>` : ''}
  ${receipt.charitiesNumber ? `<p><strong>Charities number:</strong> ${escapeHtml(receipt.charitiesNumber)}</p>` : ''}
  <p style="font-size: 13px; color: #444;">${escapeHtml(taxNote)}</p>
  ${receipt.signatory ? `<p><strong>Authorised by:</strong> ${escapeHtml(receipt.signatory)}</p>` : ''}
  <hr/>
  <p style="font-size: 12px; color: #666;">Status: ${escapeHtml(receipt.status)} · Reference: ${escapeHtml(receipt.receiptNumber)}</p>
</body></html>`;
  }

  /** Resend receipt email (same receipt — no new receipt number). */
  async resendReceiptEmail(receiptId: string, adminActor?: string): Promise<void> {
    const receipt = await DonationReceipt.findById(receiptId);
    if (!receipt) throw new Error('Receipt not found');
    const donation = await Donation.findById(receipt.donationId);
    if (!donation) throw new Error('Donation not found');
    await this.sendDonationReceiptEmail(donation, receipt);
    logger.info({ receiptId, adminActor }, 'Donation receipt email resent');
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
   * Stripe invoice webhook for monthly donations.
   * Every successful invoice → one DonationPayment + one receipt.
   */
  async handleInvoiceUpdate(
    stripeInvoiceId: string,
    stripeSubscriptionId: string,
    status: 'paid' | 'failed',
    amountCents?: number,
  ): Promise<void> {
    if (!stripeSubscriptionId) return;
    const donation = await Donation.findOne({ stripeSubscriptionId });
    if (!donation) return;

    if (status === 'paid') {
      // Idempotent: one payment+receipt per stripeInvoiceId
      const existingPayment = await DonationPayment.findOne({ stripeInvoiceId });
      if (existingPayment?.status === 'succeeded') return;

      const amount = amountCents || donation.amountCents;
      if (existingPayment) {
        existingPayment.status = 'succeeded';
        existingPayment.paidAt = new Date();
        await existingPayment.save();
      } else {
        await DonationPayment.create({
          donationId: donation._id,
          amountCents: amount,
          currency: donation.currency,
          status: 'succeeded',
          stripeInvoiceId,
          paidAt: new Date(),
        });
      }

      if (donation.status !== 'succeeded' && donation.status !== 'refunded') {
        donation.status = 'succeeded';
        donation.pastDue = false;
        await donation.save();
      }

      const receipt = await this.issueReceipt(donation);
      if (receipt) {
        await DonationPayment.updateOne({ stripeInvoiceId }, { $set: { receiptId: receipt._id } });
        try {
          await this.sendDonationReceiptEmail(donation, receipt);
        } catch (err) {
          logger.error({ err, stripeInvoiceId }, 'Failed to email recurring donation receipt');
        }
      }
    } else if (status === 'failed') {
      if (donation.status === 'cancelled' || donation.status === 'refunded') return;
      donation.pastDue = true;
      if (donation.frequency === 'monthly' && donation.status !== 'succeeded') {
        donation.status = 'failed';
      }
      await donation.save();
      await DonationPayment.updateOne(
        { stripeInvoiceId },
        { $set: { status: 'failed', failureReason: 'Invoice payment failed' } },
        { upsert: true },
      );
    }
  }

  async handleSubscriptionDeleted(stripeSubscriptionId: string): Promise<void> {
    if (!stripeSubscriptionId) return;
    const donation = await Donation.findOne({ stripeSubscriptionId });
    if (!donation || donation.status === 'cancelled') return;
    donation.status = 'cancelled';
    donation.cancelledAt = new Date();
    donation.cancellationReason = 'Cancelled via Stripe';
    await donation.save();
  }

  /**
   * Confirm payment after browser Stripe success (same pattern as checkout/membership).
   * Server verifies Stripe PI status — never trusts the browser alone.
   * Webhook remains backup. Idempotent.
   */
  async confirmPaymentIntent(donationId: string, userId?: string): Promise<{ status: string; receiptNumber?: string }> {
    const donation = await Donation.findById(donationId);
    if (!donation) {
      throw new Error('Donation not found');
    }
    if (userId && String(donation.supporterUserId) !== userId) {
      throw new Error('Donation not found');
    }

    if (donation.status === 'succeeded') {
      const receipt = donation.receiptId ? await DonationReceipt.findById(donation.receiptId).lean() : null;
      return { status: 'succeeded', receiptNumber: receipt?.receiptNumber };
    }
    if (donation.status === 'refunded' || donation.status === 'cancelled') {
      return { status: donation.status };
    }

    const piId = donation.stripePaymentIntentId;
    if (!piId) {
      throw new Error('No payment session for this donation');
    }

    // Fake/demo PI in local fake mode only
    if (isFakeMode() && isFakePaymentIntentId(piId)) {
      await this.handlePaymentIntentUpdate(piId, 'succeeded', 'confirm_fake_mode');
    } else if (isFakePaymentIntentId(piId)) {
      // Demo PI outside fake mode — do not mark succeeded
      throw new Error('Payment session is not valid in this environment');
    } else {
      // Real Stripe test/live — retrieve authoritative status
      let stripeStatus: string | undefined;
      try {
        const payment = await stripePaymentProvider.retrievePaymentIntent(piId);
        stripeStatus = payment.status;
      } catch (err: any) {
        // Fallback: query Stripe client directly if provider wrapper fails
        try {
          const stripe = getStripeClient();
          const intent = await stripe.paymentIntents.retrieve(piId);
          stripeStatus = intent.status;
        } catch (err2: any) {
          logger.error({ err: err2, donationId, piId }, 'Donation confirm: Stripe retrieve failed');
          throw new Error('Unable to verify payment with Stripe. Please try again shortly.');
        }
      }

      if (stripeStatus !== 'succeeded' && stripeStatus !== 'requires_capture') {
        return { status: donation.status === 'pending' ? 'pending' : donation.status };
      }

      await this.handlePaymentIntentUpdate(piId, 'succeeded', 'confirm_endpoint');
    }

    const updated = await Donation.findById(donationId);
    const receipt = updated?.receiptId ? await DonationReceipt.findById(updated.receiptId).lean() : null;
    return {
      status: updated?.status || 'succeeded',
      receiptNumber: receipt?.receiptNumber,
    };
  }

  /** Webhook: mark donation payment succeeded/failed by PaymentIntent.
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

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const donationService = new DonationService();
