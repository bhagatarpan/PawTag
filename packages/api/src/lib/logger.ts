import pino from 'pino';
import { writeLog, flushSystemLogs } from './log-writer';

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const isTest = process.env.NODE_ENV === 'test';

const SERVICE_NAME = process.env.SERVICE_NAME || 'pawtag-api';
const SERVICE_VERSION = process.env.SERVICE_VERSION || 'unknown';

const REDACT_PATHS = [
  'password', 'passwordHash', 'hashedPassword', 'token', 'accessToken',
  'refreshToken', 'secret', 'jwtSecret', 'apiKey', 'api_key',
  'authorization', 'cookie', 'otp', 'otpCode', 'creditCard',
  'cardNumber', 'cvv', 'ssn', 'privateKey',
  '*.password', '*.token', '*.secret', '*.apiKey', '*.otp', '*.authorization',
  'req.headers.authorization', 'req.headers.cookie',
  'finderPhone', 'finderEmail', 'emergencyContact', 'emergencyPhone',
  'location.latitude', 'location.longitude',
];

const LEVEL_MAP: Record<string, number> = { debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

const baseLogger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  name: SERVICE_NAME,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  base: {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: process.env.NODE_ENV || 'development',
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
 * Wrap each log level method to capture the level and forward to the MongoDB writer.
 * This is more reliable than Pino's logMethod hook which doesn't expose the level.
 */
function wrapLogMethods(loggerInstance: pino.Logger): void {
  for (const levelName of ['debug', 'info', 'warn', 'error', 'fatal'] as const) {
    const original = (loggerInstance as any)[levelName];
    if (typeof original === 'function') {
      (loggerInstance as any)[levelName] = function (...args: unknown[]) {
        if (!isTest) {
          try {
            const first = args[0];
            const entry = (first && typeof first === 'object' && typeof first !== 'string')
              ? first as Record<string, unknown>
              : {};
            writeLog({
              level: LEVEL_MAP[levelName] || 30,
              time: Date.now(),
              ...entry,
              msg: typeof first === 'string' ? first : (args[1] as string) || (entry.msg as string),
            });
          } catch {
            // Never break logging
          }
        }
        return original.apply(this, args);
      };
    }
  }
}

wrapLogMethods(baseLogger);

export const logger = baseLogger;

export function createChildLogger(context: Record<string, unknown>): pino.Logger {
  const child = baseLogger.child(context);
  wrapLogMethods(child);
  return child;
}

export function createScopedLogger(scope: string): pino.Logger {
  const child = baseLogger.child({ feature: scope });
  wrapLogMethods(child);
  return child;
}

export { flushSystemLogs };
export default logger;
