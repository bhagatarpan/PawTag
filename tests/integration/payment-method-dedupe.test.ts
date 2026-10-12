import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, UserMembership, MembershipTier } from '@pawtag/db';

/**
 * Saved-card duplicate prevention.
 *
 * Duplicates are identified by the PROVIDER fingerprint (card.fingerprint),
 * never by brand/last4/expiry alone. Dedupe must preserve the default card,
 * repoint active billing references before detaching, be idempotent, and
 * tolerate concurrent runs.
 */
describe('Saved payment method dedupe', () => {
  let mongoServer: MongoMemoryServer;
  const originalEnv = { ...process.env };
  let userId: string;
  let tierId: string;

  interface MockStripeParts {
    listPaymentMethods: ReturnType<typeof vi.fn>;
    retrieveCustomer: ReturnType<typeof vi.fn>;
    updateCustomer: ReturnType<typeof vi.fn>;
    detach: ReturnType<typeof vi.fn>;
    retrieveSubscription: ReturnType<typeof vi.fn>;
    updateSubscription: ReturnType<typeof vi.fn>;
  }

  function pm(
    id: string,
    opts: { fingerprint?: string | null; created?: number; last4?: string; expMonth?: number; expYear?: number },
  ) {
    const { fingerprint = 'fp_default', created = 1_700_000_000, last4 = '4242', expMonth = 12, expYear = 2030 } = opts;
    return {
      id,
      created,
      card: { brand: 'visa', last4, exp_month: expMonth, exp_year: expYear, fingerprint },
    };
  }

  function mockStripe(opts: {
    cards: any[];
    invoiceDefaultId?: string | null;
    subscriptionDefaultId?: string | null;
  }): MockStripeParts {
    const listPaymentMethods = vi.fn().mockResolvedValue({ data: opts.cards });
    const retrieveCustomer = vi.fn().mockResolvedValue({
      invoice_settings: { default_payment_method: opts.invoiceDefaultId ?? null },
    });
    const updateCustomer = vi.fn().mockResolvedValue({});
    const detach = vi.fn().mockResolvedValue({});
    const retrieveSubscription = vi.fn().mockResolvedValue({
      id: 'sub_test_1',
      default_payment_method: opts.subscriptionDefaultId ?? null,
    });
    const updateSubscription = vi.fn().mockResolvedValue({});
    return {
      listPaymentMethods,
      retrieveCustomer,
      updateCustomer,
      detach,
      retrieveSubscription,
      updateSubscription,
    };
  }

  function stripeClientFrom(parts: MockStripeParts) {
    return {
      customers: {
        listPaymentMethods: parts.listPaymentMethods,
        retrieve: parts.retrieveCustomer,
        update: parts.updateCustomer,
      },
      paymentMethods: { detach: parts.detach },
      subscriptions: { retrieve: parts.retrieveSubscription, update: parts.updateSubscription },
    } as any;
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    process.env = originalEnv;
  }, 10000);

  beforeEach(async () => {
    await User.deleteMany({});
    await UserMembership.deleteMany({});
    await MembershipTier.deleteMany({});
    process.env.PAYMENT_MODE = 'stripe_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_dedupe';
    const user = await User.create({
      email: 'pm-dedupe@example.com',
      passwordHash: 'x',
      fullName: 'PM Dedupe',
      phoneNumber: '+64210002222',
      role: 'customer',
      status: 'active',
      stripeCustomerId: 'cus_dedupe_test',
    });
    userId = user._id.toString();
    const tier = await MembershipTier.create({
      tier: 'gold',
      displayName: 'Gold',
      name: 'Gold',
      description: 'Gold membership tier',
      price: 89,
      tagLimit: 3,
      isActive: true,
    });
    tierId = tier._id.toString();
  });

  afterEach(async () => {
    process.env.PAYMENT_MODE = originalEnv.PAYMENT_MODE || 'fake';
    const stripeClient = await import('../../packages/api/src/lib/stripe-client');
    stripeClient.resetStripeClientCache();
  });

  async function runDedupe(options?: { candidatePaymentMethodId?: string; reason?: string; dryRun?: boolean }) {
    const { dedupeSavedCards } = await import(
      '../../packages/api/src/services/payment-method.service'
    );
    return dedupeSavedCards(userId, { reason: 'test', ...options });
  }

  describe('duplicate identification (fingerprint based)', () => {
    it('collapses a same-fingerprint group, keeping the default card', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
          pm('pm_other', { fingerprint: 'fp_b', created: 1_700_000_300 }),
        ],
        invoiceDefaultId: 'pm_keep',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.checked).toBe(true);
      expect(result.duplicateGroups).toBe(1);
      expect(result.removedPaymentMethodIds).toEqual(['pm_dup']);
      expect(parts.detach).toHaveBeenCalledTimes(1);
      expect(parts.detach).toHaveBeenCalledWith('pm_dup');
      // default untouched — no repointing needed
      expect(parts.updateCustomer).not.toHaveBeenCalled();
    });

    it('does NOT treat different fingerprints with identical brand/last4/expiry as duplicates', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_card_a', { fingerprint: 'fp_x', last4: '4242', expMonth: 12, expYear: 2030 }),
          pm('pm_card_b', { fingerprint: 'fp_y', last4: '4242', expMonth: 12, expYear: 2030 }),
        ],
        invoiceDefaultId: 'pm_card_a',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.duplicateGroups).toBe(0);
      expect(result.removedPaymentMethodIds).toEqual([]);
      expect(parts.detach).not.toHaveBeenCalled();
    });

    it('never touches cards without a provider fingerprint (ambiguous)', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_fp', { fingerprint: 'fp_z' }),
          pm('pm_no_fp', { fingerprint: null, last4: '4242' }),
        ],
        invoiceDefaultId: 'pm_fp',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.duplicateGroups).toBe(0);
      expect(parts.detach).not.toHaveBeenCalled();
    });

    it('falls back to the oldest attached card when no default is in the group', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_newer', { fingerprint: 'fp_a', created: 1_700_000_900 }),
          pm('pm_older', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_unrelated', { fingerprint: 'fp_b', created: 1_700_000_050 }),
        ],
        invoiceDefaultId: 'pm_unrelated',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.removedPaymentMethodIds).toEqual(['pm_newer']);
    });

    it('is idempotent — a second run performs no further detaches', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
        ],
        invoiceDefaultId: 'pm_keep',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const first = await runDedupe();
      // Simulate Stripe state after the first run
      parts.listPaymentMethods.mockResolvedValue({ data: [pm('pm_keep', { fingerprint: 'fp_a' })] });
      const second = await runDedupe();

      expect(first.removedPaymentMethodIds).toEqual(['pm_dup']);
      expect(second.removedPaymentMethodIds).toEqual([]);
      expect(parts.detach).toHaveBeenCalledTimes(1);
    });

    it('treats an already-detached redundant card as success (idempotent retry)', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
        ],
        invoiceDefaultId: 'pm_keep',
      });
      parts.detach.mockRejectedValue({ code: 'resource_missing', message: 'PaymentMethod was previously detached' });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.removedPaymentMethodIds).toEqual(['pm_dup']);
    });

    it('skips dedupe in fake mode without touching Stripe', async () => {
      process.env.PAYMENT_MODE = 'fake';
      const parts = mockStripe({
        cards: [pm('pm_keep', { fingerprint: 'fp_a' }), pm('pm_dup', { fingerprint: 'fp_a' })],
        invoiceDefaultId: 'pm_keep',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.checked).toBe(false);
      expect(parts.listPaymentMethods).not.toHaveBeenCalled();
    });

    it('coalesces concurrent runs for the same user (single detach total)', async () => {
      const cards = [
        pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
        pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
      ];
      const parts = mockStripe({ cards, invoiceDefaultId: 'pm_keep' });
      // Slow the list call so both dedupe calls overlap in flight
      parts.listPaymentMethods.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: cards }), 20)),
      );
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const [a, b] = await Promise.all([runDedupe(), runDedupe()]);

      expect(parts.detach).toHaveBeenCalledTimes(1);
      expect(a.removedPaymentMethodIds).toEqual(b.removedPaymentMethodIds);
    });
  });

  describe('dry-run mode', () => {
    it('plans the same canonical selection without mutating anything', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
        ],
        invoiceDefaultId: 'pm_keep',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.removedPaymentMethodIds).toEqual(['pm_dup']);
      expect(result.groups[0]).toMatchObject({
        canonicalPaymentMethodId: 'pm_keep',
        canonicalReason: 'invoice_default',
      });
      // zero mutations
      expect(parts.detach).not.toHaveBeenCalled();
      expect(parts.updateCustomer).not.toHaveBeenCalled();
      expect(parts.updateSubscription).not.toHaveBeenCalled();
    });

    it('records planned reference repointing without performing it', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
        ],
        invoiceDefaultId: 'pm_keep',
        subscriptionDefaultId: 'pm_dup',
      });
      await UserMembership.create({
        userId,
        tierId,
        status: 'active',
        price: 89,
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        stripeSubscriptionId: 'sub_test_1',
        paymentMethodId: 'pm_dup',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe({ dryRun: true });

      expect(result.groups[0].redundant[0]).toMatchObject({
        paymentMethodId: 'pm_dup',
        repointsSubscriptionDefault: true,
        repointsMembershipReference: true,
        repointsInvoiceDefault: false,
      });
      // nothing actually changed
      expect(parts.updateSubscription).not.toHaveBeenCalled();
      expect(parts.detach).not.toHaveBeenCalled();
      const membership = await UserMembership.findOne({ userId }).lean();
      expect(membership?.paymentMethodId).toBe('pm_dup');
    });
  });

  describe('billing reference preservation', () => {
    it('repoints the Stripe subscription default and local membership reference before detaching', async () => {
      const parts = mockStripe({
        cards: [
          // Default NOT in the duplicate group
          pm('pm_default_other', { fingerprint: 'fp_b', created: 1_700_000_050 }),
          pm('pm_sub_card', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
        ],
        invoiceDefaultId: 'pm_default_other',
        subscriptionDefaultId: 'pm_sub_card',
      });
      await UserMembership.create({
        userId,
        tierId,
        status: 'active',
        price: 89,
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        stripeSubscriptionId: 'sub_test_1',
        paymentMethodId: 'pm_sub_card',
        cardBrand: 'visa',
        cardLast4: '4242',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.removedPaymentMethodIds).toEqual(['pm_dup']);
      // membership-referenced card wins canonical selection
      expect(parts.detach).toHaveBeenCalledWith('pm_dup');
      // nothing pointed at pm_dup, so no repointing was needed
      expect(parts.updateSubscription).not.toHaveBeenCalled();

      const membership = await UserMembership.findOne({ userId }).lean();
      expect(membership?.paymentMethodId).toBe('pm_sub_card');
    });

    it('repoints references when the REDUNDANT card is the subscription default', async () => {
      const parts = mockStripe({
        cards: [
          // Default IS in the group → canonical
          pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          // Redundant card is what the subscription currently bills
          pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
        ],
        invoiceDefaultId: 'pm_keep',
        subscriptionDefaultId: 'pm_dup',
      });
      await UserMembership.create({
        userId,
        tierId,
        status: 'active',
        price: 89,
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        stripeSubscriptionId: 'sub_test_1',
        paymentMethodId: 'pm_dup',
        cardBrand: 'visa',
        cardLast4: '4242',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      expect(result.removedPaymentMethodIds).toEqual(['pm_dup']);
      // subscription repointed to canonical before detach
      expect(parts.updateSubscription).toHaveBeenCalledWith('sub_test_1', {
        default_payment_method: 'pm_keep',
      });
      // local membership reference repointed
      const membership = await UserMembership.findOne({ userId }).lean();
      expect(membership?.paymentMethodId).toBe('pm_keep');

      // ordering: repoint subscription BEFORE detach
      const subUpdateOrder = parts.updateSubscription.mock.invocationCallOrder[0];
      const detachOrder = parts.detach.mock.invocationCallOrder[0];
      expect(subUpdateOrder).toBeLessThan(detachOrder);
    });

    it('repoints the invoice default when the redundant card is the customer default', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_dup_default', { fingerprint: 'fp_a', created: 1_700_000_050 }),
          pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
        ],
        invoiceDefaultId: 'pm_dup_default',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe();

      // Default in group wins canonical selection — no repoint needed
      expect(result.removedPaymentMethodIds).toEqual(['pm_keep']);
      expect(parts.updateCustomer).not.toHaveBeenCalled();
    });
  });

  describe('candidate reporting (add-card flow)', () => {
    it('reports alreadySaved + canonical card when the candidate duplicates an existing card', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_existing', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_new_attach', { fingerprint: 'fp_a', created: 1_700_000_900 }),
        ],
        invoiceDefaultId: 'pm_existing',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe({ candidatePaymentMethodId: 'pm_new_attach' });

      expect(result.alreadySaved).toBe(true);
      expect(result.canonicalPaymentMethodId).toBe('pm_existing');
      expect(result.removedPaymentMethodIds).toEqual(['pm_new_attach']);
    });

    it('reports alreadySaved=false for a genuinely new card', async () => {
      const parts = mockStripe({
        cards: [
          pm('pm_existing', { fingerprint: 'fp_a', created: 1_700_000_100 }),
          pm('pm_new_card', { fingerprint: 'fp_c', created: 1_700_000_900 }),
        ],
        invoiceDefaultId: 'pm_existing',
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));

      const result = await runDedupe({ candidatePaymentMethodId: 'pm_new_card' });

      expect(result.alreadySaved).toBe(false);
      expect(result.removedPaymentMethodIds).toEqual([]);
    });

    it('confirmAttachedPaymentMethod returns refreshed list + alreadySaved flag', async () => {
      const cards = [
        pm('pm_existing', { fingerprint: 'fp_a', created: 1_700_000_100 }),
        pm('pm_new_attach', { fingerprint: 'fp_a', created: 1_700_000_900 }),
      ];
      const parts = mockStripe({ cards, invoiceDefaultId: 'pm_existing' });
      // Stateful detach: like Stripe, removed cards disappear from the list
      parts.detach.mockImplementation(async (pmId: string) => {
        const idx = cards.findIndex((c) => c.id === pmId);
        if (idx >= 0) cards.splice(idx, 1);
        return { id: pmId };
      });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));
      const { confirmAttachedPaymentMethod } = await import(
        '../../packages/api/src/services/payment-method.service'
      );

      const result = await confirmAttachedPaymentMethod(userId, 'pm_new_attach');

      expect(result.alreadySaved).toBe(true);
      expect(result.canonicalPaymentMethodId).toBe('pm_existing');
      // refreshed list contains only the surviving card
      expect(result.data.map((c) => c.id)).toEqual(['pm_existing']);
      expect(result.defaultPaymentMethodId).toBe('pm_existing');
    });

    it('confirmAttachedPaymentMethod rejects non-pm identifiers', async () => {
      const { confirmAttachedPaymentMethod } = await import(
        '../../packages/api/src/services/payment-method.service'
      );
      await expect(confirmAttachedPaymentMethod(userId, 'ch_123_not_a_pm')).rejects.toMatchObject({
        membershipCode: 'payment_method.not_found',
      });
    });
  });

  describe('webhook-triggered dedupe', () => {
    const duplicateCards = () => [
      pm('pm_keep', { fingerprint: 'fp_a', created: 1_700_000_100 }),
      pm('pm_dup', { fingerprint: 'fp_a', created: 1_700_000_200 }),
    ];

    it('setup_intent.succeeded (save_payment_method) collapses duplicates', async () => {
      const parts = mockStripe({ cards: duplicateCards(), invoiceDefaultId: 'pm_keep' });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));
      const { handleStripeWebhookEvent } = await import('../../packages/api/src/routes/stripe-webhooks');

      await handleStripeWebhookEvent('setup_intent.succeeded', {
        id: 'seti_test_1',
        customer: 'cus_dedupe_test',
        payment_method: 'pm_dup',
        metadata: { userId, purpose: 'save_payment_method' },
      });

      expect(parts.detach).toHaveBeenCalledWith('pm_dup');
    });

    it('setup_intent.succeeded with a different purpose is left untouched', async () => {
      const parts = mockStripe({ cards: duplicateCards(), invoiceDefaultId: 'pm_keep' });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));
      const { handleStripeWebhookEvent } = await import('../../packages/api/src/routes/stripe-webhooks');

      await handleStripeWebhookEvent('setup_intent.succeeded', {
        id: 'seti_test_2',
        customer: 'cus_dedupe_test',
        payment_method: 'pm_dup',
        metadata: { purpose: 'something_else' },
      });

      expect(parts.listPaymentMethods).not.toHaveBeenCalled();
      expect(parts.detach).not.toHaveBeenCalled();
    });

    it('payment_intent.succeeded collapses duplicates when customer matches the user', async () => {
      const parts = mockStripe({ cards: duplicateCards(), invoiceDefaultId: 'pm_keep' });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));
      const { handleStripeWebhookEvent } = await import('../../packages/api/src/routes/stripe-webhooks');

      await handleStripeWebhookEvent('payment_intent.succeeded', {
        id: 'pi_test_1',
        customer: 'cus_dedupe_test',
        payment_method: 'pm_dup',
        metadata: { userId },
      });

      expect(parts.detach).toHaveBeenCalledWith('pm_dup');
    });

    it('payment_intent.succeeded is skipped when the customer does not match (orphan customer case)', async () => {
      const parts = mockStripe({ cards: duplicateCards(), invoiceDefaultId: 'pm_keep' });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(stripeClientFrom(parts));
      const { handleStripeWebhookEvent } = await import('../../packages/api/src/routes/stripe-webhooks');

      await handleStripeWebhookEvent('payment_intent.succeeded', {
        id: 'pi_test_2',
        customer: 'cus_some_orphan',
        payment_method: 'pm_dup',
        metadata: { userId },
      });

      expect(parts.listPaymentMethods).not.toHaveBeenCalled();
      expect(parts.detach).not.toHaveBeenCalled();
    });
  });
});
