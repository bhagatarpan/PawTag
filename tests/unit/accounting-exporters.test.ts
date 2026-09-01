import { describe, it, expect } from 'vitest';
import { exportRefundsToCsv } from '../../packages/api/src/integrations/accounting/csvExporter';
import type { RefundExportRow } from '../../packages/api/src/integrations/accounting/csvExporter';

describe('csvExporter', () => {
  const sampleRows: RefundExportRow[] = [
    {
      refundId: 're_123',
      orderId: 'order_1',
      orderNumber: 'PT-000001',
      customerName: 'Sarah Johnson',
      customerEmail: 'sarah@example.com',
      amount: 59.99,
      currency: 'NZD',
      status: 'succeeded',
      arn: '360720276453321',
      initiatedBy: 'customer',
      cancelledBy: 'Customer (Sarah Johnson)',
      cancellationReason: 'Ordered by mistake',
      refundSettledAt: new Date('2026-09-01T14:00:00Z'),
      refundCreatedAt: new Date('2026-09-01T13:00:00Z'),
      paymentIntentId: 'pi_abc123',
    },
  ];

  it('produces a header row in full mode', async () => {
    const csv = await exportRefundsToCsv(sampleRows, { mode: 'full' });
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('Date');
    expect(firstLine).toContain('Order Number');
    expect(firstLine).toContain('Refund ID');
    expect(firstLine).toContain('ARN');
  });

  it('produces Xero-compatible columns in xero mode', async () => {
    const csv = await exportRefundsToCsv(sampleRows, { mode: 'xero' });
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('Date,Reference,Description,Amount');
  });

  it('formats dates as YYYY-MM-DD', async () => {
    const csv = await exportRefundsToCsv(sampleRows, { mode: 'xero' });
    expect(csv).toContain('2026-09-01');
  });

  it('formats amount with negative sign in xero mode', async () => {
    const csv = await exportRefundsToCsv(sampleRows, { mode: 'xero' });
    expect(csv).toContain('-59.99');
  });

  it('respects custom columns in configurable mode', async () => {
    const csv = await exportRefundsToCsv(sampleRows, {
      mode: 'configurable',
      customColumns: ['Date', 'Order Number', 'Amount'],
    });
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('Date,Order Number,Amount');
  });

  it('escapes commas and quotes in values', async () => {
    const rows: RefundExportRow[] = [{
      ...sampleRows[0],
      cancellationReason: 'Item, not as "described"',
    }];
    const csv = await exportRefundsToCsv(rows, { mode: 'full' });
    expect(csv).toContain('"Item, not as ""described"""');
  });

  it('produces correct row count', async () => {
    const csv = await exportRefundsToCsv(sampleRows, { mode: 'full' });
    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // 1 header + 1 data row
  });
});
