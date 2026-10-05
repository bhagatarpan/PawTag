import { API } from '@pawtag/shared/api';
import api from './api';

/**
 * Open customer invoice via existing secure access endpoint.
 * Reuses OTP/token model — does not invent a parallel download path.
 */
export async function openInvoiceSecureUrl(invoiceId: string): Promise<void> {
  const res = await api.post(API.customer.invoices.access(invoiceId));
  const secureUrl = res.data?.data?.secureUrl;
  if (!secureUrl) {
    throw new Error('Invoice access link unavailable');
  }
  window.open(secureUrl, '_blank');
}
