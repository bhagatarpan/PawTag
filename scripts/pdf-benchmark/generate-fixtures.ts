/**
 * Phase 0/1 of docs/PDF-RENDERER-REPLACEMENT.md — generate the benchmark
 * inputs and the current-engine reference outputs:
 *
 *   out/html/*.html            canonical template, printMode (what an HTML-to-PDF engine receives)
 *   out/legacy-pdf/*.pdf       reference PDFs from the current pdf-lib engine
 *   out/render_guarded.py      the guarded WeasyPrint script (run-benchmark.sh uses it in-container)
 *   out/report.md              comparison template
 *
 * Run: pnpm pdf:benchmark   (then `bash run-benchmark.sh` on a Docker-equipped machine)
 */
import fs from 'fs';
import path from 'path';
import { renderInvoiceDocumentHtml } from '../../packages/api/src/services/finance/invoice-document-html';
import { renderInvoiceDocumentPdfLegacy } from '../../packages/api/src/services/invoice-pdf.service';
import { WEASYPRINT_RENDER_SCRIPT } from '../../packages/api/src/services/finance/pdf-renderer';
import { benchmarkFixtures } from './fixtures';

const outDir = path.join(__dirname, 'out');
const htmlDir = path.join(outDir, 'html');
const legacyDir = path.join(outDir, 'legacy-pdf');

async function main(): Promise<void> {
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.mkdirSync(legacyDir, { recursive: true });

  for (const { name, model } of benchmarkFixtures) {
    const html = renderInvoiceDocumentHtml(model, { printMode: true });
    fs.writeFileSync(path.join(htmlDir, `${name}.html`), html, 'utf8');

    const legacyPdf = await renderInvoiceDocumentPdfLegacy(model);
    fs.writeFileSync(path.join(legacyDir, `${name}.pdf`), legacyPdf);

    console.log(`${name}: html ${(html.length / 1024).toFixed(0)}KB, legacy pdf ${(legacyPdf.length / 1024).toFixed(0)}KB`);
  }

  fs.writeFileSync(path.join(outDir, 'render_guarded.py'), WEASYPRINT_RENDER_SCRIPT, 'utf8');

  fs.writeFileSync(
    path.join(outDir, 'report.md'),
    `# PDF renderer benchmark — ${new Date().toISOString()}

Compare three renderings of the SAME fixtures:
- \`html/\` — canonical template (open in a browser; this is what customers see online)
- \`legacy-pdf/\` — current pdf-lib engine (reference)
- \`pdf/\` — WeasyPrint output from \`run-benchmark.sh\`

| Fixture | Visual parity vs HTML | Gradients | SVG marks | Macrons | Pagination | Selectable text | Verdict |
|---|---|---|---|---|---|---|---|
${benchmarkFixtures.map(({ name }) => `| ${name} |  |  |  |  |  |  |  |`).join('\n')}

Gate (docs/PDF-RENDERER-REPLACEMENT.md §2): the founder reviews \`pdf/\` side-by-side
with \`html/\` and \`legacy-pdf/\`. Any fail on the template-as-is rule = WeasyPrint fails.
`,
    'utf8',
  );

  console.log(`\nBenchmark inputs ready in ${outDir}`);
  console.log('Next: run `bash run-benchmark.sh` (requires Docker) and review out/report.md.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
