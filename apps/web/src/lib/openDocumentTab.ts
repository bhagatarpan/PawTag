/**
 * Open a server-rendered financial document (invoice / donation receipt HTML
 * from the shared finance engine) for the customer.
 *
 * Same-tab navigation to a blob URL — `window.open` is silently dropped by
 * popup blockers when called from async handlers (this is exactly how the
 * donation receipt View has worked since launch; invoices now match it).
 */
export function openDocumentInNewTab(html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.location.assign(url);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
