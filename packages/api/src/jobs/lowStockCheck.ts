import { Product, Setting, Notification, User } from '@pawtag/db';
import { sendMail } from '../services/email.service';
import { renderLowStockAlertEmail } from '../services/email/templates';
import { auditService, type AuditContext } from '../services/audit';
import logger from '../lib/logger';

async function auditJobEvent(
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  // Fire and forget
  const logAudit = async () => {
    try {
      await auditService.log({
        actorType: 'SCHEDULED_JOB',
        actorId: 'lowStockCheck',
        actorUsername: 'low-stock-check-job',
        sourceIp: 'system',
        userAgent: 'scheduled-job',
        applicationName: 'pawtag-api',
        applicationVersion: '1.0.0',
        apiVersion: 'v1',
        environment: process.env.NODE_ENV || 'development',
        ...overrides,
      }, input);
    } catch (err) {
      logger.error({ err }, '[Audit] Failed to log job event');
    }
  };
  logAudit();
}

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
    await auditJobEvent({
      action: 'low_stock_check',
      eventType: 'scheduled_low_stock_check',
      eventCategory: 'SYSTEM',
      operationType: 'READ',
      resourceType: 'Product',
      resourceId: 'multiple',
      outcome: 'SUCCESS',
      severity: 'LOW',
      metadata: {
        threshold,
        productCount: 0,
        products: [],
      },
    });
    return { alerted: false, count: 0 };
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) {
    logger.info('[LowStockCheck] No ADMIN_ALERT_EMAIL configured, skipping email alert');
  } else {
    const html = renderLowStockAlertEmail({ threshold, products: lowStockProducts });

    await sendMail(adminEmail, `[PawTag] Low Stock Alert — ${lowStockProducts.length} product(s)`, html);
  }

  const adminUser = await User.findOne({ role: 'admin' }).select('_id').lean();

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

  await auditJobEvent({
    action: 'low_stock_check',
    eventType: 'scheduled_low_stock_check',
    eventCategory: 'SYSTEM',
    operationType: 'READ',
    resourceType: 'Product',
    resourceId: 'multiple',
    outcome: 'SUCCESS',
    severity: lowStockProducts.some(p => p.stock === 0) ? 'HIGH' : 'MEDIUM',
    metadata: {
      threshold,
      productCount: lowStockProducts.length,
      products: lowStockProducts.map(p => ({ name: p.name, sku: p.sku, stock: p.stock, price: p.price })),
      emailSent: !!adminEmail,
      notificationCreated: !!adminUser,
    },
  });

  return { alerted: true, count: lowStockProducts.length };
}

const LOW_STOCK_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOW_STOCK_INITIAL_DELAY_MS = 60 * 60 * 1000; // 1 hour after startup

let lowStockTimer: ReturnType<typeof setInterval> | null = null;

export function startLowStockService(): void {
  if (process.env.NODE_ENV === 'test') {
    logger.info('[LowStockCheck] Skipping scheduler in test mode');
    return;
  }

  logger.info('[LowStockCheck] Starting daily low stock check service');

  setTimeout(() => {
    checkLowStock().catch((err) => {
      logger.error({ err }, '[LowStockCheck] Error during low stock check');
    });
  }, LOW_STOCK_INITIAL_DELAY_MS);

  lowStockTimer = setInterval(() => {
    checkLowStock().catch((err) => {
      logger.error({ err }, '[LowStockCheck] Error during low stock check');
    });
  }, LOW_STOCK_CHECK_INTERVAL_MS);
}

export function stopLowStockService(): void {
  if (lowStockTimer) {
    clearInterval(lowStockTimer);
    lowStockTimer = null;
    logger.info('[LowStockCheck] Stopped low stock check service');
  }
}
