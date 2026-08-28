/**
 * @module Commerce Audit
 * @description Commerce-specific audit logging helpers.
 *
 * Wraps the existing audit service with commerce-specific context.
 * All important commerce operations (payments, orders, refunds) are logged
 * through these helpers for a complete audit trail.
 *
 * Usage:
 * ```typescript
 * await logCommerceEvent({
 *   action: 'payment_created',
 *   resourceType: 'Payment',
 *   resourceId: paymentIntentId,
 *   amount: 59.99,
 *   currency: 'NZD',
 * }, req);
 * ```
 */

import { auditService, type AuditContext, type AuditEventInput } from '../services/audit';
import logger from '../lib/logger';

/**
 * Commerce audit event categories.
 * Maps to the existing AuditEvent eventCategory enum.
 */
export type CommerceAuditCategory =
  | 'FINANCIAL'
  | 'INTEGRATION'
  | 'SYSTEM';

/**
 * Commerce-specific audit event input.
 * Simplified from the full AuditEventInput for common commerce operations.
 */
export interface CommerceAuditInput {
  /** Action identifier (e.g., 'payment_created', 'order_placed') */
  action: string;

  /** Event type for filtering (e.g., 'commerce.payment.created') */
  eventType?: string;

  /** Audit category */
  category?: CommerceAuditCategory;

  /** Resource type (e.g., 'Order', 'Payment', 'Refund') */
  resourceType: string;

  /** Resource ID */
  resourceId?: string;

  /** Operation outcome */
  outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';

  /** Severity level */
  severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  /** Additional metadata to log */
  metadata?: Record<string, unknown>;

  /** State before the operation */
  beforeState?: Record<string, unknown>;

  /** State after the operation */
  afterState?: Record<string, unknown>;
}

/**
 * Default audit context for commerce operations.
 * Fills in common fields so callers only specify what's unique.
 */
const COMMERCE_DEFAULTS: AuditContext = {
  actorType: 'SYSTEM',
  applicationName: 'pawtag-commerce',
  applicationVersion: '1.0.0',
  apiVersion: 'v1',
  environment: process.env.NODE_ENV || 'development',
};

/**
 * Log a commerce audit event.
 *
 * This is fire-and-forget — audit failures are logged but do not
 * block the commerce operation.
 *
 * @param input - Commerce audit event details
 * @param req - Optional Express request for IP/user-agent
 */
export async function logCommerceEvent(
  input: CommerceAuditInput,
  req?: { ip?: string; headers?: Record<string, string | undefined>; user?: { id?: string; username?: string } },
): Promise<void> {
  const auditInput: AuditEventInput = {
    action: input.action,
    eventType: input.eventType ?? `commerce.${input.action}`,
    eventCategory: input.category ?? 'FINANCIAL',
    operationType: input.outcome === 'FAILURE' ? 'UPDATE' : 'CREATE',
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome ?? 'SUCCESS',
    severity: input.severity ?? 'HIGH',
    metadata: input.metadata,
    beforeState: input.beforeState,
    afterState: input.afterState,
  };

  const context: AuditContext = {
    ...COMMERCE_DEFAULTS,
    actorId: req?.user?.id ?? 'system',
    actorUsername: req?.user?.username ?? 'commerce-system',
    sourceIp: req?.ip ?? 'system',
    userAgent: req?.headers?.['user-agent'] ?? 'commerce-service',
  };

  // Fire and forget — never block on audit failure
  auditService.log(context, auditInput).catch((err) => {
    logger.error({ err, action: input.action, resourceType: input.resourceType }, 'Commerce audit log failed');
  });
}

/**
 * Log a payment event (payment created, confirmed, failed, refunded).
 */
export async function logPaymentEvent(
  action: 'created' | 'confirmed' | 'failed' | 'refunded',
  params: {
    paymentIntentId: string;
    orderId?: string;
    orderNumber?: string;
    amount?: number;
    currency?: string;
    reason?: string;
    error?: string;
  },
  req?: Parameters<typeof logCommerceEvent>[1],
): Promise<void> {
  await logCommerceEvent({
    action: `payment_${action}`,
    eventType: `commerce.payment.${action}`,
    resourceType: 'Payment',
    resourceId: params.paymentIntentId,
    outcome: action === 'failed' ? 'FAILURE' : 'SUCCESS',
    severity: action === 'failed' ? 'HIGH' : 'MEDIUM',
    metadata: {
      paymentIntentId: params.paymentIntentId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      amount: params.amount,
      currency: params.currency,
      reason: params.reason,
      error: params.error,
    },
  }, req);
}

/**
 * Log an order event (created, confirmed, cancelled, refunded).
 */
export async function logOrderEvent(
  action: 'created' | 'confirmed' | 'cancelled' | 'refunded' | 'shipped' | 'delivered',
  params: {
    orderId: string;
    orderNumber: string;
    amount?: number;
    currency?: string;
    reason?: string;
    status?: string;
  },
  req?: Parameters<typeof logCommerceEvent>[1],
): Promise<void> {
  await logCommerceEvent({
    action: `order_${action}`,
    eventType: `commerce.order.${action}`,
    resourceType: 'Order',
    resourceId: params.orderId,
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      orderNumber: params.orderNumber,
      amount: params.amount,
      currency: params.currency,
      reason: params.reason,
      status: params.status,
    },
  }, req);
}

/**
 * Log a refund event (created, succeeded, failed).
 */
export async function logRefundEvent(
  action: 'created' | 'succeeded' | 'failed',
  params: {
    refundId?: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    currency: string;
    reason?: string;
    error?: string;
  },
  req?: Parameters<typeof logCommerceEvent>[1],
): Promise<void> {
  await logCommerceEvent({
    action: `refund_${action}`,
    eventType: `commerce.refund.${action}`,
    resourceType: 'Refund',
    resourceId: params.refundId,
    outcome: action === 'failed' ? 'FAILURE' : 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      amount: params.amount,
      currency: params.currency,
      reason: params.reason,
      error: params.error,
    },
  }, req);
}
