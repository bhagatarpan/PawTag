import nodemailer from 'nodemailer';
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
  const html = renderVerificationEmail({ name, verificationUrl });
  return sendMail(to, 'Verify your email address — PawTag', html);
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<EmailResult> {
  const accountUrl = `${frontendUrl}/account`;
  const html = renderWelcomeEmail({ name, accountUrl });
  return sendMail(to, 'Welcome to PawTag! 🐾', html);
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
): Promise<EmailResult> {
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
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
  const html = renderPetFoundEmail({
    ownerName,
    petName,
    finderMessage,
    finderContact,
    scanLocation,
    viewDetailsUrl,
  });
  return sendMail(to, `Good news! Someone found ${petName} 🎉`, html, '"PawTag" <alerts@pawtag.co.nz>');
}

export async function sendAccountStatusEmail(
  to: string,
  name: string,
  status: string,
  reason?: string,
): Promise<EmailResult> {
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
  const html = renderShippingNotificationEmail({
    name,
    orderNumber,
    trackingNumber,
    viewOrderUrl,
  });
  const result = await sendMail(
    to,
    `Your Order Has Shipped! — ${orderNumber} | PawTag`,
    html,
    '"PawTag" <shipping@pawtag.co.nz>',
  );
  return { success: result.success };
}
