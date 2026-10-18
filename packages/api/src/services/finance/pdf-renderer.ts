/**
 * Finance PDF renderer — converts the canonical document HTML (the SAME
 * template the browser viewer renders) into PDF bytes.
 *
 * Why this exists: the legacy pdf-lib path redraws the HTML layout by hand,
 * which duplicates every design change and cannot reproduce gradients,
 * kerning, or SVG brand marks faithfully. This module drives an HTML-to-PDF
 * engine instead, so the template stays the single layout source
 * (docs/PDF-RENDERER-REPLACEMENT.md).
 *
 * Engine selection (`FINANCE_PDF_RENDERER`):
 * - `legacy`     — the existing pdf-lib renderer (default; rollback path).
 * - `weasyprint` — python3 + WeasyPrint child process (no browser runtime).
 *   Fails closed when explicitly configured but the runtime is missing.
 *
 * Safety invariants:
 * - The engine receives only server-generated HTML strings — never raw user
 *   input, never a URL. The bundled Python script fetches `data:` URLs only
 *   (the embedded webfont), so the renderer cannot reach the network or the
 *   local filesystem.
 * - Every render is timeout-capped and counted through a semaphore (max 2
 *   concurrent per process) so a burst of downloads cannot exhaust memory.
 *   Outcomes are logged by the caller (invoice-pdf.service.ts emits
 *   `finance.pdf.rendered` / `finance.pdf.render_failed` for System Logs).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../config';

export type FinancePdfEngine = 'legacy' | 'weasyprint';

/** Max concurrent WeasyPrint child processes per API/worker process. */
const MAX_CONCURRENT_RENDERS = 2;

/** Hard cap on the HTML handed to the engine (documents are a few hundred KB at most). */
const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** Default per-render timeout; overridable via FINANCE_PDF_RENDER_TIMEOUT_MS. */
const DEFAULT_RENDER_TIMEOUT_MS = 20_000;

/**
 * The WeasyPrint runner script, embedded as a string so it ships inside the
 * compiled dist without extra build plumbing (tsc does not copy .py files).
 * `scripts/pdf-benchmark` writes this same constant to disk for the
 * benchmark container, so there is exactly one copy of the script.
 */
export const WEASYPRINT_RENDER_SCRIPT = `import sys
from weasyprint import HTML, default_url_fetcher

MAX_INPUT_BYTES = 5 * 1024 * 1024

def guarded_fetcher(url, *args, **kwargs):
    # Documents are server-generated; the only external resource allowed is
    # the embedded webfont carried as a data: URL. Everything else (http,
    # file, ftp...) is rejected so the renderer can never reach the network
    # or the filesystem.
    if isinstance(url, str) and url.startswith('data:'):
        return default_url_fetcher(url, *args, **kwargs)
    raise ValueError('blocked by finance pdf renderer: %s' % str(url)[:120])

def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, 'rb') as fh:
        html = fh.read(MAX_INPUT_BYTES + 1)
    if len(html) > MAX_INPUT_BYTES:
        raise SystemExit('finance pdf renderer: html input too large')
    doc = HTML(string=html.decode('utf-8'), base_url='about:blank', url_fetcher=guarded_fetcher)
    pdf = doc.write_pdf()
    with open(dst, 'wb') as out:
        out.write(pdf)

if __name__ == '__main__':
    main()
`;

/** Validate the configured engine value. Throws on unknown values (fail closed). */
export function resolveFinancePdfEngine(value: string = config.financePdfRenderer): FinancePdfEngine {
  const normalized = String(value ?? 'legacy').trim().toLowerCase();
  if (normalized === 'legacy' || normalized === 'weasyprint') return normalized;
  throw new Error(
    `FINANCE_PDF_RENDERER must be "legacy" or "weasyprint" (received "${value}"). ` +
      'See docs/PDF-RENDERER-REPLACEMENT.md.',
  );
}

// ---- Concurrency semaphore --------------------------------------------------

let activeRenders = 0;
const waitingRenders: Array<() => void> = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise<void>((resolve) => waitingRenders.push(resolve));
  }
  activeRenders += 1;
}

function releaseRenderSlot(): void {
  activeRenders -= 1;
  waitingRenders.shift()?.();
}

// ---- WeasyPrint child-process bridge ---------------------------------------

export interface WeasyPrintRenderOptions {
  /** Python executable that can `import weasyprint` (FINANCE_PDF_PYTHON override). */
  pythonCommand?: string;
  timeoutMs?: number;
  /**
   * Override the guarded script body. Exists for real-process unit tests and
   * the benchmark harness; production callers always use the embedded default.
   */
  scriptContent?: string;
}

/**
 * Render canonical document HTML to PDF via a WeasyPrint child process.
 * Writes the HTML to a private temp dir, runs the guarded script, validates
 * the `%PDF-` magic bytes, and always cleans up.
 */
export async function renderHtmlToPdfWithWeasyPrint(
  html: string,
  options: WeasyPrintRenderOptions = {},
): Promise<Buffer> {
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    throw new Error('finance pdf renderer: html input too large');
  }

  const pythonCommand = options.pythonCommand || config.financePdfPython || 'python3';
  const timeoutMs = options.timeoutMs || config.financePdfRenderTimeoutMs || DEFAULT_RENDER_TIMEOUT_MS;

  await acquireRenderSlot();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pawtag-finpdf-'));
  const htmlPath = path.join(tempDir, 'document.html');
  const pdfPath = path.join(tempDir, 'document.pdf');
  const scriptPath = path.join(tempDir, 'render_guarded.py');

  try {
    fs.writeFileSync(htmlPath, html, 'utf8');
    fs.writeFileSync(scriptPath, options.scriptContent ?? WEASYPRINT_RENDER_SCRIPT, 'utf8');

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(pythonCommand, [scriptPath, htmlPath, pdfPath], {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });

      let stderr = '';
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(() =>
          reject(new Error(`finance pdf renderer: render timed out after ${timeoutMs}ms`)),
        );
      }, timeoutMs);

      child.stderr.on('data', (chunk) => {
        // Cap stderr so a pathological run cannot balloon memory; enough for diagnosis.
        if (stderr.length < 8192) stderr += String(chunk);
      });
      child.on('error', (err) => {
        finish(() =>
          reject(
            new Error(
              `finance pdf renderer: failed to start "${pythonCommand}" (${err.message}). ` +
                'Install WeasyPrint or set FINANCE_PDF_RENDERER=legacy.',
            ),
          ),
        );
      });
      child.on('close', (code) => {
        finish(() => {
          if (code !== 0) {
            reject(
              new Error(
                `finance pdf renderer: weasyprint exited with code ${code}${stderr ? ` — ${stderr.trim().slice(0, 500)}` : ''}`,
              ),
            );
            return;
          }
          let out: Buffer;
          try {
            out = fs.readFileSync(pdfPath);
          } catch {
            reject(new Error('finance pdf renderer: weasyprint produced no output file'));
            return;
          }
          if (out.length < 5 || out.subarray(0, 5).toString('latin1') !== '%PDF-') {
            reject(new Error('finance pdf renderer: output is not a valid PDF'));
            return;
          }
          resolve(out);
        });
      });
    });

    return buffer;
  } finally {
    releaseRenderSlot();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Temp cleanup is best-effort; OS reaps tmp dirs on reboot.
    }
  }
}
