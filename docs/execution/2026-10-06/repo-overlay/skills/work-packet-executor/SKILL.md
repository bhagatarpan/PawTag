---
name: work-packet-executor
description: Execute one PawTag autonomous implementation phase/work packet safely from the current execution pack. Use when the founder asks to run a numbered phase or packet. Inspect before editing, preserve scope, satisfy acceptance criteria, run required validation, record evidence, update status truthfully, then stop. Never continue into the next phase automatically unless the supplied packet explicitly authorizes it.
---

# Work Packet Executor

Follow `AGENTS.md` and the requested packet. Source/runtime behavior overrides documentation claims.

## Workflow

1. Read the packet, its dependencies, relevant skills, and current status/evidence.
2. Inspect named files plus direct callers/callees, tests, configuration, consumers, and external adapters.
3. Establish the current baseline before editing where practical.
4. State the root cause/current gap and bounded implementation approach.
5. Implement the smallest coherent cross-layer change required.
6. Add/adjust risk-appropriate regression/integration/E2E tests.
7. Run packet-required validation plus focused surrounding checks.
8. Inspect the final diff for unrelated changes, secrets, weakened controls, and stale comments/docs.
9. Update status with **executed evidence**, not optimistic checkboxes.
10. Report files changed, behavior, tests/commands/results, manual/provider validation actually performed, unresolved risk, rollback notes, and next packet. Stop.

## Evidence states

Use `PROVEN`, `CODED_NOT_RUNTIME_VALIDATED`, `BLOCKED_EXTERNAL`, `FAILED`, or `NOT_STARTED` where useful. A checklist/document being created is never proof the check was executed.

## Scope

Do not silently jump ahead, refactor unrelated architecture, migrate extra domains, or fix unrelated baseline failures unless they prevent safe verification and the packet explicitly allows it.
