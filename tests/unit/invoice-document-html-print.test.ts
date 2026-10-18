/**
 * Template hardening tests for the canonical financial-document layout
 * (docs/PDF-RENDERER-REPLACEMENT.md Phase 3): printMode must be
 * self-contained for headless PDF engines (embedded Inter, A4 @page rules)
 * while the browser viewer stays light (no base64 payloads).
 */
import { describe, it, expect } from 'vitest';
import {
  renderInvoiceDocumentHtml,
} from '../../packages/api/src/services/finance/invoice-document-html';
import type { InvoiceDocumentModel } from '../../packages/api/src/services/finance/invoice-document';

const model: InvoiceDocumentModel = {
  kind: 'invoice',
  number: 'INV-000042',
  title: 'INVOICE',
  status: 'paid',
  issuedAt: '2026-10-14',
  amount: 44.1,
  currency: 'NZD',
  company: {
    name: 'PawTag Limited',
    address: '12 Queen Street, Ōtāuhou, Auckland',
    phone: '+64 9 555 0100',
    email: 'hello@pawtag.co.nz',
    gst: 'GST 123-456-789',
    website: 'pawtag.co.nz',
  },
  customer: {
    name: 'Aroha Ngata',
    email: 'aroha@example.com',
    addressLines: ['47 Rimu Road', 'Tāmaki Makaurau'],
  },
  orderNumber: 'WO-000507',
  items: [{ name: 'PawTag NFC Pet Tag', subtitles: ['Engraving: Miro'], quantity: 1, lineTotal: 29 }],
  totals: { subtotal: 29, shipping: 0, tax: 3.78, taxLabel: 'GST (15%)' },
  payment: { method: 'Card', cardBrand: 'visa', cardLast4: '4242' },
  notes: [],
  channel: 'customer',
};

describe('renderInvoiceDocumentHtml — printMode (PDF engine input)', () => {
  const html = renderInvoiceDocumentHtml(model, { printMode: true });

  it('embeds Inter as base64 @font-face for deterministic engine typography', () => {
    expect(html).toContain('@font-face');
    expect(html).toContain("font-family:'Inter'");
    expect(html).toContain('base64,');
    expect(html).toContain("format('truetype')");
    expect(html).toMatch(/body \{ font-family: 'Inter', system-ui/);
  });

  it('declares the A4 page and pagination rules', () => {
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('break-inside: avoid');
  });

  it('keeps macrons intact end-to-end', () => {
    expect(html).toContain('Ōtāuhou');
    expect(html).toContain('Tāmaki Makaurau');
  });

  it('keeps the channel rule — no provider IDs on the customer channel', () => {
    expect(html).not.toContain('pi_');
    expect(html).not.toContain('stripePaymentIntentId');
  });
});

describe('renderInvoiceDocumentHtml — viewer mode (browser)', () => {
  const html = renderInvoiceDocumentHtml(model);

  it('stays light: no embedded font payload', () => {
    expect(html).not.toContain('@font-face');
    expect(html).not.toContain('base64,');
  });

  it('uses the OS font stack and keeps the responsive viewport', () => {
    expect(html).toMatch(/body \{ font-family: system-ui/);
    expect(html).toContain('width=device-width');
  });

  it('still ships the shared print rules (browser print benefits too)', () => {
    expect(html).toContain('@page { size: A4; margin: 0; }');
  });
});

describe('SVG card-brand marks (both modes)', () => {
  it('inherits the document font instead of hardcoding system-ui', () => {
    const amexModel: InvoiceDocumentModel = {
      ...model,
      payment: { method: 'Card', cardBrand: 'amex', cardLast4: '1005' },
    };
    for (const doc of [model, amexModel]) {
      for (const mode of [{ printMode: true }, {}]) {
        const html = renderInvoiceDocumentHtml(doc, mode);
        expect(html).not.toContain('font-family="system-ui');
      }
    }
    expect(renderInvoiceDocumentHtml(model)).toContain('>VISA</text>');
    expect(renderInvoiceDocumentHtml(amexModel)).toContain('>AMEX</text>');
  });

  it('sizes card marks per mode: web keeps 28×18; printMode uses a smaller, nudged mark', () => {
    // Regression/refinement: the founder visual gate found the web-sized
    // badge reads oversized and sits high in PDF zoom (2026-10-19). Both
    // modes declare CSS px dimensions inline (style wins in browsers and
    // WeasyPrint) so the box cannot fall back to engine defaults.
    const viewerStyles = (renderInvoiceDocumentHtml(model).match(/<svg [^>]*style="[^"]*"/g) || []);
    const printStyles = (renderInvoiceDocumentHtml(model, { printMode: true }).match(/<svg [^>]*style="[^"]*"/g) || []);
    expect(viewerStyles.length).toBeGreaterThanOrEqual(1);
    expect(printStyles.length).toBeGreaterThanOrEqual(1);
    for (const tag of viewerStyles) {
      expect(tag).toContain('width:28px;height:18px');
      expect(tag).toContain('vertical-align:middle');
    }
    for (const tag of printStyles) {
      expect(tag).toContain('width:24px;height:16px');
      expect(tag).toContain('vertical-align:-3px');
    }
  });
});
