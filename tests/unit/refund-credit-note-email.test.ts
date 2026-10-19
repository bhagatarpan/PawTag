import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Refund credit-note document chain (regression guard for the
 * "cancelled/refunded order → credit note PDF + notification + email with
 * PDF" flow):
 *
 * - sendCmsEmailOrFallback passes attachments through to the send layer
 *   (CMS-rendered and fallback bodies alike — a template edit can never
 *   drop the financial document).
 * - buildCreditNotePdfAttachment renders through the shared invoice PDF
 *   entry point (FINANCE_PDF_RENDERER-dispatched) and is non-fatal.
 * - findCreditNoteForRefund matches the specific refund first (partial
 *   refunds create one note per refund transaction).
 * - notifyCustomerOfStatusChange (cancelled/refunded) enriches the email
 *   with credit-note vars + PDF attachment; never for unpaid cancellations
 *   or non-money statuses.
 * - notifyRefundUpdate (succeeded) links to the invoices portal page that
 *   actually displays the credit note, and attaches the PDF.
 */

const originalEnv = { ...process.env };

// ─── db mocks ───────────────────────────────────────────────────────
const invoiceFindOneMock = vi.fn();
const notificationCreateMock = vi.fn();
const userFindByIdMock = vi.fn();
const orderFindByIdAndUpdateMock = vi.fn();
const emailAuditFindOneMock = vi.fn();
const settingFindOneMock = vi.fn();

vi.mock('@pawtag/db', () => ({
  Notification: { create: (...args: any[]) => notificationCreateMock(...args) },
  Order: { findByIdAndUpdate: (...args: any[]) => orderFindByIdAndUpdateMock(...args) },
  User: { findById: (...args: any[]) => userFindByIdMock(...args) },
  Invoice: { findOne: (...args: any[]) => invoiceFindOneMock(...args) },
  EmailAudit: { findOne: (...args: any[]) => emailAuditFindOneMock(...args) },
  Setting: { findOne: (...args: any[]) => settingFindOneMock(...args) },
  CmsEmailTemplate: { findOne: vi.fn().mockReturnValue({ lean: async () => null }) },
}));

// ─── service mocks ──────────────────────────────────────────────────
const sendCmsEmailOrFallbackMock = vi.fn();
vi.mock('../../packages/api/src/services/email.service', () => ({
  sendCmsEmailOrFallback: (...args: any[]) => sendCmsEmailOrFallbackMock(...args),
  sendMail: vi.fn(),
}));

const sendPushToUserMock = vi.fn();
vi.mock('../../packages/api/src/services/push-notification.service', () => ({
  sendPushToUser: (...args: any[]) => sendPushToUserMock(...args),
}));

const generateInvoicePdfMock = vi.fn();
vi.mock('../../packages/api/src/services/invoice-pdf.service', () => ({
  generateInvoicePdf: (...args: any[]) => generateInvoicePdfMock(...args),
}));

import {
  buildCreditNotePdfAttachment,
  findCreditNoteForRefund,
} from '../../packages/api/src/commerce/services/credit-note.service';
import {
  notifyCustomerOfStatusChange,
  notifyRefundUpdate,
} from '../../packages/api/src/services/orderNotification.service';

/** findOne chainable: supports both .lean() and .sort().lean() call shapes */
function invoiceChainable(doc: any) {
  return {
    lean: vi.fn().mockResolvedValue(doc),
    sort: vi.fn().mockReturnThis(),
  };
}

function orderDoc(overrides: Record<string, any> = {}) {
  return {
    _id: { toString: () => 'order1' },
    userId: 'user1',
    orderNumber: 'WO-000500',
    payment: { amount: 44.1, currency: 'NZD', cardBrand: 'visa', cardLast4: '4242' },
    ...overrides,
  } as any;
}

const creditNoteDoc = {
  _id: { toString: () => 'cn1' },
  invoiceNumber: 'CN-000042',
  type: 'credit_note',
  orderId: 'order1',
  stripePaymentIntentId: 're_123',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  notificationCreateMock.mockResolvedValue({});
  orderFindByIdAndUpdateMock.mockResolvedValue({});
  sendPushToUserMock.mockResolvedValue({});
  sendCmsEmailOrFallbackMock.mockResolvedValue({ success: true });
  generateInvoicePdfMock.mockResolvedValue({ buffer: Buffer.from('%PDF-1.7 test'), filename: 'CN-000042.pdf' });
  emailAuditFindOneMock.mockReturnValue({ lean: async () => null });
  userFindByIdMock.mockReturnValue({
    email: 'customer@test.com',
    fullName: 'Test Customer',
    select: () => ({ lean: async () => ({ email: 'customer@test.com', fullName: 'Test Customer' }) }),
  });
});

afterEach(() => {
  process.env = originalEnv;
});

// ─── attachments passthrough is covered in email-attachments-passthrough.test.ts ───

// ─── credit-note helpers ────────────────────────────────────────────
describe('findCreditNoteForRefund', () => {
  it('matches the specific refund first (partial refunds create one note per refund)', async () => {
    invoiceFindOneMock.mockReturnValue(invoiceChainable(creditNoteDoc));

    const found = await findCreditNoteForRefund('order1', 're_123');

    expect(found).toBe(creditNoteDoc);
    expect(invoiceFindOneMock).toHaveBeenCalledWith({
      type: 'credit_note',
      orderId: 'order1',
      stripePaymentIntentId: 're_123',
    });
  });

  it('falls back to the latest credit note when the refund id is unknown', async () => {
    const chain = invoiceChainable(creditNoteDoc);
    invoiceFindOneMock.mockReturnValue(chain);

    const found = await findCreditNoteForRefund('order1');

    expect(found).toBe(creditNoteDoc);
    expect(invoiceFindOneMock).toHaveBeenCalledWith({ type: 'credit_note', orderId: 'order1' });
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('returns null on lookup failure (never throws into the email path)', async () => {
    invoiceFindOneMock.mockReturnValue({ lean: () => Promise.reject(new Error('db down')), sort: () => ({ lean: () => Promise.reject(new Error('db down')) }) });

    await expect(findCreditNoteForRefund('order1', 're_1')).resolves.toBeNull();
  });
});

describe('buildCreditNotePdfAttachment', () => {
  it('renders through the shared invoice PDF entry point (engine-dispatched)', async () => {
    const attachment = await buildCreditNotePdfAttachment('cn1', 'CN-000042');

    expect(generateInvoicePdfMock).toHaveBeenCalledWith('cn1', 'customer');
    expect(attachment).toEqual({
      filename: 'CN-000042.pdf',
      contentType: 'application/pdf',
      content: Buffer.from('%PDF-1.7 test'),
    });
  });

  it('returns null when rendering fails — the email still sends without the PDF', async () => {
    generateInvoicePdfMock.mockRejectedValue(new Error('weasyprint missing'));

    await expect(buildCreditNotePdfAttachment('cn1', 'CN-000042')).resolves.toBeNull();
  });
});

// ─── notifyCustomerOfStatusChange ───────────────────────────────────
describe('notifyCustomerOfStatusChange credit-note enrichment', () => {
  it('cancelled order with a credit note: attaches PDF + adds credit note vars/link', async () => {
    invoiceFindOneMock.mockReturnValue(invoiceChainable(creditNoteDoc));

    const ok = await notifyCustomerOfStatusChange(orderDoc(), 'cancelled', { reason: 'changed mind' });

    expect(ok).toBe(true);
    expect(sendCmsEmailOrFallbackMock).toHaveBeenCalledTimes(1);
    const params = sendCmsEmailOrFallbackMock.mock.calls[0][0];
    expect(params.slug).toBe('order-status');
    expect(params.vars.creditNoteNumber).toBe('CN-000042');
    expect(params.vars.creditNoteUrl).toContain('/account/invoices/');
    expect(params.attachments).toHaveLength(1);
    expect(params.attachments[0].filename).toBe('CN-000042.pdf');
    // Fallback renderer carries the same credit-note block
    expect(params.fallbackHtml).toContain('Credit Note: CN-000042');
  });

  it('refunded order attaches the credit note PDF', async () => {
    invoiceFindOneMock.mockReturnValue(invoiceChainable(creditNoteDoc));

    await notifyCustomerOfStatusChange(orderDoc(), 'refunded', { reason: 'damaged' });

    const params = sendCmsEmailOrFallbackMock.mock.calls[0][0];
    expect(params.vars.creditNoteNumber).toBe('CN-000042');
    expect(params.attachments).toHaveLength(1);
  });

  it('cancelled order without a credit note (unpaid): no attachment, no vars', async () => {
    invoiceFindOneMock.mockReturnValue(invoiceChainable(null));

    await notifyCustomerOfStatusChange(orderDoc(), 'cancelled');

    const params = sendCmsEmailOrFallbackMock.mock.calls[0][0];
    expect(params.vars.creditNoteNumber).toBeUndefined();
    expect(params.attachments).toBeUndefined();
    expect(params.fallbackHtml).not.toContain('Credit Note:');
  });

  it('non-money statuses never look up a credit note', async () => {
    await notifyCustomerOfStatusChange(orderDoc(), 'shipped', { trackingNumber: '123', carrier: 'NZ Post' });

    expect(invoiceFindOneMock).not.toHaveBeenCalled();
    const params = sendCmsEmailOrFallbackMock.mock.calls[0][0];
    expect(params.attachments).toBeUndefined();
  });

  it('credit-note enrichment failure never blocks the status email', async () => {
    invoiceFindOneMock.mockReturnValue({
      lean: () => Promise.reject(new Error('db down')),
      sort: () => ({ lean: () => Promise.reject(new Error('db down')) }),
    });

    await notifyCustomerOfStatusChange(orderDoc(), 'cancelled');

    expect(sendCmsEmailOrFallbackMock).toHaveBeenCalledTimes(1);
    expect(sendCmsEmailOrFallbackMock.mock.calls[0][0].attachments).toBeUndefined();
  });

  it('creates the customer in-app notification for cancelled orders', async () => {
    invoiceFindOneMock.mockReturnValue(invoiceChainable(null));

    await notifyCustomerOfStatusChange(orderDoc(), 'cancelled', { reason: 'changed mind' });

    expect(notificationCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'customer',
        type: 'order_update',
        priority: 'high',
      }),
    );
  });
});

// ─── notifyRefundUpdate (webhook settled) ───────────────────────────
describe('notifyRefundUpdate settled email', () => {
  it('links the credit note to the invoices portal page and attaches the PDF', async () => {
    process.env.PUBLIC_WEB_URL = 'https://pawtag.co.nz';
    invoiceFindOneMock.mockReturnValue(invoiceChainable(creditNoteDoc));

    await notifyRefundUpdate(orderDoc(), {
      id: 're_123',
      amount: 4410,
      currency: 'nzd',
      status: 'succeeded',
    }, 'succeeded');

    expect(sendCmsEmailOrFallbackMock).toHaveBeenCalledTimes(1);
    const params = sendCmsEmailOrFallbackMock.mock.calls[0][0];
    expect(params.slug).toBe('refund-settled');
    expect(params.vars.creditNoteNumber).toBe('CN-000042');
    // The invoices portal page shows the credit note and downloads its PDF —
    // the old /account/orders/ link showed nothing.
    expect(params.vars.creditNoteUrl).toBe('https://pawtag.co.nz/account/invoices/cn1');
    expect(params.attachments).toHaveLength(1);
    expect(params.attachments[0].filename).toBe('CN-000042.pdf');
    expect(params.fallbackHtml).toContain('Credit Note: CN-000042');
  });

  it('finds the credit note by this refund id (partial refunds)', async () => {
    invoiceFindOneMock.mockReturnValue(invoiceChainable(creditNoteDoc));
    const order = orderDoc();

    await notifyRefundUpdate(order, { id: 're_123', amount: 1000, currency: 'nzd' }, 'succeeded');

    expect(invoiceFindOneMock).toHaveBeenCalledWith({
      type: 'credit_note',
      orderId: order._id,
      stripePaymentIntentId: 're_123',
    });
  });

  it('still sends the settled email when no credit note exists', async () => {
    invoiceFindOneMock.mockReturnValue(invoiceChainable(null));

    await notifyRefundUpdate(orderDoc(), { id: 're_123', amount: 4410, currency: 'nzd' }, 'succeeded');

    const params = sendCmsEmailOrFallbackMock.mock.calls[0][0];
    expect(params.slug).toBe('refund-settled');
    expect(params.attachments).toBeUndefined();
  });

  it('keeps the one-email-per-refund dedupe (recent refund email suppresses the webhook email)', async () => {
    emailAuditFindOneMock.mockReturnValue({ lean: async () => ({ templateSlug: 'refund-processed-csr' }) });
    invoiceFindOneMock.mockReturnValue(invoiceChainable(creditNoteDoc));

    await notifyRefundUpdate(orderDoc(), { id: 're_123', amount: 4410, currency: 'nzd' }, 'succeeded');

    expect(sendCmsEmailOrFallbackMock).not.toHaveBeenCalled();
  });

  it('refund failure email is never suppressed by the dedupe', async () => {
    emailAuditFindOneMock.mockReturnValue({ lean: async () => ({ templateSlug: 'refund-processed-csr' }) });

    await notifyRefundUpdate(orderDoc(), { id: 're_123', amount: 4410, currency: 'nzd', failure_reason: 'card_declined' }, 'failed');

    expect(sendCmsEmailOrFallbackMock).toHaveBeenCalledTimes(1);
    expect(sendCmsEmailOrFallbackMock.mock.calls[0][0].slug).toBe('refund-failed');
  });
});
