import dotenv from 'dotenv';
dotenv.config();

// Initialize OpenTelemetry tracing before any other imports
import { initTracing } from './lib/tracing';
if (process.env.NODE_ENV !== 'test') {
  initTracing({
    serviceName: 'pawtag-api',
    serviceVersion: process.env.SERVICE_VERSION || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    consoleExporter: process.env.OTEL_CONSOLE_EXPORTER === 'true',
    sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE || '1.0'),
  });
}

// Initialize error monitoring before any other imports
import { initMonitoring } from './lib/monitoring';
if (process.env.NODE_ENV !== 'test') {
  initMonitoring({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.SERVICE_VERSION,
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  });
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import * as Sentry from '@sentry/node';

import { config } from './config';
import { connectDatabase } from '@pawtag/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { swaggerSpec } from './swagger';
import logger from './lib/logger';
import { auditMiddleware } from './middleware/audit';
import { metricsMiddleware } from './middleware/metrics';
import { tracingMiddleware } from './middleware/tracing';
import { createDbRateLimiter } from './lib/rate-limiter';

import QRCode from 'qrcode';
import { Tag } from '@pawtag/db';

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import rbacRoutes from './routes/rbac';
import customerRoutes from './routes/customer';
import finderRoutes from './routes/finder';
import uploadRoutes from './routes/upload';
import cmsAdminRoutes from './routes/cms-admin';
import cmsPublicRoutes from './routes/cms-public';
import cmsEmailAdminRoutes from './routes/cms-email-admin';
import cmsSmsAdminRoutes from './routes/cms-sms-admin';
import cmsPetRefAdminRoutes from './routes/cms-pet-ref-admin';
import cmsSettingsPublicRoutes from './routes/cms-settings-public';
import cmsHomepageAdminRoutes from './routes/cms-homepage-admin';
import cmsShopAdminRoutes from './routes/cms-shop-admin';
import cmsAuthAdminRoutes from './routes/cms-auth-admin';
import cmsOnboardingAdminRoutes from './routes/cms-onboarding-admin';
import cmsPublicV2Routes from './routes/cms-public-v2';
import customerSubscriptionRoutes from './routes/customer-subscriptions';
import adminSubscriptionRoutes from './routes/admin-subscriptions';
import adminAnalyticsRoutes from './routes/admin-analytics';

import invoiceAccessRoutes from './routes/invoice-access';
import referralRoutes from './routes/referrals';
import checkoutOtpRoutes from './routes/checkout-otp';
import pushTokenRoutes from './routes/push-tokens';
import customerReturnsRoutes from './routes/customer-returns';
import auditRoutes from './routes/audit';
import systemLogRoutes from './routes/system-logs';
import siteAvailabilityRoutes from './routes/site-availability';
import systemStatusRoutes from './routes/system-status';
import { publicRouter as supportPublicRoutes, adminRouter as supportAdminRoutes } from './routes/support';
import adminWebhookRoutes from './routes/admin-webhooks';
import addressAutocompleteRoutes from './routes/address-autocomplete';
import healthRoutes from './routes/health';

// --- PawTag Commerce Routes (Phase 0-11) ---
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import checkoutRoutes from './routes/checkout';
import shippingRoutes from './routes/shipping';
import adminCommerceRoutes from './routes/admin-commerce';
import adminCategoryRoutes from './routes/admin-categories';
import adminCollectionRoutes from './routes/admin-collections';
import adminBrandRoutes from './routes/admin-brands';
import adminShippingRoutes from './routes/admin-shipping';
import adminFulfilmentRoutes from './routes/admin-fulfilments';
import adminReturnRoutes from './routes/admin-returns';
import adminShipmentRoutes from './routes/admin-shipments';
import adminPaymentRoutes from './routes/admin-payments';
import adminPromoCodeRoutes from './routes/admin-promocodes';
import stripeWebhookRoutes from './routes/stripe-webhooks';
import promoPublicRoutes from './routes/promo-public';

import { siteAvailabilityMiddleware } from './middleware/site-availability';
import { shutdownTracing } from './lib/tracing';
import { flushMonitoring } from './lib/monitoring';
import { flushSystemLogs } from './lib/logger';
import { startReminderService } from './services/reminder.service';
import { startSubscriptionService } from './services/subscription.service';
import { startEscalationService } from './services/escalation.service';
import { startLowStockService } from './jobs/lowStockCheck';

const app = express();

// --- Serve uploads BEFORE Helmet (no CSP/CORP restrictions on images) ---
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Security & Middleware ---
const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
cspDirectives['script-src'] = ["'self'", 'https://js.stripe.com', 'https://m.stripe.network'];
cspDirectives['frame-src'] = ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'];
cspDirectives['img-src'] = ["'self'", 'data:', 'http://localhost:*', 'https:', 'https://*.stripe.com'];
cspDirectives['connect-src'] = ["'self'", 'https://api.stripe.com', 'https://maps.googleapis.com'];
cspDirectives['style-src'] = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];
cspDirectives['font-src'] = ["'self'", 'https://fonts.gstatic.com'];

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: { directives: cspDirectives },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Structured HTTP request logging via pino-http
const isTest = process.env.NODE_ENV === 'test';
const httpLogger = pinoHttp({
  logger,
  // Skip health checks and docs in production
  autoLogging: !isTest && {
    ignore: (req) => {
      const url = req.url || '';
      return url.startsWith('/health') || url.startsWith('/api/docs') || url === '/favicon.ico';
    },
  },
  // Redact sensitive headers
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.authorization'],
});
app.use(httpLogger);

// Metrics middleware - track HTTP request counts and durations
app.use(metricsMiddleware);

// Tracing middleware - enriches request context with OpenTelemetry trace IDs
app.use(tracingMiddleware);

// Audit middleware - must be early to capture all requests
app.use(auditMiddleware);

// Site availability middleware - enforces maintenance/offline modes
app.use(siteAvailabilityMiddleware);

// Rate limiting — all values read from DB settings (see seed-cms.ts)
const limiter = createDbRateLimiter({
  settingKey: 'rateLimit.global.max',
  defaultValue: 1000,
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests, please try again later',
});
app.use('/api', limiter);

const authLimiter = createDbRateLimiter({
  settingKey: 'rateLimit.auth.login.max',
  defaultValue: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Too many auth attempts, please try again later',
});
app.use('/api/auth', authLimiter);

// --- Swagger API Docs ---
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'PawTag API Docs',
}));
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// --- Health & Metrics ---
app.use('/health', healthRoutes);

// --- Public Tag QR Routes (no auth needed) ---
const FINDER_BASE_URL = process.env.FINDER_BASE_URL || 'http://localhost:3003';

app.get('/api/tags/:tagId/qr', async (req, res) => {
  try {
    const tag = await Tag.findOne({ tagId: req.params.tagId });
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }
    const size = Math.min(Math.max(Number(req.query.size) || 300, 100), 1000);
    const url = `${FINDER_BASE_URL}/${tag.tagId}`;
    const qrBuffer = await QRCode.toBuffer(url, { width: size, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${tag.tagId}.png"`);
    res.send(qrBuffer);
  } catch { res.status(500).json({ success: false, error: 'Failed to generate QR code' }); }
});

app.get('/api/tags/:tagId/sticker', async (req, res) => {
  try {
    const tag = await Tag.findOne({ tagId: req.params.tagId })
      .populate('petId', 'name petId petType breed color')
      .populate('ownerId', 'fullName');
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }
    const pet = tag.petId as any;
    const url = `${FINDER_BASE_URL}/${tag.tagId}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 250, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PawTag Sticker - ${tag.tagId}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5}.sticker{background:white;border:2px solid #e5e7eb;border-radius:12px;padding:24px;width:320px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)}.qr{margin:12px auto}.qr img{width:200px;height:200px}.tag-id{font-size:22px;font-weight:700;color:#111;font-family:monospace;letter-spacing:1px;margin:8px 0 4px}.pet-name{font-size:18px;font-weight:600;color:#374151;margin:4px 0}.pet-id{font-size:13px;color:#6b7280;font-family:monospace}.pet-details{font-size:12px;color:#9ca3af;margin-top:4px}.branding{font-size:10px;color:#d1d5db;margin-top:12px;border-top:1px solid #f3f4f6;padding-top:8px}.scan-hint{font-size:11px;color:#9ca3af;margin-top:8px}@media print{body{background:white}.sticker{border:1px solid #ccc;box-shadow:none}}</style></head><body><div class="sticker"><img src="${qrDataUrl}" alt="QR Code" class="qr"/><div class="tag-id">${tag.tagId}</div><div class="pet-name">${pet.name}</div><div class="pet-id">${pet.petId || ''}</div><div class="pet-details">${pet.petType || ''} &middot; ${pet.breed || ''} &middot; ${pet.color || ''}</div><div class="scan-hint">Scan to view pet info</div><div class="branding">PawTag &mdash; Reuniting lost pets with their families</div></div></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch { res.status(500).json({ success: false, error: 'Failed to generate sticker' }); }
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/rbac', rbacRoutes);
app.use('/api/admin/cms', cmsAdminRoutes);
app.use('/api/admin/cms/email', cmsEmailAdminRoutes);
app.use('/api/admin/cms/sms', cmsSmsAdminRoutes);
app.use('/api/admin/cms/pet-refs', cmsPetRefAdminRoutes);
app.use('/api/admin/cms/homepage', cmsHomepageAdminRoutes);
app.use('/api/admin/cms/shop-pages', cmsShopAdminRoutes);
app.use('/api/admin/cms/auth-pages', cmsAuthAdminRoutes);
app.use('/api/admin/cms/onboarding', cmsOnboardingAdminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/customer/checkout-otp', checkoutOtpRoutes);
import demoPaymentRoutes from './routes/demo-payment';
app.use('/api/customer/demo-payment', demoPaymentRoutes);
app.use('/api/customer/subscriptions', customerSubscriptionRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api', invoiceAccessRoutes);
app.use('/api/finder', finderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', referralRoutes);
app.use('/api', pushTokenRoutes);
app.use('/api/customer/returns', customerReturnsRoutes);
app.use('/api/support', supportPublicRoutes);
app.use('/api/admin/support-requests', supportAdminRoutes);
app.use('/api/public/cms', cmsPublicRoutes);
app.use('/api/public/cms', cmsSettingsPublicRoutes);
app.use('/api/public/cms', cmsPublicV2Routes);
app.use('/api/admin/audit', auditRoutes);
app.use('/api/admin/system-logs', systemLogRoutes);
app.use('/api/admin/site-availability', siteAvailabilityRoutes);
app.use('/api/admin/webhooks', adminWebhookRoutes);
app.use('/api/public/system', systemStatusRoutes);
app.use('/api/address', addressAutocompleteRoutes);

// --- PawTag Commerce Routes ---
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/admin/commerce', adminCommerceRoutes);
app.use('/api/admin/commerce/categories', adminCategoryRoutes);
app.use('/api/admin/commerce/collections', adminCollectionRoutes);
app.use('/api/admin/commerce/brands', adminBrandRoutes);
app.use('/api/admin/commerce/shipping-methods', adminShippingRoutes);
app.use('/api/admin/commerce/fulfilments', adminFulfilmentRoutes);
app.use('/api/admin/commerce/returns', adminReturnRoutes);
app.use('/api/admin/commerce/shipments', adminShipmentRoutes);
app.use('/api/admin/commerce/payments', adminPaymentRoutes);
app.use('/api/admin/commerce/promo-codes', adminPromoCodeRoutes);
app.use('/api/public/promo', promoPublicRoutes);

// Stripe webhooks need raw body for signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

// --- Error Handling ---
app.use(notFoundHandler);
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

// --- Start Server ---
async function start() {
  try {
    await connectDatabase(config.dbUrl);
    logger.info('Database connected');

    // Start 24-hour reminder service
    startReminderService();

    // Start subscription lifecycle service
    startSubscriptionService();

    // Start escalation polling service
    startEscalationService();

    // Start daily low stock check service
    startLowStockService();

    // Start orphan payment detection job
    const { startOrphanPaymentJob } = await import('./jobs/orphanPaymentDetection');
    startOrphanPaymentJob();

    // Start order auto-cancel job
    const { startOrderAutoCancelJob } = await import('./jobs/orderAutoCancel');
    startOrderAutoCancelJob();

    // Start shipping tracking poll job
    const { startTrackingPollJob } = await import('./jobs/shippingTrackingPoll');
    startTrackingPollJob();

    // Start webhook retry job
    const { startWebhookRetryJob } = await import('./jobs/webhookRetry');
    startWebhookRetryJob();

    // Start payment reconciliation job
    const { startPaymentReconciliationJob } = await import('./jobs/paymentReconciliation');
    startPaymentReconciliationJob();

    const server = app.listen(config.port, () => {
      logger.info(`PawTag API running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        logger.info('HTTP server closed');
        await flushSystemLogs();
        await flushMonitoring();
        await shutdownTracing();
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down...');
      server.close(async () => {
        await flushSystemLogs();
        await flushMonitoring();
        await shutdownTracing();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Only start server when run directly (not imported by tests)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js')
);
if (isDirectRun || process.env.NODE_ENV !== 'test') {
  start();
}

// --- Process-level exception handlers ---
process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  // Capture in monitoring if available
  if (reason instanceof Error) {
    const { captureException } = require('./lib/monitoring');
    captureException(reason, { severity: 'fatal', operation: 'unhandledRejection' });
  }
  process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, 'Uncaught exception — process may be in undefined state');
  // Capture in monitoring if available
  const { captureException } = require('./lib/monitoring');
  captureException(err, { severity: 'fatal', operation: 'uncaughtException' });
  process.exit(1);
});

export default app;
