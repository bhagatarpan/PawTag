#!/usr/bin/env bash
# Phase 1 of docs/PDF-RENDERER-REPLACEMENT.md — render every fixture through
# the WeasyPrint candidate image and place the PDFs next to the pdf-lib
# references for side-by-side founder review.
#
# Prerequisites: Docker + `pnpm pdf:benchmark` already run (creates out/html).
# Windows/Git Bash: run with MSYS_NO_PATHCONV=1 (exported below defensively).
set -euo pipefail
export MSYS_NO_PATHCONV=1 2>/dev/null || true
cd "$(dirname "$0")"

[ -d out/html ] || { echo "out/html missing — run 'pnpm pdf:benchmark' first."; exit 1; }
[ -f out/render_guarded.py ] || { echo "out/render_guarded.py missing — run 'pnpm pdf:benchmark' first."; exit 1; }
mkdir -p out/pdf

echo "Building the WeasyPrint benchmark image (first run takes a few minutes)..."
docker build -q -t pawtag-pdf-bench:weasyprint -f Dockerfile.weasyprint . >/dev/null

echo "Rendering fixtures..."
for f in out/html/*.html; do
  name="$(basename "$f" .html)"
  t0=$(date +%s%3N 2>/dev/null || date +%s)
  docker run --rm \
    -v "$PWD/out/html:/in:ro" \
    -v "$PWD/out/pdf:/out" \
    -v "$PWD/out/render_guarded.py:/opt/render_guarded.py:ro" \
    pawtag-pdf-bench:weasyprint /opt/render_guarded.py "/in/$name.html" "/out/$name.pdf"
  t1=$(date +%s%3N 2>/dev/null || date +%s)
  size=$(wc -c < "out/pdf/$name.pdf" | tr -d ' ')
  echo "  $name: $((t1 - t0)) ms, ${size} bytes"
done

echo ""
echo "Done. Review side by side:"
echo "  out/html/        canonical template (open in a browser)"
echo "  out/legacy-pdf/  current pdf-lib engine"
echo "  out/pdf/         WeasyPrint candidate"
echo "Record verdicts in out/report.md — this is the founder gate."
