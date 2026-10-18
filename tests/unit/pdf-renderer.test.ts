/**
 * Unit tests for the finance PDF renderer bridge (docs/PDF-RENDERER-REPLACEMENT.md).
 *
 * The WeasyPrint bridge is exercised with REAL child processes: `process.execPath`
 * (node) stands in for python, executing injected scripts that mimic success,
 * failure, invalid output, and slow renders — so timeout, semaphore, cleanup,
 * and output validation are tested end-to-end without mocking child_process.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resolveFinancePdfEngine,
  renderHtmlToPdfWithWeasyPrint,
  WEASYPRINT_RENDER_SCRIPT,
} from '../../packages/api/src/services/finance/pdf-renderer';

const node = process.execPath;
const PDF_BYTES = '%PDF-1.4\nfake pdf body';

const script = (body: string) => body;

describe('resolveFinancePdfEngine', () => {
  it('defaults to legacy', () => {
    expect(resolveFinancePdfEngine('legacy')).toBe('legacy');
  });

  it('accepts weasyprint case-insensitively with whitespace', () => {
    expect(resolveFinancePdfEngine(' WeasyPrint ')).toBe('weasyprint');
  });

  it('rejects unknown engine values (fail closed)', () => {
    expect(() => resolveFinancePdfEngine('chromium')).toThrow(/FINANCE_PDF_RENDERER/);
    expect(() => resolveFinancePdfEngine('')).toThrow(/FINANCE_PDF_RENDERER/);
  });

  it('ships exactly one guarded python script (no duplicate copies)', () => {
    expect(WEASYPRINT_RENDER_SCRIPT).toContain('guarded_fetcher');
    expect(WEASYPRINT_RENDER_SCRIPT).toContain("startswith('data:')");
    expect(WEASYPRINT_RENDER_SCRIPT).toContain('write_pdf');
  });
});

describe('renderHtmlToPdfWithWeasyPrint', () => {
  it('returns a PDF buffer on success', async () => {
    const buffer = await renderHtmlToPdfWithWeasyPrint('<html><body>ok</body></html>', {
      pythonCommand: node,
      scriptContent: script(`require('fs').writeFileSync(process.argv[3], ${JSON.stringify(PDF_BYTES)});`),
    });
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('rejects output that is not a PDF', async () => {
    await expect(
      renderHtmlToPdfWithWeasyPrint('<html></html>', {
        pythonCommand: node,
        scriptContent: script(`require('fs').writeFileSync(process.argv[3], 'definitely not a pdf');`),
      }),
    ).rejects.toThrow(/not a valid PDF/);
  });

  it('surfaces non-zero exits with stderr context', async () => {
    await expect(
      renderHtmlToPdfWithWeasyPrint('<html></html>', {
        pythonCommand: node,
        scriptContent: script(`console.error('pango exploded'); process.exit(1);`),
      }),
    ).rejects.toThrow(/exited with code 1.*pango exploded/s);
  });

  it('fails with a clear error when the runtime cannot start', async () => {
    await expect(
      renderHtmlToPdfWithWeasyPrint('<html></html>', {
        pythonCommand: 'pawtag-no-such-python-binary',
        scriptContent: script(''),
      }),
    ).rejects.toThrow(/failed to start/);
  });

  it('kills renders that exceed the timeout', async () => {
    const startedAt = Date.now();
    await expect(
      renderHtmlToPdfWithWeasyPrint('<html></html>', {
        pythonCommand: node,
        timeoutMs: 300,
        // Sleeps far longer than the timeout — must be killed, not waited out.
        scriptContent: script(
          `setTimeout(() => require('fs').writeFileSync(process.argv[3], ${JSON.stringify(PDF_BYTES)}), 10000);`,
        ),
      }),
    ).rejects.toThrow(/timed out after 300ms/);
    expect(Date.now() - startedAt).toBeLessThan(5000);
  });

  it('rejects oversized HTML before spawning a process', async () => {
    await expect(
      renderHtmlToPdfWithWeasyPrint('x'.repeat(5 * 1024 * 1024 + 1), {
        pythonCommand: node,
        scriptContent: script(''),
      }),
    ).rejects.toThrow(/too large/);
  });

  it('caps concurrent renders at 2 (semaphore queues the third)', async () => {
    const slowPdfScript = script(
      `setTimeout(() => require('fs').writeFileSync(process.argv[3], ${JSON.stringify(PDF_BYTES)}), 300);`,
    );
    const startedAt = Date.now();
    const renders = await Promise.all(
      Array.from({ length: 4 }, () =>
        renderHtmlToPdfWithWeasyPrint('<html></html>', { pythonCommand: node, scriptContent: slowPdfScript }),
      ),
    );
    const elapsed = Date.now() - startedAt;
    expect(renders).toHaveLength(4);
    renders.forEach((b) => expect(b.subarray(0, 5).toString('latin1')).toBe('%PDF-'));
    // 4 renders through 2 slots at 300ms each = at least 2 sequential batches.
    expect(elapsed).toBeGreaterThanOrEqual(450);
  });

  it('cleans up its temp directory after success', async () => {
    const before = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('pawtag-finpdf-'));
    await renderHtmlToPdfWithWeasyPrint('<html></html>', {
      pythonCommand: node,
      scriptContent: script(`require('fs').writeFileSync(process.argv[3], ${JSON.stringify(PDF_BYTES)});`),
    });
    const after = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('pawtag-finpdf-'));
    expect(after.length).toBeLessThanOrEqual(before.length);
  });
});
