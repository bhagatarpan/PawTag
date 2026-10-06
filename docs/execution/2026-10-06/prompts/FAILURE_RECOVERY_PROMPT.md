# Copy/Paste Prompt — Agent Hit a Failure or Blocker

The current phase encountered a failure/blocker.

Do not jump to later phases and do not disable tests/safety checks.

Perform a root-cause recovery pass:

1. Reproduce the failure with the narrowest command.
2. Determine whether it is pre-existing or introduced by this phase.
3. Trace the real contract across caller -> API/middleware -> service -> persistence/provider -> consumer.
4. If the issue is in scope, fix the underlying cause with the smallest coherent change and add a regression test.
5. If the issue is unrelated and does not block safe verification, record it and leave it alone.
6. If it is a genuine external blocker, mark `BLOCKED_EXTERNAL`, state exactly what the founder must obtain/decide, and leave the repository in a safe state.
7. Re-run the phase gate and report evidence.
8. Stop.
