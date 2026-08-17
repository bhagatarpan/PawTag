import pino from 'pino';
import { writeLog, flushSystemLogs } from './log-writer';

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const isTest = process.env.NODE_ENV === 'test';

const SERVICE_NAME = process.env.SERVICE_NAME || 'pawtag-api';
const SERVICE_VERSION = process.env.SERVICE_VERSION || 'unknown';

/**
 * Fields that must never appear in logs.
 * Pino's redaction replaces values with '[REDACTED]'.
 */
const REDACT_PATHS = [
  'password',
  'passwordHash',
  'hashedPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwtSecret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'otp',
  'otpCode',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'privateKey',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.otp',
  '*.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'finderPhone',
  'finderEmail',
  'emergencyContact',
  'emergencyPhone',
  'location.latitude',
  'location.longitude',
];

/**
 * Core structured logger for PawTag.
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *   logger.info({ userId: '123', action: 'login' }, 'User logged in');
 *   logger.error({ err: error, requestId }, 'Operation failed');
 *
 * Child loggers:
 *   const child = logger.child({ requestId, feature: 'auth' });
 *   child.info('Processing login');
 */
export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  name: SERVICE_NAME,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  base: {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: process.env.NODE_ENV || 'development',
  },
  hooks: {
    logMethod(args: unknown[], method: (...methodArgs: unknown[]) => void) {
      // Fire-and-forget: send log entry to MongoDB writer
      if (!isTest) {
        try {
          const entry = args[0];
          if (entry && typeof entry === 'object') {
            const levelNum = (this as unknown as { level?: { value?: number } }).level?.value ?? 30;
            writeLog({
              level: levelNum,
              time: Date.now(),
              ...entry as Record<string, unknown>,
            });
          }
        } catch {
          // Never break logging
        }
      }
      // Call the original Pino method
      method.apply(this, args);
    },
  },
  ...(isDev && !isTest
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname,service,version,environment',
          },
        },
      }
    : {}),
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with pre-bound context fields.
 *
 * @example
 *   const reqLogger = createChildLogger({ requestId: req.id, feature: 'auth' });
 *   reqLogger.info('Processing login attempt');
 */
export function createChildLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Create a scoped logger for a specific feature or workflow.
 *
 * @example
 *   const authLogger = createScopedLogger('auth');
 *   authLogger.info({ userId }, 'Login attempt');
 */
export function createScopedLogger(scope: string): pino.Logger {
  return logger.child({ feature: scope });
}

/** Flush pending system logs to MongoDB. Call before process exit. */
export { flushSystemLogs };

export default logger;
