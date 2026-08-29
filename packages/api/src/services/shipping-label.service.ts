/**
 * @module Shipping Label Service
 * @description Generates HTML shipping labels for printing.
 *
 * Follows the same pattern as invoice-html.service.ts — generates
 * clean, printable HTML that can be opened in a new browser tab
 * and printed. No PDF library required.
 *
 * Usage:
 * ```typescript
 * import { generateShippingLabelHtml } from '../services/shipping-label.service';
 * const html = await generateShippingLabelHtml(shipmentId);
 * ```
 */

import { Shipment, Setting, Order } from '@pawtag/db';
import logger from '../lib/logger';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getCompanySettings(): Promise<Record<string, string>> {
  const keys = ['company.name', 'company.address', 'company.phone', 'company.email'];
  const settings = await Setting.find({ key: { $in: keys } }).lean();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return map;
}

/**
 * Generate a printable HTML shipping label for a shipment.
 *
 * @param shipmentId - Shipment document ID
 * @returns HTML string ready for printing
 */
export async function generateShippingLabelHtml(shipmentId: string): Promise<string> {
  const shipment = await Shipment.findById(shipmentId).lean();
  if (!shipment) {
    throw new Error('Shipment not found');
  }

  const order = await Order.findById(shipment.orderId).lean();
  const company = await getCompanySettings();

  const companyName = company['company.name'] || 'PawTag Ltd';
  const companyAddress = company['company.address'] || '';
  const companyPhone = company['company.phone'] || '';

  const fromAddress = `
    <strong>${escapeHtml(companyName)}</strong><br>
    ${escapeHtml(companyAddress)}<br>
    ${companyPhone ? escapeHtml(companyPhone) : ''}
  `.trim();

  const toAddress = `
    <strong>SHIP TO:</strong><br>
    ${escapeHtml(shipment.shippingAddress.line1)}<br>
    ${shipment.shippingAddress.line2 ? escapeHtml(shipment.shippingAddress.line2) + '<br>' : ''}
    ${escapeHtml(shipment.shippingAddress.city)}, ${escapeHtml(shipment.shippingAddress.state)} ${escapeHtml(shipment.shippingAddress.zip)}<br>
    ${escapeHtml(shipment.shippingAddress.country || 'NZ')}
  `.trim();

  const itemCount = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
  const itemList = shipment.items
    .map((item) => `${escapeHtml(item.productName)} × ${item.quantity}`)
    .join('<br>');

  const orderNumber = shipment.orderNumber || (order as any)?.orderNumber || 'N/A';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shipping Label - ${escapeHtml(shipment.trackingNumber)}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      color: #111;
    }
    .label {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      border: 2px solid #111;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .header-left h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header-left .order {
      font-size: 13px;
      color: #555;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
    }
    .carrier {
      font-size: 14px;
      font-weight: 600;
      color: #0d9488;
    }
    .tracking {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: 700;
      margin-top: 4px;
    }
    .addresses {
      display: flex;
      gap: 20px;
      margin-bottom: 16px;
    }
    .address-box {
      flex: 1;
      padding: 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    }
    .items {
      margin-bottom: 16px;
      font-size: 13px;
    }
    .items-title {
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    .footer {
      border-top: 1px dashed #ccc;
      padding-top: 8px;
      font-size: 11px;
      color: #888;
      text-align: center;
    }
    .print-btn {
      display: block;
      margin: 20px auto;
      padding: 10px 24px;
      background: #0d9488;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    .print-btn:hover { background: #0f766e; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">Print Label</button>
  </div>

  <div class="label">
    <div class="header">
      <div class="header-left">
        <h1>${escapeHtml(companyName)}</h1>
        <div class="order">Order: ${escapeHtml(orderNumber)}</div>
      </div>
      <div class="header-right">
        <div class="carrier">${escapeHtml(shipment.carrier)}</div>
        <div class="tracking">${escapeHtml(shipment.trackingNumber)}</div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-box">
        <div style="font-weight:600;font-size:11px;text-transform:uppercase;color:#666;margin-bottom:4px;">FROM</div>
        ${fromAddress}
      </div>
      <div class="address-box">
        ${toAddress}
      </div>
    </div>

    <div class="items">
      <div class="items-title">Items (${itemCount} total)</div>
      ${itemList}
    </div>

    <div class="footer">
      PawTag — ${escapeHtml(shipment.trackingNumber)}
      ${shipment.shippedAt ? ' — Shipped: ' + new Date(shipment.shippedAt).toLocaleDateString('en-NZ') : ''}
    </div>
  </div>

  <div class="no-print">
    <button class="print-btn" onclick="window.print()">Print Label</button>
  </div>
</body>
</html>`;
}
