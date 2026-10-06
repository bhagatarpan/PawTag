# Copy/Paste Prompt — Review a Completed Phase Before Moving On

Review the just-completed PawTag phase as an independent senior reviewer.

Do not implement the next phase.

1. Read the phase specification and `AGENTS.md`.
2. Inspect the actual diff/current source and tests.
3. Verify every acceptance criterion against evidence, not the agent's summary.
4. Look specifically for weakened security checks, `as any`/casts hiding contract problems, swallowed errors, fake/demo fallbacks, incomplete cross-layer wiring, stale docs, tests that merely changed expectations to match broken code, and missing failure/idempotency paths.
5. Re-run the most important focused tests where practical.
6. Classify the phase: `GREEN`, `GREEN_WITH_VALIDATION_PENDING`, or `BLOCKED`.
7. If blocked, provide the smallest repair list and do not start the next phase.
8. If green, update the execution status evidence and stop.
