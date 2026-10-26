import api from './api';
import { API } from '@pawtag/shared/api';
import { openDocumentInNewTab } from './openDocumentTab';

/**
 * Donation receipt document/PDF helpers shared by the My Donations list and
 * the donation detail page (same endpoints and semantics both surfaces used
 * before they were split across pages — no contract change).
 */

/** Opens the issued receipt HTML (shared finance-engine document) in a new tab. */
export async function openDonationReceipt(receiptId: string): Promise<void> {
  const res = await api.get(API.donations.receiptHtml(receiptId));
  const html = typeof res.data === 'string' ? res.data : res.data?.data || '';
  if (!html) throw new Error('Unable to load receipt');
  openDocumentInNewTab(html);
}

/** Fetches the server-generated receipt PDF and triggers a browser download. */
export async function downloadDonationReceiptPdf(receiptId: string, receiptNumber?: string): Promise<void> {
  const res = await api.get(API.donations.receiptDownload(receiptId), { responseType: 'blob' });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(receiptNumber || 'donation-receipt').replace(/[^\w.-]+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
