import { API } from '@pawtag/shared/api';
import api from './api';

/**
 * Open customer invoice via existing secure access endpoint.
 * Reuses OTP/token model — does not invent a parallel download path.
 *
 * Navigates in the SAME tab on purpose: the old `window.open(..., '_blank')`
 * ran after an async request, which popup blockers (Safari, Brave, strict
 * extensions) silently drop — the invoice never opened. Same-tab navigation
 * is never blocked. The API returns a RELATIVE path so this works on any
 * host (localhost, LAN IP, production domain).
 */
export async function openInvoiceSecureUrl(invoiceId: string): Promise<void> {
  const res = await api.post(API.customer.invoices.access(invoiceId));
  const secureUrl = res.data?.data?.secureUrl;
  if (!secureUrl) {
    throw new Error('Invoice access link unavailable');
  }
  window.location.assign(secureUrl);
}
