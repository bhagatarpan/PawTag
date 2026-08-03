import nodemailer from 'nodemailer';
import { CmsEmailTemplate } from '@pawtag/db';
import { renderBase, renderCtaButton } from './email/templates/base';
import {
  renderVerificationEmail,
  renderWelcomeEmail,
  renderPasswordResetEmail,
  renderPasswordChangedEmail,
  renderOrderConfirmationEmail,
  renderShippingNotificationEmail,
  renderPetFoundEmail,
  renderAccountStatusEmail,
} from './email/templates';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

const isDemoMode = !process.env.SMTP_HOST || process.env.SMTP_HOST === 'localhost';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

type EmailResult = { success: boolean; messageId?: string; error?: string };

// ─── CMS Template Rendering ──────────────────────────────────────────

/** Process conditional blocks: {{#var}}...{{/var}} — renders block if var is truthy */
function processConditionals(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, inner) => {
    return vars[key] ? inner : '';
  });
}

/** Replace {{var}} placeholders with values */
function replaceVariables(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

/** Render a CMS email template to HTML, falling back to null if not found */
async function renderCmsEmail(slug: string, variables: Record<string, string>): Promise<{ html: string; subject: string; from?: string } | null> {
  try {
    const template = await CmsEmailTemplate.findOne({ slug, status: 'active', deletedAt: null });
    if (!template) return null;

    // Process body: handle conditionals then replace variables
    let body = processConditionals(template.body, variables);
    body = replaceVariables(body, variables);

    // Convert plain text body to HTML (newlines → <br>, preserve paragraphs)
    const bodyHtml = body
      .split('\n\n')
      .map(p => `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">${p.replace(/\n/g, '<br>')}</p>`)
      .join('');

    // Build full HTML
    let contentHtml = bodyHtml;

    // Add CTA button if present
    const ctaUrl = template.ctaUrl ? replaceVariables(template.ctaUrl, variables) : '';
    if (template.ctaText && ctaUrl) {
      contentHtml += renderCtaButton(ctaUrl, template.ctaText);
    }

    const html = renderBase({
      title: replaceVariables(template.title, variables),
      subtitle: template.subtitle ? replaceVariables(template.subtitle, variables) : undefined,
      preheader: template.preheader ? replaceVariables(template.preheader, variables) : undefined,
      bodyHtml: contentHtml,
    });

    const subject = replaceVariables(template.subject, variables);
    const from = template.senderEmail ? `"${template.senderName}" <${template.senderEmail}>` : undefined;

    return { html, subject, from };
  } catch (err) {
    console.error(`CMS email template "${slug}" fetch failed, using fallback:`, err);
    return null;
  }
}

export async function sendMail(to: string, subject: string, html: string, from?: string): Promise<EmailResult> {
  const fromAddress = from || '"PawTag" <no-reply@pawtag.co.nz>';

  if (isDemoMode) {
    console.log('\n========================================');
    console.log('📧 [DEMO EMAIL]');
    console.log('========================================');
    console.log(`To:      ${to}`);
    console.log(`From:    ${fromAddress}`);
    console.log(`Subject: ${subject}`);
    console.log('----------------------------------------');
    const urlMatch = html.match(/href="(http[^"]*verify[^"]*|http[^"]*reset[^"]*|http[^"]*token[^"]*)"/i);
    if (urlMatch) {
      console.log('🔗 LINK:', urlMatch[1]);
    }
    console.log('========================================\n');
    return { success: true, messageId: `demo_${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email send failed:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
): Promise<EmailResult> {
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
  const cms = await renderCmsEmail('verification-email', { name, verificationUrl });
  if (cms) return sendMail(to, cms.subject, cms.html, cms.from);
  const html = renderVerificationEmail({ name, verificationUrl });
  return sendMail(to, 'Verify your email address — PawTag', html);
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<EmailResult> {
  const accountUrl = `${frontendUrl}/account`;
  const cms = await renderCmsEmail('welcome', { name, accountUrl });
  if (cms) return sendMail(to, cms.subject, cms.html, cms.from);
  const html = renderWelcomeEmail({ name, accountUrl });
  return sendMail(to, 'Welcome to PawTag! 🐾', html);
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
): Promise<EmailResult> {
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  const cms = await renderCmsEmail('password-reset', { name, resetUrl });
  if (cms) return sendMail(to, cms.subject, cms.html, cms.from);
  const html = renderPasswordResetEmail({ name, resetUrl });
  return sendMail(to, 'Reset your password — PawTag', html);
}

export async function sendPasswordChangedEmail(
  to: string,
  name: string,
  changedBy: 'self' | string,
  ipAddress?: string,
): Promise<EmailResult> {
  const vars = { name, changedBy, ipAddress: ipAddress || '' };
  const cms = await renderCmsEmail('password-changed', vars);
  if (cms) return sendMail(to, cms.subject, cms.html, cms.from);
  const html = renderPasswordChangedEmail({ name, changedBy, ipAddress });
  return sendMail(to, 'Your password has been changed — PawTag', html);
}

export async function sendPetFoundEmail(
  to: string,
  ownerName: string,
  petName: string,
  finderMessage?: string,
  finderContact?: string,
  scanLocation?: string,
): Promise<EmailResult> {
  const viewDetailsUrl = `${frontendUrl}/account`;
  const vars = { ownerName, petName, finderMessage: finderMessage || '', finderContact: finderContact || '', scanLocation: scanLocation || '', viewDetailsUrl };
  const cms = await renderCmsEmail('pet-found', vars);
  if (cms) return sendMail(to, cms.subject, cms.html, cms.from);
  const html = renderPetFoundEmail({ ownerName, petName, finderMessage, finderContact, scanLocation, viewDetailsUrl });
  return sendMail(to, `Good news! Someone found ${petName} 🎉`, html, '"PawTag" <alerts@pawtag.co.nz>');
}

export async function sendAccountStatusEmail(
  to: string,
  name: string,
  status: string,
  reason?: string,
): Promise<EmailResult> {
  const vars = { name, status, reason: reason || '' };
  const cms = await renderCmsEmail('account-status', vars);
  if (cms) return sendMail(to, cms.subject, cms.html, cms.from);
  const html = renderAccountStatusEmail({ name, status, reason });
  return sendMail(to, 'Your PawTag account status has changed', html);
}

export interface OrderEmailData {
  to: string;
  customerName: string;
  orderNumber: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    variantName?: string;
    petName?: string;
  }>;
  subtotal?: number;
  discount?: { percent: number; amount: number; reason: string };
  total: number;
  shippingAddress: {
    line1: string;
    city: string;
    state: string;
    zip: string;
  };
}

export async function sendOrderConfirmation(data: OrderEmailData): Promise<EmailResult> {
  const viewOrderUrl = `${frontendUrl}/account/orders`;
  const vars = {
    name: data.customerName,
    orderNumber: data.orderNumber,
    total: data.total.toFixed(2),
    'shippingAddress.line1': data.shippingAddress.line1,
    'shippingAddress.city': data.shippingAddress.city,
    'shippingAddress.state': data.shippingAddress.state,
    'shippingAddress.zip': data.shippingAddress.zip,
    viewOrderUrl,
  };
  const cms = await renderCmsEmail('order-confirmation', vars);
  if (cms) return sendMail(data.to, cms.subject, cms.html, cms.from);
  const html = renderOrderConfirmationEmail({
    name: data.customerName,
    orderNumber: data.orderNumber,
    items: data.items,
    total: data.total,
    shippingAddress: data.shippingAddress,
    viewOrderUrl,
  });
  return sendMail(
    data.to,
    `Order Confirmed — ${data.orderNumber} | PawTag`,
    html,
    '"PawTag" <orders@pawtag.co.nz>',
  );
}

export async function sendShippingNotification(
  to: string,
  name: string,
  orderNumber: string,
  trackingNumber: string,
): Promise<{ success: boolean }> {
  const viewOrderUrl = `${frontendUrl}/account/orders`;
  const vars = { name, orderNumber, trackingNumber, viewOrderUrl };
  const cms = await renderCmsEmail('shipping-notification', vars);
  if (cms) {
    const result = await sendMail(to, cms.subject, cms.html, cms.from);
    return { success: result.success };
  }
  const html = renderShippingNotificationEmail({ name, orderNumber, trackingNumber, viewOrderUrl });
  const result = await sendMail(
    to,
    `Your Order Has Shipped! — ${orderNumber} | PawTag`,
    html,
    '"PawTag" <shipping@pawtag.co.nz>',
  );
  return { success: result.success };
}

export async function sendSubscriptionWelcomeEmail(
  to: string,
  name: string,
  tagId: string,
  planName: string,
  freePeriodEndsAt: Date,
): Promise<EmailResult> {
  const subscriptionsUrl = `${frontendUrl}/account/subscriptions`;
  const freeEndDate = freePeriodEndsAt.toLocaleDateString('en-NZ', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">Welcome to PawTag!</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${name},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">Your PawTag subscription has been activated! Here are your details:</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="color: #6b7280; padding: 4px 0;">Tag ID</td><td style="color: #111827; font-weight: 600; font-family: monospace; text-align: right;">${tagId}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Plan</td><td style="color: #111827; font-weight: 600; text-align: right;">${planName}</td></tr>
            <tr><td style="color: #6b7280; padding: 4px 0;">Free Period Until</td><td style="color: #111827; font-weight: 600; text-align: right;">${freeEndDate}</td></tr>
          </table>
        </div>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">Your tag comes with <strong>12 months free</strong> subscription. After that, you'll be charged based on your plan.</p>
        <a href="${subscriptionsUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">View Subscription</a>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>`;

  return sendMail(to, `Your PawTag subscription is active — ${tagId}`, html);
}

export async function sendInvoiceOtpEmail(
  to: string,
  name: string,
  invoiceNumber: string,
  otp: string,
): Promise<EmailResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 22px; margin: 0;">Invoice Access Code</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb;">
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">Hi ${name},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">Your verification code for invoice <strong>${invoiceNumber}</strong> is:</p>
        <div style="background: white; border: 2px dashed #0d9488; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0d9488; font-family: monospace;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">This code expires in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.</p>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>`;

  return sendMail(to, `Your PawTag invoice access code — ${invoiceNumber}`, html);
}

export async function sendInvoiceEmail(
  to: string,
  name: string,
  invoiceNumber: string,
  invoiceHtml: string,
): Promise<EmailResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 22px; margin: 0;">Your Invoice</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb;">
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">Hi ${name},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">Please find your invoice <strong>${invoiceNumber}</strong> attached below.</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; overflow: auto;">
          ${invoiceHtml}
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>`;

  return sendMail(to, `Invoice ${invoiceNumber} from PawTag`, html);
}
