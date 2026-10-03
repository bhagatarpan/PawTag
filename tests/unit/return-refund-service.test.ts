import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  };
});

vi.mock('../../packages/api/src/services/email.service', () => ({
  sendMail: vi.fn(async () => true),
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

describe('returnRefundService.processRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveMock.mockResolvedValue(undefined);
    orderUpdateMock.mockResolvedValue({});
    paymentCreateMock.mockResolvedValue({});
    userFindMock.mockReturnValue({ lean: () => Promise.resolve(null) });
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
