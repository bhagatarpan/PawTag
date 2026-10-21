import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const processRefundMock = vi.fn();

vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: {
    createRefund: vi.fn(),
    retrievePaymentIntent: vi.fn(),
    retrieveRefund: vi.fn(),
  },
}));

vi.mock('../../packages/api/src/commerce/config', () => ({
  getBooleanSetting: vi.fn(async () => true),
  getNumberSetting: vi.fn(async () => 60),
}));

const findByIdMock = vi.fn();
const orderFindByIdMock = vi.fn();
const paymentFindMock = vi.fn();
const paymentCreateMock = vi.fn();
const orderUpdateMock = vi.fn();
const userFindMock = vi.fn();
const saveMock = vi.fn();
const notificationCreateMock = vi.fn();
const sendCmsEmailOrFallbackMock = vi.fn();
const tagFindMock = vi.fn();
const tagFindByIdMock = vi.fn();
const subscriptionFindMock = vi.fn();
const cancelSubscriptionMock = vi.fn();

vi.mock('@pawtag/db', async () => {
  const actual = await vi.importActual<any>('@pawtag/db');
  return {
    ...actual,
    Return: {
      findById: (...args: any[]) => findByIdMock(...args),
    },
    Order: {
      findById: (...args: any[]) => orderFindByIdMock(...args),
      updateOne: (...args: any[]) => orderUpdateMock(...args),
    },
    PaymentTransaction: {
      find: (...args: any[]) => paymentFindMock(...args),
      create: (...args: any[]) => paymentCreateMock(...args),
    },
    User: {
      findById: (...args: any[]) => userFindMock(...args),
    },
    Notification: {
      create: (...args: any[]) => notificationCreateMock(...args),
    },
    Fulfilment: {
      find: vi.fn().mockReturnValue({ lean: async () => [] }),
    },
    // Tag release wiring (docs/TAG-RELEASE-ON-CANCEL-REFUND.md) reads these
    // synchronously without a DB connection in this harness.
    Tag: {
      find: (...args: any[]) => tagFindMock(...args),
      findById: (...args: any[]) => tagFindByIdMock(...args),
    },
    Subscription: {
      find: (...args: any[]) => subscriptionFindMock(...args),
    },
  };
});

vi.mock('../../packages/api/src/services/subscription.service', () => ({
  cancelSubscription: (...args: any[]) => cancelSubscriptionMock(...args),
}));

vi.mock('../../packages/api/src/services/email.service', () => ({
  sendMail: vi.fn(async () => true),
  sendCmsEmailOrFallback: (...args: any[]) => sendCmsEmailOrFallbackMock(...args),
}));

const createCreditNoteMock = vi.fn();
const buildCreditNotePdfAttachmentMock = vi.fn();
vi.mock('../../packages/api/src/commerce/services/credit-note.service', () => ({
  createCreditNoteForRefund: (...args: any[]) => createCreditNoteMock(...args),
  buildCreditNotePdfAttachment: (...args: any[]) => buildCreditNotePdfAttachmentMock(...args),
  findCreditNoteForRefund: vi.fn(),
}));

import { returnRefundService, computeRemainingRefundCents, isFullRefundAmount } from '../../packages/api/src/commerce/services/return-refund.service';
import { stripePaymentProvider } from '../../packages/api/src/commerce/providers/stripe';

function chainable(obj: Record<string, any>) {
  const target: any = {
    ...obj,
    populate: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    save: saveMock,
  };
  return target;
}

/** Tag.find(...) query stand-in — supports both .select() (release service)
 *  and .lean() (detach resolver) with the same canned result. */
function tagQueryChain(result: any[]) {
  const q: any = {};
  q.select = vi.fn(() => Promise.resolve(result));
  q.lean = vi.fn(() => Promise.resolve(result));
  return q;
}

describe('returnRefundService.processRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveMock.mockResolvedValue(undefined);
    orderUpdateMock.mockResolvedValue({});
    paymentCreateMock.mockResolvedValue({});
    notificationCreateMock.mockResolvedValue({});
    sendCmsEmailOrFallbackMock.mockResolvedValue({ success: true });
    userFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: async () => null }),
      lean: async () => null,
    });
    // Tag-release wiring defaults: no live tags unless a test sets them up.
    tagFindMock.mockReturnValue(tagQueryChain([]));
    tagFindByIdMock.mockResolvedValue(null);
    subscriptionFindMock.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    cancelSubscriptionMock.mockResolvedValue(undefined);
  });

  it('rejects when reason is missing', async () => {
    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: '   ',
      actor: { id: 'admin1', type: 'admin' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/reason is required/i);
  });

  it('rejects when warehouse receipt missing and no exception', async () => {
    findByIdMock.mockReturnValue(chainable({
      _id: 'r1',
      status: 'approved',
      refundAmount: 10,
      items: [],
      reason: 'damaged',
    }));

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'damaged item',
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/warehouse receipt/i);
    expect(stripePaymentProvider.createRefund).not.toHaveBeenCalled();
  });

  it('processes refund after received and persists Stripe result', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'received',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: 'o1',
      orderNumber: 'WO-000486',
    });
    findByIdMock.mockReturnValue(ret);

    orderFindByIdMock.mockReturnValue(chainable({
      _id: 'o1',
      orderNumber: 'WO-000486',
      status: 'delivered',
      userId: 'u1',
      payment: {
        amount: 9.99,
        currency: 'NZD',
        paidAt: new Date(),
        stripePaymentIntentId: 'pi_test',
        cardBrand: 'visa',
        cardLast4: '4242',
      },
    }));

    paymentFindMock.mockResolvedValue([]);
    paymentFindMock.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue([]),
    }));
    (stripePaymentProvider.createRefund as any).mockResolvedValue({
      success: true,
      refundId: 're_test_1',
      status: 'succeeded',
      arn: 'arn_test',
    });

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'damaged item',
      actor: { id: 'admin1', email: 'csr@pawtag.co.nz', type: 'admin' },
    });

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('re_test_1');
    expect(stripePaymentProvider.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: 'pi_test',
        amount: 9.99,
      }),
    );
    expect(paymentCreateMock).toHaveBeenCalled();
  });

  it('emails the customer the credit note number/link and attaches the credit note PDF', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'received',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: 'o1',
      orderNumber: 'WO-000486',
    });
    findByIdMock.mockReturnValue(ret);
    orderFindByIdMock.mockReturnValue(chainable({
      _id: 'o1',
      orderNumber: 'WO-000486',
      status: 'delivered',
      userId: 'u1',
      payment: {
        amount: 9.99,
        currency: 'NZD',
        paidAt: new Date(),
        stripePaymentIntentId: 'pi_test',
        cardBrand: 'visa',
        cardLast4: '4242',
      },
    }));
    paymentFindMock.mockImplementation(() => ({ select: vi.fn().mockResolvedValue([]) }));
    (stripePaymentProvider.createRefund as any).mockResolvedValue({
      success: true,
      refundId: 're_test_1',
      status: 'succeeded',
      arn: 'arn_test',
    });
    userFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: async () => ({ email: 'customer@test.com', fullName: 'Test Customer' }) }),
    });
    const creditNote = { _id: 'cn1', invoiceNumber: 'CN-000042' };
    createCreditNoteMock.mockResolvedValue(creditNote);
    const attachment = { filename: 'CN-000042.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.7') };
    buildCreditNotePdfAttachmentMock.mockResolvedValue(attachment);

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'damaged item',
      actor: { id: 'admin1', email: 'csr@pawtag.co.nz', type: 'admin' },
    });

    expect(result.success).toBe(true);
    expect(createCreditNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({ refundId: 're_test_1' }),
    );
    expect(buildCreditNotePdfAttachmentMock).toHaveBeenCalledWith('cn1', 'CN-000042');
    expect(sendCmsEmailOrFallbackMock).toHaveBeenCalledTimes(1);
    const params = sendCmsEmailOrFallbackMock.mock.calls[0][0];
    expect(params.slug).toBe('refund-processed-csr');
    expect(params.vars.creditNoteNumber).toBe('CN-000042');
    expect(params.vars.creditNoteUrl).toContain('/account/invoices/cn1');
    expect(params.attachments).toEqual([attachment]);
    expect(params.fallbackHtml).toContain('Credit Note: CN-000042');
  });

  it('creates a customer in-app notification (partial refunds never change order status)', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'received',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: 'o1',
      orderNumber: 'WO-000486',
    });
    findByIdMock.mockReturnValue(ret);
    orderFindByIdMock.mockReturnValue(chainable({
      _id: 'o1',
      orderNumber: 'WO-000486',
      status: 'delivered',
      userId: 'u1',
      payment: {
        amount: 9.99,
        currency: 'NZD',
        paidAt: new Date(),
        stripePaymentIntentId: 'pi_test',
      },
    }));
    paymentFindMock.mockImplementation(() => ({ select: vi.fn().mockResolvedValue([]) }));
    (stripePaymentProvider.createRefund as any).mockResolvedValue({
      success: true,
      refundId: 're_test_1',
      status: 'succeeded',
    });
    userFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: async () => ({ email: 'customer@test.com', fullName: 'Test Customer' }) }),
    });
    createCreditNoteMock.mockResolvedValue(null);

    await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'damaged item',
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(notificationCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        audience: 'customer',
        type: 'refund_update',
        priority: 'high',
        data: expect.objectContaining({ orderId: 'o1', refundId: 're_test_1' }),
      }),
    );
  });

  it('credit note PDF failure never blocks the refund email — it sends without attachment', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'received',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: 'o1',
      orderNumber: 'WO-000486',
    });
    findByIdMock.mockReturnValue(ret);
    orderFindByIdMock.mockReturnValue(chainable({
      _id: 'o1',
      orderNumber: 'WO-000486',
      status: 'delivered',
      userId: 'u1',
      payment: {
        amount: 9.99,
        currency: 'NZD',
        paidAt: new Date(),
        stripePaymentIntentId: 'pi_test',
      },
    }));
    paymentFindMock.mockImplementation(() => ({ select: vi.fn().mockResolvedValue([]) }));
    (stripePaymentProvider.createRefund as any).mockResolvedValue({
      success: true,
      refundId: 're_test_1',
      status: 'succeeded',
    });
    userFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: async () => ({ email: 'customer@test.com', fullName: 'Test Customer' }) }),
    });
    createCreditNoteMock.mockResolvedValue({ _id: 'cn1', invoiceNumber: 'CN-000042' });
    buildCreditNotePdfAttachmentMock.mockRejectedValue(new Error('weasyprint missing'));

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'damaged item',
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(true);
    expect(sendCmsEmailOrFallbackMock).toHaveBeenCalledTimes(1);
    expect(sendCmsEmailOrFallbackMock.mock.calls[0][0].attachments).toBeUndefined();
  });

  it('fails closed when Stripe fails — does not mark refunded', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'received',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: 'o1',
      orderNumber: 'WO-000486',
    });
    findByIdMock.mockReturnValue(ret);

    orderFindByIdMock.mockReturnValue(chainable({
      _id: 'o1',
      orderNumber: 'WO-000486',
      status: 'delivered',
      userId: 'u1',
      payment: {
        amount: 9.99,
        currency: 'NZD',
        paidAt: new Date(),
        stripePaymentIntentId: 'pi_test',
      },
    }));

    paymentFindMock.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue([]),
    }));
    (stripePaymentProvider.createRefund as any).mockResolvedValue({
      success: false,
      error: 'card_declined',
    });

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'damaged item',
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(false);
    expect(result.refundStatus).toBe('failed');
    expect(ret.status).toBe('refund_failed');
    expect(ret.refundId).toBeUndefined();
  });

  it('allows refund without return when exception reason provided', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'approved',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: 'o1',
      orderNumber: 'WO-000486',
    });
    findByIdMock.mockReturnValue(ret);

    orderFindByIdMock.mockReturnValue(chainable({
      _id: 'o1',
      orderNumber: 'WO-000486',
      status: 'delivered',
      userId: 'u1',
      payment: {
        amount: 9.99,
        currency: 'NZD',
        paidAt: new Date(),
        stripePaymentIntentId: 'pi_test',
      },
    }));

    paymentFindMock.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue([]),
    }));
    (stripePaymentProvider.createRefund as any).mockResolvedValue({
      success: true,
      refundId: 're_test_2',
      status: 'succeeded',
    });

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'goodwill',
      exceptionReason: 'customer not returning item',
      refundWithoutReturn: true,
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(true);
    expect(ret.refundWithoutReturn).toBe(true);
  });

  it('rejects amount above remaining refundable balance', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'received',
      refundAmount: 100,
      items: [],
      reason: 'damaged',
      orderId: 'o1',
      orderNumber: 'WO-000486',
    });
    findByIdMock.mockReturnValue(ret);

    orderFindByIdMock.mockReturnValue(chainable({
      _id: 'o1',
      orderNumber: 'WO-000486',
      status: 'delivered',
      userId: 'u1',
      payment: {
        amount: 50,
        currency: 'NZD',
        paidAt: new Date(),
        stripePaymentIntentId: 'pi_test',
      },
    }));

    paymentFindMock.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue([{ amount: 40 }]),
    }));

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      amount: 20,
      reason: 'too much',
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds remaining/i);
    expect(stripePaymentProvider.createRefund).not.toHaveBeenCalled();
  });

  it('exposes remaining balance helpers for multi-refund math', () => {
    expect(computeRemainingRefundCents(20000, 5000)).toBe(15000);
    expect(isFullRefundAmount(20000, 5000, 15000)).toBe(true);
    expect(isFullRefundAmount(20000, 5000, 14999)).toBe(false);
  });
});

describe('returnRefundService.processRefund — tag release (docs/TAG-RELEASE-ON-CANCEL-REFUND.md)', () => {
  const tagA = new mongoose.Types.ObjectId();
  const tagB = new mongoose.Types.ObjectId();
  const orderOid = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    saveMock.mockResolvedValue(undefined);
    orderUpdateMock.mockResolvedValue({});
    paymentCreateMock.mockResolvedValue({});
    notificationCreateMock.mockResolvedValue({});
    sendCmsEmailOrFallbackMock.mockResolvedValue({ success: true });
    userFindMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: async () => null }),
      lean: async () => null,
    });
    tagFindMock.mockReturnValue(tagQueryChain([]));
    tagFindByIdMock.mockResolvedValue(null);
    subscriptionFindMock.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    cancelSubscriptionMock.mockResolvedValue(undefined);
    paymentFindMock.mockImplementation(() => ({ select: vi.fn().mockResolvedValue([]) }));
    (stripePaymentProvider.createRefund as any).mockResolvedValue({
      success: true,
      refundId: 're_release_1',
      status: 'succeeded',
    });
  });

  function deliveredOrder(amount = 9.99, items: any[] = []) {
    return chainable({
      _id: orderOid,
      orderNumber: 'WO-000700',
      status: 'delivered',
      userId: 'u1',
      ...(items.length > 0 ? { items } : {}),
      payment: { amount, currency: 'NZD', paidAt: new Date(), stripePaymentIntentId: 'pi_test' },
    });
  }

  it('FULL refund without return releases every unreturned tag (service stops)', async () => {
    const ret = chainable({
      _id: 'r1',
      status: 'approved',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: orderOid,
      orderNumber: 'WO-000700',
    });
    findByIdMock.mockReturnValue(ret);
    orderFindByIdMock.mockReturnValue(deliveredOrder());

    const liveTag = { _id: tagB, status: 'active', save: vi.fn(async () => undefined) };
    tagFindMock.mockReturnValue(tagQueryChain([{ _id: tagB }]));
    tagFindByIdMock.mockResolvedValue(liveTag);
    subscriptionFindMock.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: 'sub1' }]) });

    const result = await returnRefundService.processRefund({
      returnId: 'r1',
      reason: 'goodwill',
      exceptionReason: 'customer not returning item',
      refundWithoutReturn: true,
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(true);
    expect(ret.refundWithoutReturn).toBe(true);
    expect(liveTag.status).toBe('cancelled'); // paid back + goods kept → frozen
    expect(cancelSubscriptionMock).toHaveBeenCalledTimes(1);
  });

  it('INVARIANT: partial refund freezes ONLY the returned tags — the paid sibling keeps working', async () => {
    // Founder scenario: order has two tags; tag A refunded/returned, tag B
    // retained by the customer and PAID FOR → B must never be frozen.
    const ret = chainable({
      _id: 'r2',
      status: 'approved',
      refundAmount: 10,
      items: [{ orderItemId: 'oi1', quantity: 1, tagIds: [tagA] }],
      reason: 'partial',
      orderId: orderOid,
      orderNumber: 'WO-000700',
    });
    findByIdMock.mockReturnValue(ret);
    orderFindByIdMock.mockReturnValue(
      deliveredOrder(50, [
        // $50 order, $10 refund → partial; unit price feeds the eligible scope
        { _id: 'oi1', productName: 'PawTag Pro', quantity: 1, unitPrice: 40, customizationTotal: 0, refundedQuantity: 0 },
      ]),
    );

    const refundedTag = { _id: tagA, status: 'active', save: vi.fn(async () => undefined) };
    tagFindByIdMock.mockResolvedValue(refundedTag);
    subscriptionFindMock.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: 'subA' }]) });

    const result = await returnRefundService.processRefund({
      returnId: 'r2',
      reason: 'goodwill',
      exceptionReason: 'customer not returning item',
      refundWithoutReturn: true,
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(true);
    // Only the return's own tag was ever resolved/considered…
    expect(tagFindByIdMock).toHaveBeenCalledTimes(1);
    expect(tagFindByIdMock).toHaveBeenCalledWith(tagA);
    expect(refundedTag.status).toBe('cancelled');
    // …and tag B was never even queried — order-wide release must not run.
    expect(tagFindMock).not.toHaveBeenCalled();
    expect(cancelSubscriptionMock).toHaveBeenCalledTimes(1);
  });

  it('FULL refund with goods received releases unreturned leftovers after detach', async () => {
    const ret = chainable({
      _id: 'r3',
      status: 'received',
      refundAmount: 9.99,
      items: [],
      reason: 'damaged',
      orderId: orderOid,
      orderNumber: 'WO-000700',
    });
    findByIdMock.mockReturnValue(ret);
    orderFindByIdMock.mockReturnValue(deliveredOrder());

    const keptTag = { _id: tagB, status: 'active', save: vi.fn(async () => undefined) };
    tagFindMock.mockReturnValue(tagQueryChain([{ _id: tagB }]));
    tagFindByIdMock.mockResolvedValue(keptTag);

    const result = await returnRefundService.processRefund({
      returnId: 'r3',
      reason: 'damaged item',
      actor: { id: 'admin1', type: 'admin' },
    });

    expect(result.success).toBe(true);
    expect(keptTag.status).toBe('cancelled'); // money fully back → leftover frozen
  });
});
