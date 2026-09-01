/**
 * @module CSV Accounting Exporter
 * @description Exports refund data as CSV in 3 modes: full, xero, configurable.
 *
 * - `full`: All columns (Date, Order, Customer, Refund ID, ARN, Status, Amount, etc.)
 * - `xero`: Xero-compatible columns (Date, Reference, Description, Amount)
 * - `configurable`: Caller specifies which columns to include
 *
 * Compatible with: Xero, QuickBooks, MYOB, generic accounting software.
 */

import { getSetting } from '../../commerce/config';

export interface RefundExportRow {
  refundId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: string;
  arn?: string;
  initiatedBy: string;
  cancelledBy: string;
  cancellationReason: string;
  refundSettledAt?: Date;
  refundCreatedAt: Date;
  paymentIntentId: string;
}

/** Full column set for the 'full' mode */
const FULL_COLUMNS = [
  'Date',
  'Order Number',
  'Customer Name',
  'Customer Email',
  'Refund ID',
  'ARN',
  'Status',
  'Amount',
  'Currency',
  'Initiated By',
  'Cancelled By',
  'Cancellation Reason',
  'Settled At',
  'Stripe Payment Intent',
] as const;

/** Xero-compatible column set for the 'xero' mode */
const XERO_COLUMNS = [
  'Date',
  'Reference',
  'Description',
  'Amount',
] as const;

export type CsvColumnMode = 'full' | 'xero' | 'configurable';

/**
 * Escape a value for CSV.
 */
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a date as YYYY-MM-DD.
 */
function formatDate(d: Date | undefined): string {
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Map a refund row to the full column set.
 */
function rowToFullColumns(r: RefundExportRow): Record<string, string> {
  return {
    Date: formatDate(r.refundCreatedAt),
    'Order Number': r.orderNumber,
    'Customer Name': r.customerName,
    'Customer Email': r.customerEmail,
    'Refund ID': r.refundId,
    ARN: r.arn || '',
    Status: r.status,
    Amount: r.amount.toFixed(2),
    Currency: r.currency,
    'Initiated By': r.initiatedBy,
    'Cancelled By': r.cancelledBy,
    'Cancellation Reason': r.cancellationReason,
    'Settled At': formatDate(r.refundSettledAt),
    'Stripe Payment Intent': r.paymentIntentId,
  };
}

/**
 * Map a refund row to the Xero-compatible column set.
 */
function rowToXeroColumns(r: RefundExportRow): Record<string, string> {
  const description = `Refund for order ${r.orderNumber}${r.cancellationReason ? ` - ${r.cancellationReason}` : ''}`;
  return {
    Date: formatDate(r.refundSettledAt || r.refundCreatedAt),
    Reference: `RFD-${r.refundId}`,
    Description: description,
    Amount: `-${r.amount.toFixed(2)}`,
  };
}

/**
 * Export refunds to CSV.
 */
export async function exportRefundsToCsv(
  rows: RefundExportRow[],
  options: { mode?: CsvColumnMode; customColumns?: string[] } = {},
): Promise<string> {
  const defaultMode = (await getSetting('commerce.accounting.csvColumnMode').catch(() => 'full')) as CsvColumnMode;
  const mode = options.mode || defaultMode;

  let columns: readonly string[];
  let rowMapper: (r: RefundExportRow) => Record<string, string>;

  if (mode === 'xero') {
    columns = XERO_COLUMNS;
    rowMapper = rowToXeroColumns;
  } else if (mode === 'configurable' && options.customColumns?.length) {
    columns = options.customColumns as any;
    // Build a mapper that extracts the requested columns from the full row
    const fullMapper = rowToFullColumns;
    rowMapper = (r) => {
      const full = fullMapper(r);
      const out: Record<string, string> = {};
      for (const c of options.customColumns!) {
        out[c] = full[c] || '';
      }
      return out;
    };
  } else {
    columns = FULL_COLUMNS;
    rowMapper = rowToFullColumns;
  }

  const lines: string[] = [];
  // Header
  lines.push(columns.map(escapeCsv).join(','));
  // Rows
  for (const row of rows) {
    const mapped = rowMapper(row);
    lines.push(columns.map((c) => escapeCsv(mapped[c])).join(','));
  }

  return lines.join('\n');
}
