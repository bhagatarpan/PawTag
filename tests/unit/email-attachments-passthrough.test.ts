import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * sendCmsEmailOrFallback attachments passthrough — refund emails carry the
 * credit-note PDF at the send layer, so the attachment survives regardless
 * of which body (CMS template or hardcoded fallback) is rendered.
 *
 * This file deliberately does NOT mock email.service or the Resend SDK:
 * it exercises the real sendMail → Resend path and asserts on the actual
 * HTTP request via a global fetch stub (Resend v6 is fetch-based), proving
 * the attachment reaches the provider payload.
 */

const originalEnv = { ...process.env };

const fetchMock = vi.fn();

vi.mock('@pawtag/db', () => ({
  Setting: { findOne: vi.fn().mockReturnValue({ lean: async () => null }) },
  CmsEmailTemplate: { findOne: vi.fn() },
  EmailAudit: {
    findOne: vi.fn().mockReturnValue({ lean: async () => null }),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(async (doc: any) => ({ _id: 'audit1', ...doc })),
  },
}));

import { CmsEmailTemplate } from '@pawtag/db';

const cmsFindOne = vi.mocked(CmsEmailTemplate.findOne);

/** Parse the Resend /emails request body captured by the fetch stub */
function sentEmailRequest(): {
  html: string;
  attachments?: Array<{ filename: string; content: { data: number[] }; content_type?: string }>;
} {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain('api.resend.com/emails');
  return JSON.parse(String(init.body));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.NODE_ENV = 'production'; // real from-address + skip dev test-mode redirect
  process.env.RESEND_API_KEY = 're_test_key';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ id: 'email_123' }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );
  cmsFindOne.mockReturnValue({
    subject: 'Refund Settled — {{orderNumber}}',
    title: 'Refund Complete {{orderNumber}}',
    subtitle: '',
    body: 'Hi {{name}}, credit note: {{creditNoteNumber}}',
    senderEmail: null,
    senderName: 'PawTag',
  } as any);
});

afterEach(() => {
  process.env = originalEnv;
  vi.unstubAllGlobals();
});

describe('sendCmsEmailOrFallback attachments', () => {
  it('delivers the attachment through the CMS-rendered body path', async () => {
    const { sendCmsEmailOrFallback } = await import('../../packages/api/src/services/email.service');
    const pdf = Buffer.from('%PDF-1.7 test');

    await sendCmsEmailOrFallback({
      slug: 'refund-settled',
      to: 'customer@test.com',
      vars: { name: 'Test', orderNumber: 'WO-1', creditNoteNumber: 'CN-000042' },
      fallbackSubject: 'Refund Settled',
      fallbackHtml: '<p>fallback</p>',
      attachments: [{ filename: 'CN-000042.pdf', contentType: 'application/pdf', content: pdf }],
    });

    const request = sentEmailRequest();
    expect(request.attachments).toHaveLength(1);
    expect(request.attachments![0].filename).toBe('CN-000042.pdf');
    expect(request.attachments![0].content_type).toBe('application/pdf');
    // PDF bytes travel intact (Resend serializes node Buffers as byte arrays)
    const wireBytes = Buffer.from(request.attachments![0].content.data);
    expect(wireBytes.toString('latin1')).toBe('%PDF-1.7 test');
    // CMS body rendered with the credit-note variable (admin-editable copy wins)
    expect(request.html).toContain('credit note: CN-000042');
  });

  it('delivers the attachment through the hardcoded fallback body path', async () => {
    cmsFindOne.mockReturnValue(null as any);
    const { sendCmsEmailOrFallback } = await import('../../packages/api/src/services/email.service');

    await sendCmsEmailOrFallback({
      slug: 'refund-settled',
      to: 'customer@test.com',
      vars: {},
      fallbackSubject: 'Refund Settled',
      fallbackHtml: '<p>fallback body</p>',
      attachments: [{ filename: 'CN-1.pdf', content: Buffer.from('%PDF-1.7') }],
    });

    const request = sentEmailRequest();
    expect(request.html).toContain('fallback body');
    expect(request.attachments).toHaveLength(1);
    expect(request.attachments![0].filename).toBe('CN-1.pdf');
  });

  it('sends no attachments when none provided', async () => {
    cmsFindOne.mockReturnValue(null as any);
    const { sendCmsEmailOrFallback } = await import('../../packages/api/src/services/email.service');

    await sendCmsEmailOrFallback({
      slug: 'order-status',
      to: 'customer@test.com',
      vars: {},
      fallbackSubject: 'Order update',
      fallbackHtml: '<p>fallback</p>',
    });

    const request = sentEmailRequest();
    expect(request.attachments ?? []).toHaveLength(0);
  });
});
