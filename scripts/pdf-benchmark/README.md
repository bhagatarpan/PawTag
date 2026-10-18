# PDF renderer benchmark

Companion harness for `docs/PDF-RENDERER-REPLACEMENT.md` (Phase 0/1).
Renders the same six representative financial-document fixtures through:

1. the **canonical HTML template** (`out/html/` — open in a browser),
2. the **current pdf-lib engine** (`out/legacy-pdf/` — reference),
3. the **WeasyPrint candidate** (`out/pdf/` — the engine under test).

## Run

```bash
pnpm pdf:benchmark                        # 1) fixtures + references (no Docker needed)
cd scripts/pdf-benchmark
bash run-benchmark.sh                     # 2) WeasyPrint renders (requires Docker)
```

Then open `out/report.md` and review each PDF in `out/pdf/` side-by-side with
`out/html/` (browser) and `out/legacy-pdf/`. Record verdicts in the report —
**this review is the gate** that decides the engine
(`docs/PDF-RENDERER-REPLACEMENT.md` §2 decision tree).

Notes:

- No Docker on Windows? Docker Desktop with the WSL backend, or any Linux
  box/CI runner with Docker. Git Bash sets `MSYS_NO_PATHCONV=1` internally.
- The Gotenberg fallback leg (only if WeasyPrint fails visual gates):

  ```bash
  docker run --rm -p 3000:3000 gotenberg/chromium:latest
  curl http://localhost:3000/forms/chromium/convert/html \
    -F files=@out/html/01-shop-invoice-customer.html \
    -o out/pdf/gotenberg-01.pdf
  ```

- `out/` is gitignored — generated artifacts stay local.
- The container runs the SAME guarded render script the API embeds
  (`out/render_guarded.py`, written from `pdf-renderer.ts`), so the benchmark
  exercises the production invocation path, including the no-network fetcher.
