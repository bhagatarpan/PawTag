import { renderBase, renderDataTable, renderCtaButton } from './base';

interface FulfilmentAlertData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: string;
  total: number;
  fulfilmentId: string;
  autoTagCreated: boolean;
}

export function renderFulfilmentAlertEmail(data: FulfilmentAlertData): string {
  const { orderNumber, customerName, customerEmail, items, total, fulfilmentId, autoTagCreated } = data;

  const tagMode = autoTagCreated
    ? 'Tag IDs have been auto-generated and are ready for NFC writing.'
    : 'Tag IDs need to be assigned manually during packing.';

  const bodyHtml = `
    <h2 style="color:#374151;font-size:20px;font-weight:700;margin:0 0 16px;">New Fulfilment: ${orderNumber}</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">A new order has been confirmed and fulfilment is ready for warehouse processing.</p>
    ${renderDataTable([
      { label: 'Order Number', value: orderNumber },
      { label: 'Customer', value: `${customerName} (${customerEmail})` },
      { label: 'Items', value: items },
      { label: 'Total', value: `$${total.toFixed(2)}` },
      { label: 'Tag Mode', value: tagMode },
    ])}
    <div style="margin-top:24px;">
      ${renderCtaButton(`${process.env.ADMIN_URL || 'http://localhost:3001'}/fulfilments`, 'Open Fulfilment Queue')}
    </div>
  `;

  return renderBase({ title: `Fulfilment Ready: ${orderNumber}`, subtitle: 'Warehouse Notification', bodyHtml, theme: 'default' });
}
