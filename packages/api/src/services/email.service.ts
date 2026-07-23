import nodemailer from 'nodemailer';
import { CmsEmailTemplate } from '@pawtag/db';
import { renderBase, renderCtaButton } from './email/templates/base';
import {
  renderVerificationEmail,
  renderWelcomeEmail,
  renderPasswordResetEmail,
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

async function sendMail(to: string, subject: string, html: string, from?: string): Promise<EmailResult> {
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
