/**
 * Timing and operation logging utilities for PawTag.
 *
 * Provides consistent duration tracking and structured logging
 * for services, database operations, and external integrations.
 */

import { getRequestContext } from './request-context';
import logger from './logger';

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
}

export interface LogContext {
  feature?: string;
  workflow?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Time an async operation and return structured result.
 */
export async function timed<T>(
  fn: () => Promise<T>,
): Promise<OperationResult<T>> {
  const start = performance.now();
  try {
    const data = await fn();
    const duration = Math.round(performance.now() - start);
    return { success: true, data, duration };
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    return { success: false, error: error as Error, duration };
  }
}

/**
 * Log a service operation with timing and context.
 * Use at service boundaries for important business operations.
 *
 * @example
 *   const result = await logOperation('createPet', 'pets', async () => {
 *     return Pet.create(data);
 *   }, { userId, petName });
 */
export async function logOperation<T>(
  operation: string,
  feature: string,
  fn: () => Promise<T>,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const ctx = getRequestContext();
  const start = performance.now();
  const log = logger.child({
    feature,
    operation,
    requestId: ctx?.requestId,
    correlationId: ctx?.correlationId,
  });

  log.debug({ ...extra }, `${operation} started`);

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);

    log.info({
      ...extra,
      duration,
      outcome: 'success',
    }, `${operation} completed`);

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);

    log.error({
      err: error,
      ...extra,
      duration,
      outcome: 'failure',
    }, `${operation} failed`);

    throw error;
  }
}

/**
 * Log an external integration call with timing and provider context.
 * Never logs sensitive payloads, authorization headers, or API keys.
 *
 * @example
 *   const result = await logIntegration('Stripe', 'createPaymentIntent', async () => {
 *     return stripe.paymentIntents.create({ amount });
 *   }, { orderId, amount });
 */
export async function logIntegration<T>(
  provider: string,
  operation: string,
  fn: () => Promise<T>,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const ctx = getRequestContext();
  const start = performance.now();
  const log = logger.child({
    feature: 'integration',
    provider,
    operation,
    requestId: ctx?.requestId,
    correlationId: ctx?.correlationId,
  });

  log.debug({ ...extra }, `${provider}.${operation} started`);

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);

    log.info({
      ...extra,
      duration,
      outcome: 'success',
    }, `${provider}.${operation} completed`);

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);

    log.error({
      err: error,
      ...extra,
      duration,
      outcome: 'failure',
    }, `${provider}.${operation} failed`);

    throw error;
  }
}

/**
 * Log a database operation with timing and collection context.
 * Supports slow-query logging via threshold.
 *
 * @example
 *   const user = await logDbOperation('find', 'User', async () => {
 *     return User.findOne({ email });
 *   }, { email: '***' });
 */
export async function logDbOperation<T>(
  operation: string,
  model: string,
  fn: () => Promise<T>,
  extra: Record<string, unknown> = {},
  slowThresholdMs = 500
): Promise<T> {
  const ctx = getRequestContext();
  const start = performance.now();

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    const isSlow = duration >= slowThresholdMs;

    if (isSlow) {
      logger.warn({
        feature: 'database',
        operation,
        model,
        duration,
        slowThreshold: slowThresholdMs,
        requestId: ctx?.requestId,
        ...extra,
      }, `Slow query: ${operation} on ${model}`);
    } else {
      logger.debug({
        feature: 'database',
        operation,
        model,
        duration,
        requestId: ctx?.requestId,
        ...extra,
      }, `${operation} on ${model}`);
    }

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);

    logger.error({
      err: error,
      feature: 'database',
      operation,
      model,
      duration,
      requestId: ctx?.requestId,
      ...extra,
    }, `Database ${operation} on ${model} failed`);

    throw error;
  }
}

/**
 * Log a background job execution with timing and outcome.
 */
export async function logJob<T>(
  jobName: string,
  fn: () => Promise<T>,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const start = performance.now();
  const log = logger.child({
    feature: 'background-job',
    job: jobName,
  });

  log.info({ ...extra }, `${jobName} started`);

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);

    log.info({
      ...extra,
      duration,
      outcome: 'success',
    }, `${jobName} completed`);

    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);

    log.error({
      err: error,
      ...extra,
      duration,
      outcome: 'failure',
    }, `${jobName} failed`);

    throw error;
  }
}
