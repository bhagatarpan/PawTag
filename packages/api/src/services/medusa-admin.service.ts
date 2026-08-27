/**
 * Medusa Admin API client for bidirectional sync.
 *
 * Used by admin actions (cancel, refund, ship) to update Medusa when
 * PawTag order state changes. All calls are best-effort — Medusa failure
 * does not block the PawTag operation. The reconciliation job catches drift.
 */

import logger from '../lib/logger';
import { logIntegration } from '../lib/timing';
import { auditService } from './audit';

const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const MEDUSA_ADMIN_TOKEN = process.env.MEDUSA_ADMIN_TOKEN || '';
const MEDUSA_TIMEOUT_MS = 10_000;

interface MedusaApiResponse {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

async function medusaAdminRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<MedusaApiResponse> {
  if (!MEDUSA_ADMIN_TOKEN) {
    return { ok: false, status: 0, error: 'MEDUSA_ADMIN_TOKEN not configured' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MEDUSA_TIMEOUT_MS);

    const response = await fetch(`${MEDUSA_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${MEDUSA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      return { ok: false, status: response.status, error: errorBody };
    }

    const data = await response.json().catch(() => ({}));
    return { ok: true, status: response.status, data };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, error: 'Medusa API request timed out' };
    }
    return { ok: false, status: 0, error: err.message || 'Medusa API request failed' };
  }
}

export interface MedusaSyncResult {
  success: boolean;
  error?: string;
}

/** Audit-log a Medusa sync attempt (fire-and-forget). */
function auditMedusaSync(
  action: string,
  medusaOrderId: string,
  success: boolean,
  metadata: Record<string, unknown> = {},
): void {
  auditService.log({
    actorType: 'SYSTEM',
    actorId: 'medusa-admin-service',
    actorUsername: 'medusa-admin-service',
    sourceIp: 'system',
    userAgent: 'medusa-admin-service',
    applicationName: 'pawtag-api',
    applicationVersion: '1.0.0',
    apiVersion: 'v1',
    environment: process.env.NODE_ENV || 'development',
  }, {
    action,
    eventType: 'SYSTEM',
    eventCategory: 'INTEGRATION',
    operationType: 'WEBHOOK',
    resourceType: 'Order',
    resourceId: medusaOrderId,
    outcome: success ? 'SUCCESS' : 'FAILURE',
    severity: success ? 'LOW' : 'HIGH',
    metadata: { medusaOrderId, ...metadata },
  }).catch(() => {});
}

/**
 * Cancel an order in Medusa.
 * Called after PawTag order is cancelled to keep Medusa in sync.
 */
export async function cancelMedusaOrder(
  medusaOrderId: string,
  reason: string,
): Promise<MedusaSyncResult> {
  return logIntegration('Medusa', 'cancelOrder', async () => {
    const result = await medusaAdminRequest('POST', `/admin/orders/${medusaOrderId}/cancel`, {
      metadata: { cancellation_reason: reason, cancelled_by: 'pawtag-admin' },
    });

    if (!result.ok) {
      logger.warn(
        { medusaOrderId, status: result.status, error: result.error },
        'Failed to cancel order in Medusa',
      );
      auditMedusaSync('medusa_order_cancel_failed', medusaOrderId, false, { reason, error: result.error });
      return { success: false, error: result.error };
    }

    logger.info({ medusaOrderId }, 'Order cancelled in Medusa');
    auditMedusaSync('medusa_order_cancelled', medusaOrderId, true, { reason });
    return { success: true };
  }, { medusaOrderId, reason });
}

/**
 * Create a fulfillment in Medusa for shipped items.
 * Called after PawTag order is marked as shipped.
 */
export async function createMedusaFulfillment(
  medusaOrderId: string,
  items: Array<{ line_item_id: string; quantity: number }>,
): Promise<MedusaSyncResult & { fulfillmentId?: string }> {
  return logIntegration('Medusa', 'createFulfillment', async () => {
    const result = await medusaAdminRequest('POST', `/admin/orders/${medusaOrderId}/fulfillments`, {
      items,
      metadata: { created_by: 'pawtag-admin' },
    });

    if (!result.ok) {
      logger.warn(
        { medusaOrderId, status: result.status, error: result.error },
        'Failed to create fulfillment in Medusa',
      );
      auditMedusaSync('medusa_fulfillment_create_failed', medusaOrderId, false, { itemCount: items.length, error: result.error });
      return { success: false, error: result.error };
    }

    const fulfillmentId = (result.data as any)?.fulfillment?.id;
    logger.info({ medusaOrderId, fulfillmentId }, 'Fulfillment created in Medusa');
    auditMedusaSync('medusa_fulfillment_created', medusaOrderId, true, { fulfillmentId, itemCount: items.length });
    return { success: true, fulfillmentId };
  }, { medusaOrderId, itemCount: items.length });
}

/**
 * Add tracking to a Medusa fulfillment and mark as shipped.
 */
export async function createMedusaShipment(
  medusaOrderId: string,
  fulfillmentId: string,
  trackingNumber: string,
  carrier?: string,
): Promise<MedusaSyncResult> {
  return logIntegration('Medusa', 'createShipment', async () => {
    const result = await medusaAdminRequest(
      'POST',
      `/admin/orders/${medusaOrderId}/fulfillments/${fulfillmentId}/shipment`,
      {
        tracking_number: trackingNumber,
        ...(carrier ? { metadata: { carrier } } : {}),
      },
    );

    if (!result.ok) {
      logger.warn(
        { medusaOrderId, fulfillmentId, status: result.status, error: result.error },
        'Failed to create shipment in Medusa',
      );
      auditMedusaSync('medusa_shipment_create_failed', medusaOrderId, false, { fulfillmentId, trackingNumber, error: result.error });
      return { success: false, error: result.error };
    }

    logger.info({ medusaOrderId, fulfillmentId, trackingNumber }, 'Shipment created in Medusa');
    auditMedusaSync('medusa_shipment_created', medusaOrderId, true, { fulfillmentId, trackingNumber, carrier });
    return { success: true };
  }, { medusaOrderId, fulfillmentId, trackingNumber });
}

/**
 * Cancel an order in Medusa after a refund.
 * Medusa needs to know the order was refunded to release inventory.
 */
export async function cancelMedusaOrderAfterRefund(
  medusaOrderId: string,
  reason: string,
): Promise<MedusaSyncResult> {
  return logIntegration('Medusa', 'cancelOrderAfterRefund', async () => {
    // First try to cancel — if already cancelled, that's fine
    const result = await medusaAdminRequest('POST', `/admin/orders/${medusaOrderId}/cancel`, {
      metadata: { cancellation_reason: `Refunded: ${reason}`, cancelled_by: 'pawtag-admin' },
    });

    if (!result.ok && !result.error?.includes('already')) {
      logger.warn(
        { medusaOrderId, status: result.status, error: result.error },
        'Failed to cancel order in Medusa after refund',
      );
      auditMedusaSync('medusa_refund_cancel_failed', medusaOrderId, false, { reason, error: result.error });
      return { success: false, error: result.error };
    }

    logger.info({ medusaOrderId }, 'Order cancelled in Medusa after refund');
    auditMedusaSync('medusa_refund_cancelled', medusaOrderId, true, { reason });
    return { success: true };
  }, { medusaOrderId, reason });
}
