# Phase 00 — Evidence Reset and Trustworthy Baseline

## Agent directive

Execute this phase only. Do not implement product features. Treat historical completion claims as hypotheses.

## Objective

Establish an indisputable current baseline of the exact repository before further work, and reset status language so future phases distinguish coded work from executed proof.

## Required skills

`work-packet-executor`, `production-readiness-review`, `testing-regression`, `feature-completeness`

## Inspect first

- `AGENTS.md`
- `README.md`
- `docs/MVP_IMPLEMENTATION_STATUS.md`
- current/legacy MVP plans under `docs/`
- `package.json`, workspace manifests, Node/pnpm constraints
- `.env.example` and environment validators
- `opencode.json`, `skills/`
- `docs/MOBILE-REAL-DEVICE-VALIDATION.md`
- CI/workflow files if present
- Docker/deployment files

## Tasks

1. Record Git branch/status and preserve existing uncommitted work.
2. Record Node/pnpm versions and workspace package versions.
3. Run the current baseline commands from repository scripts:
   - install only if needed and safe;
   - `pnpm typecheck`;
   - `pnpm lint` if supported across current packages;
   - `pnpm test:unit`;
   - `pnpm test:integration`;
   - `pnpm test:regression`;
   - `pnpm test:smoke`;
   - `pnpm build`.
4. Record exact pass/fail file/test counts. Do not copy stale counts from docs.
5. Inventory whether Playwright/browser E2E actually exists and is enforced.
6. Inventory mobile physical-device evidence. An unchecked checklist is `NOT_STARTED`, not complete.
7. Inventory current production-provider fallbacks and modes: Stripe, email, storage, shipping, push, CAPTCHA/rate limiting.
8. Create/update `docs/execution/EXECUTION_STATUS.md` using the supplied template.
9. Mark historical items `PROVEN`, `CODED_NOT_RUNTIME_VALIDATED`, `FAILED`, etc. based on evidence.
10. Produce `docs/execution/BASELINE_EVIDENCE.md` with command output summary, environment assumptions, and gaps.

## Allowed code changes

Only minimal non-product tooling/test-fixture fixes required to make the baseline executable are allowed. Do not change business behavior merely to obtain green tests. If a product defect is causing a failure, record it for the next appropriate phase.

## Acceptance gate

Phase is green when:

- repository state is captured;
- every baseline command has been executed or has an explicit reason it cannot run;
- status no longer claims unexecuted real-device/staging/provider checks are complete;
- no production behavior was weakened;
- next-phase blockers are explicit.

## Stop condition

Stop after baseline/status evidence is written. Do not start Phase 01.
