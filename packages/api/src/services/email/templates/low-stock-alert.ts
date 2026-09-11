import { renderBase, renderDataTable } from './base';

interface LowStockProduct {
  name: string;
  sku: string;
  stock: number;
  price: number;
}

interface LowStockAlertData {
  threshold: number;
  products: LowStockProduct[];
}

export function renderLowStockAlertEmail(data: LowStockAlertData): string {
  const productRows = data.products.map((p) => ({
    label: `${p.name} (${p.sku})`,
    value: `${p.stock} units — $${p.price.toFixed(2)}`,
  }));

  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      The following products are below the stock threshold of <strong>${data.threshold} units</strong>:
    </p>
    ${renderDataTable(productRows)}
    <p style="color:#6b7280;font-size:13px;margin:20px 0 0;">
      This is an automated alert from the PawTag inventory system.
    </p>
  `;

  return renderBase({
    title: `Low Stock Alert — ${data.products.length} Product${data.products.length !== 1 ? 's' : ''}`,
    subtitle: 'Inventory Notification',
    bodyHtml,
    theme: 'warning',
  });
}
