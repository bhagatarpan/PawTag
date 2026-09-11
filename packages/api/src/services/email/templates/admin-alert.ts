import { renderBase, renderDataTable, type EmailTheme } from './base';

interface AdminAlertData {
  title: string;
  message: string;
  data: Array<{ label: string; value: string }>;
  theme?: EmailTheme;
}

export function renderAdminAlertEmail({ title, message, data, theme = 'default' }: AdminAlertData): string {
  const bodyHtml = `
    <h2 style="color:#374151;font-size:20px;font-weight:700;margin:0 0 16px;">${title}</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">${message}</p>
    ${data.length > 0 ? renderDataTable(data) : ''}
  `;

  return renderBase({ title, subtitle: 'Admin Notification', bodyHtml, theme });
}

export function renderNewOrderAlertEmail(orderNumber: string, customerName: string, customerEmail: string, total: number): string {
  return renderAdminAlertEmail({
    title: `New Order: ${orderNumber}`,
    message: `A new order has been placed and requires processing.`,
    data: [
      { label: 'Order Number', value: orderNumber },
      { label: 'Customer', value: customerName },
      { label: 'Email', value: customerEmail },
      { label: 'Total', value: `$${total.toFixed(2)}` },
    ],
  });
}

export function renderOrderCancelledAlertEmail(orderNumber: string, customerName: string, customerEmail: string, amount: number, reason?: string): string {
  return renderAdminAlertEmail({
    title: `Order Cancelled: ${orderNumber}`,
    message: `An order has been cancelled${reason ? `: ${reason}` : ''}.`,
    data: [
      { label: 'Order Number', value: orderNumber },
      { label: 'Customer', value: customerName },
      { label: 'Email', value: customerEmail },
      { label: 'Amount', value: `$${amount.toFixed(2)}` },
      ...(reason ? [{ label: 'Reason', value: reason }] : []),
    ],
  });
}

export function renderRefundFailedAlertEmail(orderNumber: string, refundId: string, amount: number, currency: string, failureReason: string, customerName: string, customerEmail: string, retryInfo: string): string {
  return renderAdminAlertEmail({
    title: `[ACTION REQUIRED] Refund Failed: ${orderNumber}`,
    message: `A refund has failed and requires attention.`,
    data: [
      { label: 'Order Number', value: orderNumber },
      { label: 'Refund ID', value: refundId },
      { label: 'Amount', value: `${currency} ${amount.toFixed(2)}` },
      { label: 'Failure Reason', value: failureReason },
      { label: 'Customer', value: customerName },
      { label: 'Email', value: customerEmail },
      { label: 'Retry Info', value: retryInfo },
    ],
    theme: 'danger',
  });
}

export function renderSupportRequestAlertEmail(name: string, email: string, message: string, requestId: string): string {
  return renderAdminAlertEmail({
    title: `New Support Request`,
    message: `A new support message has been received.`,
    data: [
      { label: 'Name', value: name },
      { label: 'Email', value: email },
      { label: 'Message', value: message },
      { label: 'Request ID', value: requestId },
    ],
  });
}
