/**
 * @module MYOB Accounting Exporter (STUB)
 * @description Stub implementation for MYOB integration.
 *
 * MYOB requires OAuth 2.0 with company file ID and additional setup.
 * This stub:
 * 1. Returns "coming soon" message
 * 2. Falls back to CSV export
 * 3. Logs that MYOB was requested
 *
 * To fully implement:
 * 1. Register app at https://developer.myob.com
 * 2. Implement OAuth flow similar to Xero
 * 3. Use MYOB API endpoints (https://api.myob.com/accountright/v2)
 */

import logger from '../../lib/logger';

export interface MyobExportRow {
  refundId: string;
  orderNumber: string;
  amount: number;
  description: string;
  date: Date;
}

/**
 * Check if MYOB is connected.
 *
 * NOTE: Always returns false until MYOB OAuth flow is implemented.
 */
export async function isMyobConnected(): Promise<boolean> {
  return false;
}

/**
 * Connect to MYOB (OAuth flow).
 *
 * NOTE: Not yet implemented. To enable:
 * 1. Set MYOB_CLIENT_ID, MYOB_CLIENT_SECRET, MYOB_REDIRECT_URI env vars
 * 2. Implement OAuth flow similar to xeroExporter.ts
 * 3. Store tokens in IntegrationConnection model
 */
export async function connectMyob(): Promise<{ authUrl: string }> {
  throw new Error('MYOB integration coming soon. Please contact support@pawtag.co.nz to request early access.');
}

/**
 * Export refunds to MYOB.
 *
 * NOTE: Currently falls back to CSV export. Returns an explanatory error.
 */
export async function exportRefundsToMyob(rows: MyobExportRow[]): Promise<{
  success: boolean;
  message: string;
  rowsExported: 0;
}> {
  logger.info({ count: rows.length }, 'MYOB export requested but not yet implemented — falling back to CSV');
  return {
    success: false,
    message: 'MYOB integration is coming soon. Please use CSV export for now.',
    rowsExported: 0,
  };
}
