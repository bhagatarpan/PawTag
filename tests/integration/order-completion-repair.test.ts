import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { checkoutService } from '../../packages/api/src/commerce/services/checkout.service';
import { clearCache as clearCommerceConfigCache } from '../../packages/api/src/commerce/config';

const providerMocks = vi.hoisted(() => ({
  createRefund: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  createPaymentIntent: vi.fn(),
}));

vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: providerMocks,
}));

/**
 * Order completion repair — regression suite for the WO-000505 failure
 * mode: payment succeeded, the confirm request died mid-pipeline, and the
 * order stayed at completionStatus 'pending' forever with no invoice,
 * emails, entitlements, or fulfilment. Any re-confirm must RESUME the
 * completion (not return the half-done order), the pipeline must be
 * idempotent on re-run, and the repair job must find stuck orders.
 */

async function createCustomer(): Promise<string> {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const res = await mongoose.connection.collections.users.insertOne({
    email: `completion-repair-${Date.now()}-${Math.random()}@example.com`,
    passwordHash,
    fullName: 'Repair Tester',
    phoneNumber: '+64218888888',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return res.insertedId.toString();
}

async function createProduct(stock: number): Promise<string> {
  const res = await mongoose.connection.collections.products.insertOne({
    name: 'Repair Test Tag',
    sku: `RPR-${Date.now()}`,
    price: 29.98,
    productType: 'physical',
    stock,
    reserved: stock,
    stockPolicy: 'deny',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return res.insertedId.toString();
}

/** Create the "WO-000505" preconditions: paid order + converted pending,
 *  completionStatus pending, no invoice, no payment transaction.
 *  `paymentExtra` adds fields such as `cardBrand`/`cpf` snapshots. */
async function createStuckOrder(userId: string, productId: string, intentId: string, paymentExtra: Record<string, any> = {}) {
  const pendingRes = await mongoose.connection.collections.pendingorders.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    items: [{ productId: new mongoose.Types.ObjectId(productId), productName: 'Repair Test Tag', sku: 'RPR-1', unitPrice: 29.98, customizationTotal: 0, quantity: 1 }],
    subtotal: 25.19, shipping: 0, tax: 4.79, discount: 0, total: 29.98, currency: 'NZD',
    status: 'converted',
    stripePaymentIntentId: intentId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(), updatedAt: new Date(),
  });
  const orderRes = await mongoose.connection.collections.orders.insertOne({
    orderNumber: `WO-RPR-${Date.now()}`,
    userId: new mongoose.Types.ObjectId(userId),
    items: [{ productId: new mongoose.Types.ObjectId(productId), productName: 'Repair Test Tag', sku: 'RPR-1', unitPrice: 29.98, totalPrice: 29.98, customizationTotal: 0, quantity: 1 }],
    subtotal: 25.19, shippingCost: 0, tax: 4.79, status: 'paid', completionStatus: 'pending',
    shippingAddress: { line1: '1 Repair Street', city: 'Auckland', zip: '1010', country: 'New Zealand' },
    payment: { method: 'card', status: 'completed', transactionId: intentId, stripePaymentIntentId: intentId, amount: 29.98, currency: 'NZD', paidAt: new Date(), ...paymentExtra },
    createdBy: 'Repair Tester', createdByType: 'Customer', createdByPortal: 'customer-web',
    activity: [{ type: 'order_placed', message: 'Order placed and paid', timestamp: new Date(), actor: 'customer' }],
    createdAt: new Date(), updatedAt: new Date(),
  });
  await mongoose.connection.collections.pendingorders.updateOne(
    { _id: pendingRes.insertedId },
    { $set: { convertedOrderId: orderRes.insertedId, convertedAt: new Date() } },
  );
  return { orderId: orderRes.insertedId.toString(), pendingId: pendingRes.insertedId.toString() };
}

beforeAll(async () => { await setupTestDb(); }, 30000);
afterAll(async () => { await teardownTestDb(); }, 30000); // matches vitest hookTimeout — memory-server stop is IO-bound under parallel suites
beforeEach(async () => { await clearDb(); });

describe('Order completion repair (WO-000505 regression)', () => {
  it('resumeOrderCompletion finishes an interrupted order: invoice + transaction + status complete', async () => {
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const { orderId } = await createStuckOrder(userId, productId, 'pi_repair_001');

    const result = await checkoutService.resumeOrderCompletion(orderId);

    expect(result).not.toBeNull();
    const { Order, Invoice, PaymentTransaction } = await import('@pawtag/db');
    const order = await Order.findById(orderId).lean();
    expect(order!.completionStatus, JSON.stringify(order!.completionErrors)).toBe('complete');
    const invoice = await Invoice.findOne({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(invoice).toBeTruthy();
    expect(invoice!.invoiceNumber).toMatch(/^INV-/);
    const txn = await PaymentTransaction.findOne({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(txn).toBeTruthy();
    expect(txn!.providerTransactionId).toBe('pi_repair_001');
  });

  it('is idempotent — a second resume never duplicates invoice, transaction, points, or stock deduction', async () => {
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const { orderId } = await createStuckOrder(userId, productId, 'pi_repair_002');

    await checkoutService.resumeOrderCompletion(orderId);
    await checkoutService.resumeOrderCompletion(orderId);

    const { Invoice, PaymentTransaction, GuardianPointsLedger, Product } = await import('@pawtag/db');
    expect(await Invoice.countDocuments({ orderId: new mongoose.Types.ObjectId(orderId) })).toBe(1);
    expect(await PaymentTransaction.countDocuments({ orderId: new mongoose.Types.ObjectId(orderId) })).toBe(1);
    // Guardian points awarded exactly once
    expect(await GuardianPointsLedger.countDocuments({ activity: 'purchase', referenceId: orderId })).toBe(1);
    // Stock deducted exactly once (10 - 1 = 9, reserved stays 9)
    const product = await Product.findById(productId).lean();
    expect(product!.stock).toBe(9);
    expect(product!.reserved).toBe(9);
  });

  it('confirmCheckout on an existing interrupted order RESUMES completion instead of returning it half-done', async () => {
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const intentId = 'pi_repair_003';
    const { orderId } = await createStuckOrder(userId, productId, intentId);

    // Simulate the customer/frontend retrying the confirm
    const result = await checkoutService.confirmCheckout(userId, intentId, 'customer-web');

    expect(String(result.order._id)).toBe(orderId);
    const { Order, Invoice } = await import('@pawtag/db');
    const order = await Order.findById(orderId).lean();
    expect(order!.completionStatus).toBe('complete');
    expect(await Invoice.countDocuments({ orderId: new mongoose.Types.ObjectId(orderId) })).toBe(1);
  });

  it('repair job finds and repairs stuck orders older than the threshold', async () => {
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const { orderId } = await createStuckOrder(userId, productId, 'pi_repair_004');
    // Backdate so it is past the 10-minute stuck threshold
    await mongoose.connection.collections.orders.updateOne(
      { _id: new mongoose.Types.ObjectId(orderId) },
      { $set: { createdAt: new Date(Date.now() - 15 * 60 * 1000) } },
    );

    const { runOrderCompletionRepairJob } = await import('../../packages/api/src/jobs/orderCompletionRepair');
    const jobResult = await runOrderCompletionRepairJob();
    expect(jobResult.success).toBe(true);

    const { Order } = await import('@pawtag/db');
    const order = await Order.findById(orderId).lean();
    expect(order!.completionStatus).toBe('complete');
  });

  it('does not resume orders that are already complete', async () => {
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const { orderId } = await createStuckOrder(userId, productId, 'pi_repair_005');
    await checkoutService.resumeOrderCompletion(orderId);

    // A second explicit resume of a COMPLETE order is a no-op returning null
    const again = await checkoutService.resumeOrderCompletion(orderId);
    expect(again).toBeNull();
  });
});

describe('CPF post-capture step on the repair path (step 7c)', () => {
  const cpfSnapshot = { amount: 1.86, gst: 0.24, percent: 2.65, fixed: 0.3, scheduleVersion: 'v1', refundedAmount: 0 };

  // Each test seeds its own appliesTo value — defeat the 60s settings cache
  beforeEach(() => {
    clearCommerceConfigCache();
  });

  /** Old default appliesTo (no amex) — an Amex capture must get the fee back. */
  async function seedCpfAppliesTo(value: string) {
    await mongoose.connection.collections.settings.insertOne({
      key: 'commerce.cpf.appliesTo',
      value,
      category: 'commerce',
      updatedBy: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  it('auto-refunds the card fee for an Amex order resumed by the repair path — and records it durably', async () => {
    vi.clearAllMocks();
    providerMocks.createRefund.mockResolvedValue({ success: true, refundId: 're_cpf_repair_1', status: 'succeeded' });
    await seedCpfAppliesTo('visa,mastercard');
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const { orderId } = await createStuckOrder(userId, productId, 'pi_repair_cpf_001', {
      cardBrand: 'amex',
      cardLast4: '1005',
      cpf: { ...cpfSnapshot },
    });

    const result = await checkoutService.resumeOrderCompletion(orderId);

    expect(result).not.toBeNull();
    const { Order, PaymentTransaction } = await import('@pawtag/db');
    const order = await Order.findById(orderId).lean();
    expect(order!.completionErrors ?? []).toHaveLength(0);
    expect(order!.completionStatus).toBe('complete');
    // Brand recorded on the snapshot, fee refunded exactly once
    expect(order!.payment.cpf.cardNetwork).toBe('amex');
    expect(order!.payment.cpf.refundedAmount).toBe(1.86);
    expect(providerMocks.createRefund).toHaveBeenCalledTimes(1);
    expect(providerMocks.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: 'pi_repair_cpf_001', amount: 1.86 }),
    );
    const refundTxn = await PaymentTransaction.findOne({
      orderId: new mongoose.Types.ObjectId(orderId),
      type: 'refund',
    }).lean();
    expect(refundTxn).toBeTruthy();
    expect(refundTxn!.amount).toBe(1.86);
    expect(refundTxn!.providerTransactionId).toBe('re_cpf_repair_1');
  });

  it('keeps the fee when the captured brand is covered by appliesTo (Visa) — no refund, order completes', async () => {
    vi.clearAllMocks();
    await seedCpfAppliesTo('visa,mastercard,amex');
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const { orderId } = await createStuckOrder(userId, productId, 'pi_repair_cpf_002', {
      cardBrand: 'visa',
      cardLast4: '4242',
      cpf: { ...cpfSnapshot },
    });

    const result = await checkoutService.resumeOrderCompletion(orderId);

    expect(result).not.toBeNull();
    const { Order } = await import('@pawtag/db');
    const order = await Order.findById(orderId).lean();
    expect(order!.completionErrors ?? []).toHaveLength(0);
    expect(order!.completionStatus).toBe('complete');
    expect(order!.payment.cpf.cardNetwork).toBe('visa');
    expect(order!.payment.cpf.refundedAmount || 0).toBe(0);
    expect(providerMocks.createRefund).not.toHaveBeenCalled();
  });

  it('backfills the card brand from Stripe when the order has none before deciding on the fee', async () => {
    vi.clearAllMocks();
    providerMocks.retrievePaymentIntent.mockResolvedValue({ cardBrand: 'amex', cardLast4: '1005', cardCountry: 'nz' });
    providerMocks.createRefund.mockResolvedValue({ success: true, refundId: 're_cpf_repair_3', status: 'succeeded' });
    await seedCpfAppliesTo('visa,mastercard');
    const userId = await createCustomer();
    const productId = await createProduct(10);
    const { orderId } = await createStuckOrder(userId, productId, 'pi_repair_cpf_003', {
      cpf: { ...cpfSnapshot },
    });

    const result = await checkoutService.resumeOrderCompletion(orderId);

    expect(result).not.toBeNull();
    expect(providerMocks.retrievePaymentIntent).toHaveBeenCalledWith('pi_repair_cpf_003');
    const { Order } = await import('@pawtag/db');
    const order = await Order.findById(orderId).lean();
    expect(order!.completionStatus).toBe('complete');
    expect(order!.payment.cardBrand).toBe('amex');
    expect(order!.payment.cpf.cardNetwork).toBe('amex');
    expect(order!.payment.cpf.cardCountry).toBe('nz');
    expect(order!.payment.cpf.refundedAmount).toBe(1.86);
  });
});
