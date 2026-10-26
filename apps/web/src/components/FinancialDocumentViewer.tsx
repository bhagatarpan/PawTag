import { useRef } from 'react';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { CopyButton } from '@pawtag/ui';

/**
 * Shared shell for the public token document viewers (invoice `/invoice/:token`,
 * donation receipt `/donations/receipt/:token`) — ONE toolbar, one page frame,
 * one loading/error look, so every financial document a customer opens from an
 * emailed link feels identical. The document inside is always the canonical
 * finance-engine HTML; this component only renders it in an iframe (styles
 * stay isolated from the app) and provides Print / Download actions.
 */
export interface FinancialDocumentViewerProps {
  /** Document number shown in the toolbar (e.g. INV-2026-001, DN-0001). */
  docNumber?: string;
  /** Full HTML document from the shared finance engine. */
  html: string;
  /** Token-authenticated PDF download URL — navigated same-tab (popup-safe). */
  downloadUrl: string;
}

export function FinancialDocumentViewer({ docNumber, html, downloadUrl }: FinancialDocumentViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-3 flex items-center justify-between gap-3">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium">
            <ArrowLeft size={16} /> PawTag
          </a>
          <div className="flex items-center gap-3 min-w-0">
            {docNumber && (
              <>
                <span className="text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">{docNumber}</span>
                <CopyButton text={docNumber} size={10} />
              </>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex min-h-11 items-center gap-1.5 border border-primary-600 text-primary-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-50"
            >
              <Printer size={14} /> Print
            </button>
            <button
              type="button"
              onClick={() => window.location.assign(downloadUrl)}
              className="inline-flex min-h-11 items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700"
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          title={docNumber || 'Document'}
          srcDoc={html}
          className="w-full bg-white rounded-xl border border-gray-200"
          style={{ minHeight: '70vh' }}
        />
      </div>
    </div>
  );
}

export default FinancialDocumentViewer;
