import api from './api';

/**
 * Download an authenticated admin endpoint's response as a real file.
 *
 * Fetches with the axios client (admin Bearer auth included) as a blob,
 * then triggers the browser's native download via a temporary anchor.
 * Replaces the old print-window flow (`window.open('')` + document.write),
 * which popup blockers silently dropped and which produced unformatted
 * output.
 */
export async function downloadAuthenticatedFile(url: string, fallbackFilename: string): Promise<void> {
  const res = await api.get(url, { responseType: 'blob' });
  const blob = res.data as Blob;
  const disposition = String(res.headers?.['content-disposition'] || '');
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the download has had time to start (Safari needs this delay)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
