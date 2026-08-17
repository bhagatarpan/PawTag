# PawTag Enterprise Logging & Observability — Master Orchestrator

## Purpose

This document is the master execution contract for upgrading PawTag's application logging, debugging and observability without damaging the existing audit system.

The implementation must be performed **phase by phase**.

Each phase has its own `.md` execution prompt in this directory.

## Mandatory operating rules

1. Read this file before executing any phase.
2. Read the current phase `.md` file completely before coding.
3. Inspect the repository before making assumptions.
4. Preserve existing application behaviour unless the phase explicitly requires a change.
5. Preserve the existing PawTag audit subsystem. Logging is not a replacement for audit.
6. Never log secrets, credentials, tokens, passwords, private keys or sensitive personal data.
7. Do not introduce duplicate logging frameworks or parallel observability systems.
8. Prefer existing PawTag infrastructure when it is suitable.
9. Do not perform unrelated refactors.
10. Run relevant tests before completion.
11. Inspect the git diff before committing.
12. Commit exactly the work belonging to the current phase.
13. Push the phase branch/commit to GitHub.
14. Only after a successful push, update the phase `.md` file's completion section.
15. Commit the completion-marker change separately or include it in the same phase commit only if the implementation is already complete and verified.
16. Never mark a phase COMPLETE if tests fail, required validation is missing, or the push did not succeed.
17. If blocked, document the blocker in the phase file and stop rather than guessing.

## Git protocol

Before Phase 1:

- Create a safety branch from the current working state.
- Suggested branch:
  `feat/enterprise-observability`
- Record the starting commit SHA.

For each phase:

1. Pull/rebase only when safe.
2. Implement.
3. Test.
4. Review diff.
5. Commit using:

`feat(observability): phase N - <short description>`

6. Push.
7. Verify the remote branch contains the commit.
8. Update the phase completion marker.
9. Commit the marker if not already included.
10. Push again.

Never use `git push --force` unless explicitly authorised by the user.

## Phase order

1. `01-BASELINE-AND-GAP-AUDIT.md`
2. `02-CORE-STRUCTURED-LOGGER.md`
3. `03-REQUEST-CONTEXT-ERROR-HANDLING.md`
4. `04-ERROR-TAXONOMY-REDACTION.md`
5. `05-SERVICE-DATABASE-INTEGRATION-LOGGING.md`
6. `06-METRICS-AND-HEALTH.md`
7. `07-OPENTELEMETRY-TRACING.md`
8. `08-ERROR-MONITORING.md`
9. `09-LOG-AUDIT-DOCUMENTATION-CORRELATION.md`
10. `10-OPERATIONAL-REPORTING.md`
11. `11-TESTING-FAILURE-INJECTION.md`
12. `12-PRODUCTION-HARDENING-RUNBOOK.md`

## Context preservation

At the beginning of every phase, read:

- this master file
- the current phase file
- all previous phase files marked COMPLETE
- relevant `/docs` documentation
- relevant audit architecture documentation
- relevant source code

Do not assume previous phases completed merely because their files exist. Check their completion markers and git history.

## Completion marker

Every phase file ends with:

```text
STATUS: NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE
COMPLETED_AT:
COMMIT_SHA:
REMOTE_BRANCH:
TEST_RESULT:
NOTES:
```

Only change `STATUS` to `COMPLETE` after implementation, validation, commit and push are confirmed.

## Definition of enterprise-grade

The finished system should provide:

- structured logs
- consistent severity
- request/correlation/trace identifiers
- reliable error capture
- stack traces
- safe redaction
- business-operation context
- feature/workflow context
- database/external-service timing
- health/readiness signals
- metrics
- distributed tracing
- centralised error monitoring
- audit/log correlation
- human-readable operational reporting
- deterministic tests
- production configuration
- documented runbooks

The system must remain understandable, maintainable and vendor-portable.
