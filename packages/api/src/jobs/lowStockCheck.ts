import { Product, Setting, Notification } from '@pawtag/db';
import { sendMail } from '../services/email.service';

export async function checkLowStock(): Promise<{ alerted: boolean; count: number }> {
  const thresholdSetting = await Setting.findOne({ key: 'lowStockThreshold' }).lean();
  const threshold = parseInt(thresholdSetting?.value || '10', 10);

  const lowStockProducts = await Product.find({
    deletedAt: null,
    $expr: { $lte: ['$stock', threshold] },
  })
    .select('name stock sku price')
    .lean();

  if (lowStockProducts.length === 0) {
    return { alerted: false, count: 0 };
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) {
    console.log('[LowStockCheck] No ADMIN_ALERT_EMAIL configured, skipping email alert');
  } else {
    const rows = lowStockProducts
      .map((p) => `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${p.name}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${p.sku}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;color:${p.stock === 0 ? '#dc2626' : '#d97706'};">${p.stock}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">$${p.price.toFixed(2)}</td></tr>`)
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1e40af;">⚠️ Low Stock Alert</h2>
        <p>The following products are at or below the low stock threshold of <strong>${threshold}</strong> units:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Product</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">SKU</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">Stock</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#6b7280;font-size:13px;">Please restock these items to avoid stockouts.</p>
      </div>`;

    await sendMail(adminEmail, `[PawTag] Low Stock Alert — ${lowStockProducts.length} product(s)`, html);
  }

  const adminUser = await import('@pawtag/db').then((m) =>
    m.User.findOne({ role: 'admin' }).select('_id').lean()
  );

  if (adminUser) {
    await Notification.create({
      userId: adminUser._id,
      audience: 'admin',
      type: 'system',
      title: 'Low Stock Alert',
      message: `${lowStockProducts.length} product(s) at or below threshold (${threshold} units): ${lowStockProducts.map((p) => p.name).join(', ')}`,
      priority: 'high',
      channel: 'alert',
      data: {
        productCount: lowStockProducts.length,
        threshold,
        products: lowStockProducts.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock })),
      },
    });
  }

  return { alerted: true, count: lowStockProducts.length };
}

const LOW_STOCK_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOW_STOCK_INITIAL_DELAY_MS = 60 * 60 * 1000; // 1 hour after startup

let lowStockTimer: ReturnType<typeof setInterval> | null = null;

export function startLowStockService(): void {
  if (process.env.NODE_ENV === 'test') {
    console.log('[LowStockCheck] Skipping scheduler in test mode');
    return;
  }

  console.log('[LowStockCheck] Starting daily low stock check service');

  setTimeout(() => {
    checkLowStock().catch((err) => {
      console.error('[LowStockCheck] Error during low stock check:', err);
    });
  }, LOW_STOCK_INITIAL_DELAY_MS);

  lowStockTimer = setInterval(() => {
    checkLowStock().catch((err) => {
      console.error('[LowStockCheck] Error during low stock check:', err);
    });
  }, LOW_STOCK_CHECK_INTERVAL_MS);
}

export function stopLowStockService(): void {
  if (lowStockTimer) {
    clearInterval(lowStockTimer);
    lowStockTimer = null;
    console.log('[LowStockCheck] Stopped low stock check service');
  }
}
