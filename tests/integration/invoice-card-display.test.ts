import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { Order, Invoice, User, UserMembership, MembershipTier } from '@pawtag/db';
import { generateCreditNoteHtml, generateInvoiceHtml } from '../../packages/api/src/services/invoice-html.service';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

async function createUser(fullName = 'Card Test User') {
  const user = await User.create({
    email: `card-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    passwordHash: 'x',
    fullName,
    phoneNumber: '+64210000000',
    role: 'customer',
    status: 'active',
    emailVerified: true,
  });
  return user;
}

describe('invoice HTML card display', () => {
  it('shows card brand and last4 on credit notes when Order has payment card', async () => {
    const user = await createUser('Credit Note User');
    const order = await Order.create({
      orderNumber: 'PT-CARD-CN-1',
      userId: user._id,
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Scan',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'cancelled',
      payment: {
        method: 'card',
        status: 'refunded',
        transactionId: 'pi_card_cn_1',
        stripePaymentIntentId: 'pi_card_cn_1',
        amount: 19.99,
        currency: 'NZD',
        paidAt: new Date(),
        cardBrand: 'visa',
        cardLast4: '4242',
      },
      shippingAddress: {
        line1: '1 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    const invoice = await Invoice.create({
      type: 'credit_note',
      orderId: order._id,
      userId: user._id,
      invoiceNumber: `CN-TEST-${Date.now()}`,
      amount: 19.99,
      currency: 'NZD',
      status: 'paid',
      paidAt: new Date(),
    });

    const html = await generateCreditNoteHtml(invoice._id.toString());
    expect(html).toContain('Card:');
    expect(html).toContain('4242');
    expect(html).toContain('pi_card_cn_1');
  });

  it('shows card brand and last4 on membership invoices from UserMembership', async () => {
    const user = await createUser('Membership Invoice User');
    const tier = await MembershipTier.create({
      tier: 'gold',
      name: 'gold',
      displayName: 'Gold',
      description: 'Gold membership',
      price: 99,
      currency: 'NZD',
      tagLimit: 3,
    });

    const now = new Date();
    const membership = await UserMembership.create({
      userId: user._id,
      tierId: tier._id,
      status: 'active',
      price: 99,
      currency: 'NZD',
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      stripeSubscriptionId: 'sub_card_test_1',
      cardBrand: 'mastercard',
      cardLast4: '5555',
    });

    const invoice = await Invoice.create({
      type: 'invoice',
      userId: user._id,
      userMembershipId: membership._id,
      invoiceNumber: `INVM-TEST-${Date.now()}`,
      amount: 99,
      currency: 'NZD',
      status: 'paid',
      paidAt: new Date(),
      stripeSubscriptionId: 'sub_card_test_1',
    });

    const html = await generateInvoiceHtml(invoice._id.toString());
    expect(html).toContain('Card:');
    expect(html).toContain('5555');
  });
});
