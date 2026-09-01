/**
 * @module GL (General Ledger) Accounting Exporter
 * @description Exports refund data as GL journal entries (debit/credit).
 *
 * Format: CSV with debit/credit columns.
 * Each refund produces 2 lines:
 *   1. Debit: Refund Clearing Account (the money going out)
 *   2. Credit: Sales Account (reversing the original sale)
 *
 * Compatible with: Xero, QuickBooks, MYOB, and any software that supports
 * journal entry import via CSV.
 *
 * Configuration via CMS settings:
 * - commerce.accounting.glAccountCode (default '1200' - Sales)
 * - commerce.accounting.glRefundAccountCode (default '2200' - Refund Clearing)
 * - commerce.accounting.taxCode (default 'GST')
 */

import { getSetting } from '../../commerce/config';

export interface GLExportRow {
  date: Date;
  reference: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  taxCode: string;
}

const GL_COLUMNS = [
  'Date',
  'Reference',
  'Description',
  'Debit Account',
  'Credit Account',
  'Amount',
  'Tax Code',
] as const;

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
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Export refunds to GL format (debit/credit journal entries).
 */
export async function exportRefundsToGL(
  rows: Array<{
    refundId: string;
    orderNumber: string;
    amount: number;
    currency: string;
    status: string;
    refundSettledAt?: Date;
    refundCreatedAt: Date;
    cancellationReason: string;
  }>,
): Promise<string> {
  const salesAccount = (await getSetting('commerce.accounting.glAccountCode').catch(() => '1200')) as string;
  const refundAccount = (await getSetting('commerce.accounting.glRefundAccountCode').catch(() => '2200')) as string;
  const taxCode = (await getSetting('commerce.accounting.taxCode').catch(() => 'GST')) as string;

  const lines: string[] = [];
  lines.push(GL_COLUMNS.map(escapeCsv).join(','));

  for (const row of rows) {
    if (row.status !== 'succeeded') continue; // Only export settled refunds

    const date = formatDate(row.refundSettledAt || row.refundCreatedAt);
    const reference = `RFD-${row.refundId}`;
    const description = `Refund for order ${row.orderNumber}${row.cancellationReason ? ` - ${row.cancellationReason}` : ''}`;
    const amount = row.amount.toFixed(2);

    // Debit line: Refund Clearing (money going out of refund account)
    lines.push([date, reference, description, refundAccount, '', amount, taxCode].map(escapeCsv).join(','));
    // Credit line: Sales (reversing the original sale)
    lines.push([date, reference, description, '', salesAccount, amount, taxCode].map(escapeCsv).join(','));
  }

  return lines.join('\n');
}
