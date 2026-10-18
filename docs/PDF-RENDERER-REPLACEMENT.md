# PDF Renderer Replacement — HTML-Derived Financial Documents

**Status:** In progress (checklist at bottom)
**Branch:** `feature/pdf-renderer-html-engine`
**Origin:** Founder review (2026-10-18) — the pdf-lib hand-drawn PDF engine was not acceptable long-term: it duplicates the HTML layout, drifts on every design change, and cannot reproduce gradients, kerning, and brand marks faithfully.

---

## 1. Problem

Every financial document (commerce invoice, credit note, donation receipt) already flows through **one shared data assembly** (`finance/invoice-document.ts`) and **one canonical HTML layout** (`finance/invoice-document-html.ts`). The HTML is what customers see in the browser viewer.

The PDF path was the weak link: `invoice-pdf.service.ts` **redrew** the HTML layout by hand with pdf-lib primitives — every box, strip, and glyph manually positioned. Consequences:

- Two layouts per document, manually kept in sync — they drifted once already (fixed by `8c7f809`) and would drift again.
- No true gradient (faked with 40 strips), approximated card-brand marks, static Inter TTF with stripped kerning (`INV- 000043`-style gaps), no CSS layout engine.
- Every visual change costs double work and double QA.

## 2. Decision (founder, 2026-10-18)

> Keep the assembly + HTML template as the single layout. Replace the PDF renderer with an **HTML-to-PDF engine selected by measured benchmark**: try **WeasyPrint first** (no browser runtime, small footprint), fall back to **Gotenberg/Chromium** if visual gates fail. Keep pdf-lib only until the replacement is verified. No paid PDF services; no browser in the API image until benchmarks prove it necessary.

### Decision tree

```text
Benchmark the REAL templates (scripts/pdf-benchmark, one command, Docker)
    │
    ├─ WeasyPrint passes all visual gates ──────────► Use WeasyPrint in-API
    │   (gradient, flex header, SVG marks, fonts,       (python3 + pango; no browser)
    │    macrons, pagination, selectable text)
    │
    ├─ WeasyPrint fails a visual gate ──────────────► Benchmark Gotenberg as a
    │                                                  separate container (Chromium
    │                                                  under the hood; API image stays
    │                                                  small; HTTP multipart convert)
    │
    └─ Both fail / unverifiable ────────────────────► Stay on pdf-lib (current state)
                                                       and re-evaluate (in-API Chromium
                                                       is the remaining option)
    In ALL cases: pdf-lib remains the default renderer until the founder
    reviews benchmark output and the flag is switched. Rollback = flip the
    flag back; no data, API, or authorization changes are involved.
```

**Template rule (anti-drift):** the benchmarked HTML must pass **as-is**. The only allowed template changes are those that are safe for customer browsers and neutral-or-better for the web view (e.g. embedding Inter for deterministic output). A PDF-only CSS fork would recreate the duplicate-layout problem and is a benchmark **fail**.

## 3. Target architecture

```text
Invoice / DonationReceipt / CreditNote          (unchanged — durable records)
    ▼
finance/invoice-document.ts                     (unchanged — data assembly, channel rule)
    │  InvoiceDocumentModel
    ├──► finance/invoice-document-html.ts        ← ONE canonical layout
    │        viewer:  renderInvoiceDocumentHtml(model)            → browser
    │        pdf:     renderInvoiceDocumentHtml(model, printMode) → PDF engine
    ▼
invoice-pdf.service.ts                           (assembly + dispatch, no drawing)
    ├── FINANCE_PDF_RENDERER=legacy    → existing pdf-lib renderer (rollback path)
    └── FINANCE_PDF_RENDERER=weasyprint→ finance/pdf-renderer.ts
                                              python3 + guarded WeasyPrint script
                                              (temp-file HTML in, %PDF bytes out,
                                               timeout, concurrency cap 2, no
                                               network/file URL fetches)
```

```text
Mockup — canonical A4 document (one layout for screen AND print)
┌──────────────────────────────────────────────────────┐
│ ▓▓▓ teal gradient header (135deg) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  full-bleed
│ PawTag Limited                         INVOICE       │
│ 12 Queen St, Auckland                  WO-000507     │
│ GST: 123-456-789                       [ PAID ]      │  status pill
├──────────────────────────────────────────────────────┤
│ BILL TO        SHIP TO        INVOICE DETAILS        │  flex meta row
│ …                         Order: WO-000507           │
│                              Card: [Visa] ••••4242   │  real SVG mark
├──────────────────────────────────────────────────────┤
│ ITEM                          QTY          AMOUNT    │
│ PawTag NFC Tag                  1        $ 29.00    │
│   Engraving — Pet name: Miro              $ 10.00    │
│ ─────────────────────────────────────────────────    │
│                                    Subtotal  $39.00  │
│                                    Discount  -$5.00  │
│                                    Shipping   Free   │
│                                    GST (15%)  $5.10   │
│ ▒▒▒ mint total band, 2px teal top rule ▒▒▒▒▒▒▒▒▒▒▒▒ │
│                          Total (incl. GST)  NZD $44.10│
├──────────────────────────────────────────────────────┤
│ pawtag.co.nz · © 2026 PawTag Limited                 │  footer
└──────────────────────────────────────────────────────┘
```

Customer/admin UI is unchanged: **Download PDF** buttons continue to hit the same token/ownership-scoped endpoints and receive a real PDF attachment. Only the bytes' origin changes.

## 4. Request workflow (unchanged externally)

```text
Download PDF (customer portal / admin CSR / token link / donation email)
  → route (ownership or verified token; channel from issuedToAdmin — never a query param)
  → audit event invoice_pdf_downloaded (existing)
  → assembleInvoiceDocument(id, channel)
  → renderInvoiceDocumentHtml(model, printMode: true)
  → selected PDF engine → Buffer
  → structured log finance.pdf.rendered {renderer, kind, channel, durationMs, bytes}
  → Content-Disposition: attachment
Failure → structured log finance.pdf.render_failed (+ error)
        → route error response; document remains viewable as HTML (never falsify payment state)
```

## 5. Engine comparison (measured by the benchmark, not reputation)

| Requirement | WeasyPrint | Gotenberg (Chromium) | pdf-lib (current) |
|---|---|---|---|
| Reuses the canonical HTML/CSS | Yes | Yes | No — manual redraw |
| Gradients, flex, SVG, border-radius | Mostly — **verify** | Yes | Approximated |
| Fonts | Embedded Inter (data URI) | Embedded Inter | Embedded TTF (kerning gaps) |
| Selectable text, Unicode/macrons | Yes | Yes | Yes (Inter path) |
| Runtime footprint | python3 + pango, no browser | Separate container with browser | None (pure JS) |
| Browser in the API image | No | No (separate service) | No |
| Ops burden | Child process, timeout-capped | HTTP client to sidecar | None |
| License | BSD-3 (Kozea) | Apache-2.0 | MIT |

## 6. Business rules

1. The **canonical layout is the HTML template** — one layout source; PDFs are generated *from* it, never beside it.
2. The legacy pdf-lib renderer remains available and is the default until the founder signs off on benchmark output; switching engines is a config flip (`FINANCE_PDF_RENDERER`), never a code change.
3. Customer documents never contain Stripe provider IDs in either engine (channel rule unchanged — enforced in assembly, both renderers consume the same model).
4. The PDF renderer receives only server-generated HTML strings. It must not fetch external URLs or local files (WeasyPrint runs with a guarded fetcher that allows `data:` only — the embedded font).
5. Renderer failures never falsify payment state: the document record is unchanged; the customer can still view the HTML; the route returns a clean error.
6. Renders are bounded: 20s timeout, max 2 concurrent renders per process.
7. Every render (success or failure) emits a structured log with renderer, document kind, channel, duration, and size — visible in System Logs; downloads remain audit-logged.

## 7. Observability (System Logs + Audit)

| Signal | Where | Event |
|---|---|---|
| PDF download (who/what/when) | Audit log (existing) | `invoice_pdf_downloaded` (customer + admin channels) |
| Render outcome + engine + latency + size | System Logs (pino → log-writer) | `finance.pdf.rendered` / `finance.pdf.render_failed` |
| Engine fallback / misconfiguration | System Logs | `finance.pdf.renderer_error` (warn/error) |

Admin can inspect renders under **Admin → System Logs**; downloads under the audit surfaces.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| WeasyPrint mishandles flex/SVG → visual regression | Benchmark gate before any default change; template passes as-is; founder reviews output |
| WeasyPrint absent on a dev machine | Default renderer stays `legacy`; explicit `weasyprint` config with a missing binary fails closed with a clear error (no silent fallback) |
| RenderDoS / memory blowup from concurrent renders | Semaphore (max 2), 20s timeout, temp files cleaned in `finally` |
| Renderer fetches remote content from document data | Guarded fetcher allows only `data:` (WeasyPrint ≥70 protocol allow-list; verified `https`/`file` blocked); HTML is server-generated; no user-supplied HTML reaches the engine |
| Engine fails silently on long documents | The legacy engine has a single-page guard that **silently drops items beyond page 1** (pre-existing defect, confirmed in the benchmark: 18-item fixture → 3 pages on WeasyPrint, dropped on legacy). The HTML-derived engine paginates correctly; a reason in itself to complete the migration. |
| Alpine package gaps (no `py3-weasyprint` in apk) | Benchmark image builds WeasyPrint from pip in a multi-stage Docker build; production containerization happens only after gate sign-off |
| Font determinism across machines | printMode embeds Inter as base64 `@font-face`; fallback to system stack is logged visually identical for DejaVu-covered glyphs |

## 9. Implementation checklist

- [x] **Phase 0 — Baseline & fixtures** (`PROVEN`): deterministic fixture models for 6 representative documents (shop invoice w/ engraving + card, admin invoice w/ Stripe IDs, credit note w/ refund destination, donation receipt w/ tax notes, many-line-item 2-page case, macron-heavy NZ addresses) + reference PDFs from the current pdf-lib engine; baseline recorded here.
  - Baseline (2026-10-18, dev machine): API image not built locally (no Docker); pdf-lib reference PDFs generated for all 6 fixtures via `pnpm pdf:benchmark`.
- [x] **Phase 1 — Benchmark harness** (`PROVEN` for the WeasyPrint leg on Windows; Docker container leg remains for image-recipe validation): `scripts/pdf-benchmark/` renders every fixture through the guarded script in one command, times each render, writes `out/report.md` next to the pdf-lib references for side-by-side review. WeasyPrint 70.0 leg executed 2026-10-18 on the dev machine (Python 3.12 + MSYS2 pango): all 6 fixtures rendered in ~1.0–1.2s each, 19–22KB, selectable text, macrons intact, multi-page case paginates to 3 pages (the legacy engine silently drops items past page 1). The **gate is the founder's visual review of `out/`** — pending.
- [x] **Phase 2 — Renderer service** (`PROVEN`: selection/timeout/semaphore/output-validation via unit tests with real child processes; dispatch + fail-closed runtime proven by direct execution — WeasyPrint invocation itself `CODED_NOT_RUNTIME_VALIDATED`): `finance/pdf-renderer.ts` + `FINANCE_PDF_RENDERER`/`FINANCE_PDF_PYTHON`/`FINANCE_PDF_RENDER_TIMEOUT_MS` config; `invoice-pdf.service.ts` reduced to assembly + dispatch with structured render logs (pdf-lib path untouched behind `legacy`, exported as `renderInvoiceDocumentPdfLegacy` for the benchmark).
- [x] **Phase 3 — Template hardening** (`PROVEN` — unit tests): `printMode` embeds Inter (base64 @font-face) for deterministic PDF typography; `@page` A4 + page-break rules added (benefits browser print too); SVG text inherits the document font instead of hardcoding `system-ui`. Viewer mode unchanged and still lightweight (no font payload).
- [x] **Phase 4 — Tests & monitoring** (`PROVEN`): 20 new unit tests (renderer bridge with real node child processes: success/invalid-output/non-zero-exit/missing-runtime/timeout/oversize/semaphore/temp-cleanup; template print/viewer modes + macrons + channel rule); full unit suite 1111/1111 pass; API typecheck, ESLint (0 errors), and build clean; `finance.pdf.rendered` / `finance.pdf.render_failed` events verified in the pino → log-writer → SystemLogs pipeline by direct execution; downloads remain audit-logged (`invoice_pdf_downloaded`). Route-level integration suites (invoice access/card display/donation receipt) require the local dev MongoDB — not runnable in the execution environment; they exercise unchanged routes.
- [ ] **Phase 5 — Gate & rollout** (`PARTIALLY UNBLOCKED — renders exist, founder review pending`): WeasyPrint renders for all 6 fixtures are generated in `scripts/pdf-benchmark/out/pdf/` (Windows local leg). **Founder dev machine provisioned 2026-10-19:** `packages/api/.env.local` switched to `FINANCE_PDF_RENDERER=weasyprint` (python3.12 + MSYS2 pango; `C:\msys64\mingw64\bin` added to the Windows user PATH so no terminal setup is needed) — config resolution + real dispatch verified from a fresh terminal (`renderer: weasyprint`, ~17KB valid PDF, ~1.2s). Note: earlier "icon unchanged" founder feedback was traced to downloads still served by the legacy engine (334KB files — the env switch had not been applied yet). Remaining: founder re-downloads INV-000044 (expect ~20KB + small 21×14 badge) and records overall verdicts in `out/report.md`; then validate the container recipe via `run-benchmark.sh` (Docker), add the measured WeasyPrint layer to `docker/Dockerfile.api`, flip the default, bake, then delete the pdf-lib renderer + update docs. On visual failure, run the Gotenberg leg (README of the harness).

## 10. Benchmark harness (Phase 1 usage)

```bash
pnpm pdf:benchmark          # generate fixture HTML + pdf-lib reference PDFs → scripts/pdf-benchmark/out/
cd scripts/pdf-benchmark && bash run-benchmark.sh   # requires Docker: renders out/html/*.html via WeasyPrint → out/pdf/, writes out/report.md
```

Review: open each `out/pdf/*.pdf` next to `out/html/*.html` (browser) and `out/legacy-pdf/*.pdf` (current engine). The checklist in §2 decides.

## 11. Verification evidence (2026-10-18, execution machine: Windows — no Docker/Python/MongoDB)

| Check | Result |
|---|---|
| `pnpm vitest run tests/unit/pdf-renderer.test.ts tests/unit/invoice-document-html-print.test.ts` | **PASS** 20/20 |
| `pnpm test:unit` (full unit suite) | **PASS** 1111/1111 (107 files) |
| `pnpm --filter @pawtag/api typecheck` / `lint` / `build:api` | **PASS** (0 lint errors; 910 pre-existing `no-explicit-any` warnings untouched) |
| `pnpm pdf:benchmark` (Phase 0 harness) | **PASS** — 6 printMode HTML fixtures + 6 valid `%PDF-1.7` legacy references + guarded script exported |
| Dispatcher run (legacy default, direct execution) | **PASS** — `%PDF-` buffer; `finance.pdf.rendered {renderer: legacy, …bytes, durationMs}` logged |
| Fail-closed run (`FINANCE_PDF_RENDERER=weasyprint`, runtime missing) | **PASS** — actionable error + `finance.pdf.render_failed {renderer: weasyprint}` logged; no silent fallback |
| Render logs visible in SystemLogs pipeline | **PROVEN** — pino → log-writer → `SystemLog` collection (Admin → System Logs); downloads audited (`invoice_pdf_downloaded`) |
| Route-level integration suites (invoice access/card display/donation receipt download) | **NOT RUN here** — no local MongoDB in the execution environment; routes unchanged, dispatch covered by unit + direct-execution evidence |
| WeasyPrint end-to-end render (Windows local leg, 2026-10-18) | **PASS** — WeasyPrint 70.0 via Python 3.12 + MSYS2 pango; all 6 fixtures rendered with the guarded script (~1.0–1.2s, 19–22KB); selectable text; macrons intact; `https`/`file` fetches blocked by the protocol allow-list; multi-page fixture paginates to 3 pages |
| WeasyPrint container leg (`run-benchmark.sh`) | **NOT RUN** — no Docker on this machine; recipe simplified (no PyGObject needed for v70) and pinned `weasyprint~=70.0` |
| Founder visual gate review of `out/` | **PENDING** — results table ready in `scripts/pdf-benchmark/out/report.md` |
