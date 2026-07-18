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
  max: 100,
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
