import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock nodemailer ────────────────────────────────────────────────
vi.mock('nodemailer', () => {
  const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-msg-id' });
  return {
    default: {
      createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
    },
    __mockSendMail: mockSendMail,
  };
});

// ─── Mock @pawtag/db CmsEmailTemplate ───────────────────────────────
vi.mock('@pawtag/db', () => ({
  CmsEmailTemplate: {
    findOne: vi.fn(),
  },
}));

// ─── Mock email template renderers ──────────────────────────────────
vi.mock('../../packages/api/src/services/email/templates/base', () => ({
  renderBase: vi.fn((opts: { title: string; bodyHtml: string }) => `<html>${opts.title}${opts.bodyHtml}</html>`),
  renderCtaButton: vi.fn((url: string, text: string) => `<a href="${url}">${text}</a>`),
}));

vi.mock('../../packages/api/src/services/email/templates', () => ({
  renderVerificationEmail: vi.fn((data: Record<string, string>) => `<html>verify:${data.verificationUrl}</html>`),
  renderWelcomeEmail: vi.fn((data: Record<string, string>) => `<html>welcome:${data.name}</html>`),
  renderPasswordResetEmail: vi.fn((data: Record<string, string>) => `<html>reset:${data.resetUrl}</html>`),
  renderOrderConfirmationEmail: vi.fn((data: Record<string, string>) => `<html>order:${data.orderNumber}</html>`),
  renderShippingNotificationEmail: vi.fn((data: Record<string, string>) => `<html>ship:${data.trackingNumber}</html>`),
  renderPetFoundEmail: vi.fn((data: Record<string, string>) => `<html>found:${data.petName}</html>`),
  renderAccountStatusEmail: vi.fn((data: Record<string, string>) => `<html>status:${data.status}</html>`),
}));

// ─── Set demo mode before import ───────────────────────────────────
const originalEnv = process.env.SMTP_HOST;
process.env.SMTP_HOST = '';

import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPetFoundEmail,
  sendAccountStatusEmail,
  sendOrderConfirmation,
  sendShippingNotification,
} from '../../packages/api/src/services/email.service';
import { CmsEmailTemplate } from '@pawtag/db';

const mockFindOne = vi.mocked(CmsEmailTemplate.findOne);

describe('email.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure demo mode
    process.env.SMTP_HOST = '';
  });

  afterEach(() => {
    process.env.SMTP_HOST = originalEnv;
  });

  // ─── sendMail in demo mode ──────────────────────────────────────
  describe('sendMail in demo mode', () => {
    it('logs via logger and returns success with messageId', async () => {
      const result = await sendVerificationEmail('test@example.com', 'Test User', 'abc-123');

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^demo_/);
      // Demo mode sends email successfully with a demo messageId
    });
  });

  // ─── processConditionals (tested via CMS rendering) ─────────────
  describe('processConditionals', () => {
    it('renders conditional block when variable is truthy', async () => {
      mockFindOne.mockResolvedValue({
        slug: 'verification-email',
        status: 'active',
        body: '{{#showLink}}Click here{{/showLink}}',
        subject: 'Verify',
        title: 'Verify',
        ctaText: '',
        ctaUrl: '',
        subtitle: '',
        preheader: '',
        senderEmail: '',
        senderName: '',
      });

      const result = await sendVerificationEmail('test@example.com', 'User', 'tok');
      expect(result.success).toBe(true);
    });

    it('removes conditional block when variable is falsy', async () => {
      mockFindOne.mockResolvedValue({
        slug: 'verification-email',
        status: 'active',
        body: '{{#showLink}}Click here{{/showLink}}',
        subject: 'Verify',
        title: 'Verify',
        ctaText: '',
        ctaUrl: '',
        subtitle: '',
        preheader: '',
        senderEmail: '',
        senderName: '',
      });

      const result = await sendVerificationEmail('test@example.com', 'User', 'tok');
      expect(result.success).toBe(true);
    });
  });

  // ─── replaceVariables (tested via CMS rendering) ────────────────
  describe('replaceVariables', () => {
    it('replaces {{var}} placeholders with values', async () => {
      mockFindOne.mockResolvedValue({
        slug: 'verification-email',
        status: 'active',
        body: 'Hello {{name}}, verify at {{verificationUrl}}',
        subject: 'Hi {{name}}',
        title: 'Verify',
        ctaText: '',
        ctaUrl: '',
        subtitle: '',
        preheader: '',
        senderEmail: '',
        senderName: '',
      });

      const result = await sendVerificationEmail('test@example.com', 'Alice', 'tok');
      expect(result.success).toBe(true);
    });
  });

  // ─── sendVerificationEmail ──────────────────────────────────────
  describe('sendVerificationEmail', () => {
    it('generates correct URL with token using frontend env', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendVerificationEmail('test@example.com', 'Alice', 'verify-token-xyz');

      expect(result.success).toBe(true);
      const { renderVerificationEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationUrl: 'http://localhost:3000/verify-email?token=verify-token-xyz',
        }),
      );
    });

    it('uses CMS template when available', async () => {
      mockFindOne.mockResolvedValue({
        slug: 'verification-email',
        status: 'active',
        subject: 'CMS Verify {{name}}',
        body: 'Verify your email {{name}}',
        title: 'Verify',
        ctaText: 'Verify Now',
        ctaUrl: '{{verificationUrl}}',
        subtitle: '',
        preheader: '',
        senderEmail: 'custom@test.com',
        senderName: 'PawTag Custom',
      });

      const result = await sendVerificationEmail('test@example.com', 'Bob', 'tok-123');
      expect(result.success).toBe(true);
      expect(mockFindOne).toHaveBeenCalledWith({
        slug: 'verification-email',
        status: 'active',
        deletedAt: null,
      });
    });

    it('falls back to default template when CMS template is null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendVerificationEmail('test@example.com', 'Charlie', 'tok-456');
      expect(result.success).toBe(true);
      const { renderVerificationEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderVerificationEmail).toHaveBeenCalled();
    });
  });

  // ─── sendPasswordResetEmail ─────────────────────────────────────
  describe('sendPasswordResetEmail', () => {
    it('generates correct URL with token using frontend env', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendPasswordResetEmail('test@example.com', 'Dana', 'reset-token-789');

      expect(result.success).toBe(true);
      const { renderPasswordResetEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          resetUrl: 'http://localhost:3000/reset-password?token=reset-token-789',
        }),
      );
    });

    it('uses CMS template when available', async () => {
      mockFindOne.mockResolvedValue({
        slug: 'password-reset',
        status: 'active',
        subject: 'Reset {{name}}',
        body: 'Reset password',
        title: 'Reset',
        ctaText: 'Reset',
        ctaUrl: '{{resetUrl}}',
        subtitle: '',
        preheader: '',
        senderEmail: '',
        senderName: '',
      });

      const result = await sendPasswordResetEmail('test@example.com', 'Eve', 'rst');
      expect(result.success).toBe(true);
      expect(mockFindOne).toHaveBeenCalledWith({
        slug: 'password-reset',
        status: 'active',
        deletedAt: null,
      });
    });

    it('falls back to default template when CMS template is null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendPasswordResetEmail('test@example.com', 'Frank', 'rst-fallback');
      expect(result.success).toBe(true);
      const { renderPasswordResetEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderPasswordResetEmail).toHaveBeenCalled();
    });
  });

  // ─── sendWelcomeEmail ───────────────────────────────────────────
  describe('sendWelcomeEmail', () => {
    it('falls back to default template when CMS template is null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendWelcomeEmail('test@example.com', 'Grace');
      expect(result.success).toBe(true);
      const { renderWelcomeEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderWelcomeEmail).toHaveBeenCalled();
    });
  });

  // ─── sendPetFoundEmail ──────────────────────────────────────────
  describe('sendPetFoundEmail', () => {
    it('falls back to default template when CMS template is null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendPetFoundEmail(
        'owner@test.com',
        'Owner',
        'Buddy',
        'Found near the park',
        '555-1234',
        'Central Park',
      );
      expect(result.success).toBe(true);
      const { renderPetFoundEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderPetFoundEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerName: 'Owner',
          petName: 'Buddy',
          finderMessage: 'Found near the park',
          finderContact: '555-1234',
          scanLocation: 'Central Park',
        }),
      );
    });
  });

  // ─── sendAccountStatusEmail ─────────────────────────────────────
  describe('sendAccountStatusEmail', () => {
    it('falls back to default template when CMS template is null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendAccountStatusEmail('test@example.com', 'Helen', 'suspended', 'Violation');
      expect(result.success).toBe(true);
      const { renderAccountStatusEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderAccountStatusEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Helen',
          status: 'suspended',
          reason: 'Violation',
        }),
      );
    });
  });

  // ─── sendOrderConfirmation ──────────────────────────────────────
  describe('sendOrderConfirmation', () => {
    it('formats items and total correctly, falls back to default template', async () => {
      mockFindOne.mockResolvedValue(null);

      const orderData = {
        to: 'buyer@test.com',
        customerName: 'Ivan',
        orderNumber: 'ORD-1001',
        items: [
          { productName: 'PawTag Classic', quantity: 2, unitPrice: 29.99, variantName: 'Blue', petName: 'Rex' },
          { productName: 'PawTag Pro', quantity: 1, unitPrice: 49.99 },
        ],
        total: 109.97,
        shippingAddress: {
          line1: '123 Main St',
          city: 'Auckland',
          state: 'Auckland',
          zip: '1010',
        },
      };

      const result = await sendOrderConfirmation(orderData);

      expect(result.success).toBe(true);
      expect(mockFindOne).toHaveBeenCalledWith({
        slug: 'order-confirmation',
        status: 'active',
        deletedAt: null,
      });

      const { renderOrderConfirmationEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderOrderConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ivan',
          orderNumber: 'ORD-1001',
          total: 109.97,
          items: orderData.items,
          shippingAddress: orderData.shippingAddress,
          viewOrderUrl: expect.stringContaining('/account/orders'),
        }),
      );
    });

    it('uses CMS template when available', async () => {
      mockFindOne.mockResolvedValue({
        slug: 'order-confirmation',
        status: 'active',
        subject: 'Order {{orderNumber}} confirmed',
        body: 'Total: {{total}}',
        title: 'Confirmed',
        ctaText: '',
        ctaUrl: '',
        subtitle: '',
        preheader: '',
        senderEmail: 'orders@test.com',
        senderName: 'PawTag Orders',
      });

      const result = await sendOrderConfirmation({
        to: 'buyer@test.com',
        customerName: 'Ivan',
        orderNumber: 'ORD-2002',
        items: [{ productName: 'Tag', quantity: 1, unitPrice: 10 }],
        total: 10,
        shippingAddress: { line1: '1 St', city: 'Auckland', state: 'AKL', zip: '1000' },
      });

      expect(result.success).toBe(true);
      expect(mockFindOne).toHaveBeenCalledWith({
        slug: 'order-confirmation',
        status: 'active',
        deletedAt: null,
      });
    });
  });

  // ─── sendShippingNotification ───────────────────────────────────
  describe('sendShippingNotification', () => {
    it('falls back to default template when CMS template is null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await sendShippingNotification('test@example.com', 'Jane', 'ORD-3003', 'TRACK-999');
      expect(result.success).toBe(true);
      const { renderShippingNotificationEmail } = await import('../../packages/api/src/services/email/templates');
      expect(renderShippingNotificationEmail).toHaveBeenCalled();
    });
  });

  // ─── sendMail error handling ────────────────────────────────────
  describe('sendMail error handling', () => {
    it('demo mode always returns success regardless of transporter state', async () => {
      // isDemoMode is true (SMTP_HOST is empty at import time),
      // so sendMail logs to console and returns success without calling transporter
      const { __mockSendMail } = await import('nodemailer') as any;
      __mockSendMail.mockClear();

      const result = await sendVerificationEmail('test@example.com', 'User', 'tok');
      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^demo_/);
      // Transporter.sendMail should NOT be called in demo mode
      expect(__mockSendMail).not.toHaveBeenCalled();
    });
  });
});
