import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

// Demo mode: always returns success, logs to console
const isDemoMode = !process.env.SMTP_HOST || process.env.SMTP_HOST === 'localhost';

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

function buildOrderEmailHtml(data: OrderEmailData): string {
  const itemRows = data.items.map((item) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #eee;">
        ${item.productName}
        ${item.variantName ? `<br><small style="color:#666">${item.variantName}</small>` : ''}
        ${item.petName ? `<br><small style="color:#0d9488">For: ${item.petName}</small>` : ''}
      </td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">$${(item.unitPrice * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;">Order Confirmed! 🐾</h1>
        <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">${data.orderNumber}</p>
      </div>
      <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 20px;color:#374151;">Hi ${data.customerName},</p>
        <p style="margin:0 0 20px;color:#374151;">Thank you for your order! We're processing it now and will notify you when it ships.</p>
        
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:12px;text-align:left;font-weight:600;">Item</th>
              <th style="padding:12px;text-align:center;font-weight:600;">Qty</th>
              <th style="padding:12px;text-align:right;font-weight:600;">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:12px;font-weight:700;">Total</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#0d9488;">$${data.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="background:white;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px;font-weight:600;color:#374151;">Shipping to:</p>
          <p style="margin:0;color:#6b7280;">
            ${data.shippingAddress.line1}<br>
            ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.zip}
          </p>
        </div>

        <p style="margin:20px 0 0;color:#9ca3af;font-size:13px;">
          Questions? Reply to this email or contact support@pawtag.co.nz
        </p>
      </div>
      <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">
        © ${new Date().getFullYear()} PawTag — Because every pet deserves a safe way home.
      </div>
    </body>
    </html>
  `;
}

export async function sendOrderConfirmation(data: OrderEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const html = buildOrderEmailHtml(data);

  if (isDemoMode) {
    console.log('📧 [DEMO] Order confirmation email would be sent to:', data.to);
    console.log('📧 [DEMO] Order:', data.orderNumber, '| Total:', `$${data.total.toFixed(2)}`);
    return { success: true, messageId: `demo_${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail({
      from: '"PawTag" <orders@pawtag.co.nz>',
      to: data.to,
      subject: `Order Confirmed — ${data.orderNumber} | PawTag`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email send failed:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendShippingNotification(to: string, orderNumber: string, trackingNumber: string): Promise<{ success: boolean }> {
  if (isDemoMode) {
    console.log('📧 [DEMO] Shipping notification to:', to, '| Tracking:', trackingNumber);
    return { success: true };
  }

  try {
    await transporter.sendMail({
      from: '"PawTag" <shipping@pawtag.co.nz>',
      to,
      subject: `Your Order Has Shipped! — ${orderNumber} | PawTag`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#0d9488;">Your order is on its way! 🚚</h2>
          <p>Order <strong>${orderNumber}</strong> has been shipped.</p>
          <p>Tracking number: <strong>${trackingNumber}</strong></p>
        </div>
      `,
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}
