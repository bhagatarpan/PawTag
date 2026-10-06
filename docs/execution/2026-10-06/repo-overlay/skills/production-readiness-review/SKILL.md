---
name: production-readiness-review
description: Audit a PawTag feature or system for real production readiness rather than feature existence. Use when assessing launch readiness, verifying a completed work packet, reviewing provider/configuration differences, or tracing cross-layer failure modes. Requires evidence for security, persistence, integrations, retries, observability, production configuration, and end-to-end behavior.
---

# Production Readiness Review

Feature existence is not production readiness.

Trace as applicable: user action -> shared client -> middleware -> auth/authz -> validation -> service/business rules -> persistence/concurrency -> provider -> response/UI -> retry/idempotency/restart -> production-only config -> logs/audit/alerts -> automated/runtime evidence.

Actively look for development bypasses, fake/demo fallbacks, missing credentials tolerated locally, process-memory assumptions, mock-only contracts, unfinished checklists, and docs marked complete without executed proof.

Use factual states: `Ready`, `Needs work`, `MVP blocker`, `Needs validation`, `Post-MVP`. For each material finding provide evidence path/function, failure scenario, severity, action, and whether it is a current defect, near-term risk, or future-scale concern.
