/**
 * Health check endpoints for PawTag.
 *
 * Provides:
 * - Liveness: Is the process alive?
 * - Readiness: Can the service accept traffic?
 * - Dependency health: Are required dependencies available?
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { collectMetrics } from '../lib/metrics';
import logger from '../lib/logger';

const router = Router();

const startTime = Date.now();

/**
 * Basic health check — backward compatible endpoint.
 * Returns simple ok status for existing tests and monitoring.
 */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness probe — always returns 200 if the process is running.
 * Used by container orchestrators to detect hung processes.
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe — returns 200 only if the service can accept traffic.
 * Checks critical dependencies (database).
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database check
  const dbStart = performance.now();
  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      // Connected — run a ping to verify
      await mongoose.connection.db?.admin().ping();
      checks.database = {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - dbStart),
      };
    } else {
      checks.database = {
        status: 'unhealthy',
        error: `Connection state: ${state}`,
      };
    }
  } catch (error: any) {
    checks.database = {
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - dbStart),
      error: error.message,
    };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Dependency health — detailed status of external services.
 * Does NOT expose sensitive diagnostic information.
 */
router.get('/dependencies', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; configured: boolean; error?: string }> = {};

  // Database
  checks.database = {
    status: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
    configured: !!process.env.DB_URL,
  };

  // Stripe
  checks.stripe = {
    status: 'unknown',
    configured: !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_demo_key',
  };

  // Resend
  checks.resend = {
    status: 'unknown',
    configured: !!process.env.RESEND_API_KEY,
  };

  // Twilio
  checks.twilio = {
    status: 'unknown',
    configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  };

  // Firebase
  checks.firebase = {
    status: 'unknown',
    configured: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY),
  };

  // R2
  checks.cloudflareR2 = {
    status: 'unknown',
    configured: !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
  };

  const anyConfigured = Object.values(checks).some(c => c.configured);

  res.status(200).json({
    status: 'ok',
    dependencies: checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Metrics endpoint — returns collected metrics in a simple JSON format.
 * Can be adapted to export Prometheus/OpenTelemetry format.
 */
router.get('/metrics', (_req: Request, res: Response) => {
  const metrics = collectMetrics();
  res.status(200).json({
    timestamp: new Date().toISOString(),
    ...metrics,
  });
});

export default router;
