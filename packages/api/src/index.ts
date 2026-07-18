import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

import { config } from './config';
import { connectDatabase } from '@pawtag/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { swaggerSpec } from './swagger';

import QRCode from 'qrcode';
import { Tag } from '@pawtag/db';

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import customerRoutes from './routes/customer';
import finderRoutes from './routes/finder';
import uploadRoutes from './routes/upload';

const app = express();

// --- Security & Middleware ---
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts, please try again later' },
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

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to generate QR code' }); }
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
  } catch (error) { res.status(500).json({ success: false, error: 'Failed to generate sticker' }); }
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/finder', finderRoutes);
app.use('/api/upload', uploadRoutes);

// Serve uploaded files as static assets
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Error Handling ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Start Server ---
async function start() {
  try {
    await connectDatabase(config.dbUrl);
    console.log('Database connected');

    app.listen(config.port, () => {
      console.log(`PawTag API running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
