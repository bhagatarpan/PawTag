import { SystemLog } from '@pawtag/db';
import type { LogLevel, LogCategory } from '@pawtag/db';
import { shouldStoreLog, getRetentionDays } from './system-log-settings';
import { getRequestContext } from './request-context';

interface LogEntry {
  level: number;
  time: number;
  msg?: string;
  message?: string;
  err?: {
    name?: string;
    message?: string;
    code?: string;
    stack?: string;
    fingerprint?: string;
  };
  [key: string]: unknown;
}

const LEVEL_MAP: Record<number, LogLevel> = {
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

const BATCH_INTERVAL_MS = 500;
const MAX_BATCH_SIZE = 50;

let batch: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;

function classifyCategory(entry: LogEntry): LogCategory {
  const meta = entry as Record<string, unknown>;

  if (meta.db || meta.collection || meta.model || meta.query) return 'DATABASE';
  if (meta.statusCode || meta.method || meta.route || meta.httpMethod) return 'HTTP';
  if (meta.auth || meta.login || meta.mfa || meta.otp || meta.password) return 'AUTH';
  if (meta.provider || meta.stripe || meta.resend || meta.twilio || meta.firebase || meta.r2) return 'INTEGRATION';
  if (meta.job || meta.cron || meta.scheduled || meta.queue) return 'JOB';
  if (meta.rateLimit || meta.captcha || meta.bruteForce) return 'SECURITY';
  if (meta.notification || meta.push || meta.email) return 'NOTIFICATION';
  if (meta.config || meta.setting || meta.featureFlag) return 'CONFIG';

  return 'GENERAL';
}

function extractError(entry: LogEntry) {
  if (!entry.err) return undefined;
  return {
    name: entry.err.name,
    message: entry.err.message,
    code: entry.err.code,
    fingerprint: entry.err.fingerprint,
    stack: entry.err.stack,
  };
}

function extractMetadata(entry: LogEntry): Record<string, unknown> | undefined {
  const skip = new Set([
    'level', 'time', 'timestamp', 'msg', 'message', 'err', 'hostname', 'pid',
    'service', 'version', 'environment', 'requestId', 'correlationId',
    'traceId', 'transactionId', 'userId', 'feature', 'operation', 'durationMs',
    'v', 'type',
  ]);
  const meta: Record<string, unknown> = {};
  let hasKeys = false;
  for (const [key, value] of Object.entries(entry)) {
    if (!skip.has(key) && value !== undefined) {
      meta[key] = value;
      hasKeys = true;
    }
  }
  return hasKeys ? meta : undefined;
}

function extractSource(entry: LogEntry): string | undefined {
  const caller = entry.caller as string | undefined;
  if (caller) return caller;
  return undefined;
}

async function flushBatch(): Promise<void> {
  if (batch.length === 0) return;

  const entries = batch.splice(0, batch.length);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  try {
    const retentionDays = await getRetentionDays();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + retentionDays * 86400000);

    const docs = [];
    for (const entry of entries) {
      const level = LEVEL_MAP[entry.level] || 'info';
      const category = classifyCategory(entry);
      const shouldStore = await shouldStoreLog(level, category);
      if (!shouldStore) continue;

      const ctx = getRequestContext();

      docs.push({
        timestamp: new Date(entry.time || Date.now()),
        level,
        message: entry.msg || entry.message || '',
        category,
        service: (entry.service as string) || 'pawtag-api',
        environment: (entry.environment as string) || process.env.NODE_ENV || 'development',
        requestId: ctx?.requestId || (entry.requestId as string) || undefined,
        correlationId: ctx?.correlationId || (entry.correlationId as string) || undefined,
        traceId: ctx?.traceId || (entry.traceId as string) || undefined,
        transactionId: ctx?.transactionId || (entry.transactionId as string) || undefined,
        userId: ctx?.userId || (entry.userId as string) || undefined,
        feature: (entry.feature as string) || undefined,
        operation: (entry.operation as string) || undefined,
        error: extractError(entry),
        metadata: extractMetadata(entry),
        durationMs: (entry.durationMs as number) || undefined,
        source: extractSource(entry),
        retentionDays,
        expiresAt,
      });
    }

    if (docs.length > 0) {
      await SystemLog.insertMany(docs, { ordered: false }).catch(() => {});
    }
  } catch {
    // Silently fail — never block application code
  }
}

function scheduleFlush(): void {
  if (flushTimer || isShuttingDown) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBatch().catch(() => {});
  }, BATCH_INTERVAL_MS);
}

export function writeLog(entry: LogEntry): void {
  if (isShuttingDown) return;
  batch.push(entry);
  if (batch.length >= MAX_BATCH_SIZE) {
    flushBatch().catch(() => {});
  } else {
    scheduleFlush();
  }
}

export async function flushSystemLogs(): Promise<void> {
  isShuttingDown = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushBatch();
}
