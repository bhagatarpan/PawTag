---
name: work-packet-executor
description: Execute exactly one PawTag MVP master-plan work packet safely from inspection through verification and handoff. Use when asked to implement, execute, complete, or continue a numbered work packet or tightly scoped task from PawTag_MVP_Master_Implementation_Plan.md. Enforces scope discipline, baseline checks, risk-based testing, diff review, and an explicit stop before the next packet.
---

# Work Packet Executor

Treat `AGENTS.md` as the global authority. This skill controls execution order for one scoped packet.

## Workflow

1. Read the requested work packet in full.
2. Read relevant `AGENTS.md` sections and only the specialist skills needed for this packet.
3. Inspect current source, tests, callers, routes, schemas, config, and integrations before editing.
4. State the current behavior and the defect/change being addressed.
5. Establish a targeted baseline. Record unrelated pre-existing failures instead of fixing them opportunistically.
6. Define the smallest coherent implementation that satisfies the packet.
7. Implement only required changes and directly necessary dependencies.
8. Add or update risk-appropriate tests.
9. Run targeted tests, typecheck/build/lint as appropriate for touched code.
10. Review the final diff for security regression, duplicated logic, accidental scope expansion, debug code, and stale comments.
11. Report files changed, behavior changed, verification performed, known limitations, and manual validation still required.
12. Stop. Do not start the next work packet unless explicitly instructed.

## Scope rules

- Do not convert adjacent cleanup into implementation work.
- A dependency change is in scope only when the requested packet cannot be completed correctly without it.
- Record architectural opportunities separately.
- Do not rewrite a subsystem unless the packet or evidence requires it.
- Never weaken security, validation, ownership, privacy, idempotency, or data-integrity controls to make tests pass.

## Critical lesson: Refactor, don't rewrite

When improving existing code:

1. **NEVER rewrite from scratch** — The existing code has carefully implemented business logic. A rewrite will lose functionality.

2. **Extract incrementally** — Pull out one component/function at a time while keeping ALL business logic intact.

3. **Preserve ALL existing functionality** — Every feature must work after the change.

4. **Only improve what's broken or inconsistent** — Styling, layout, accessibility, code organization. Don't change working business logic.

5. **Verify after each extraction** — Run typecheck, build, and testing after each change.

**Example of correct approach:**
```typescript
// Step 1: Extract one component (keep all business logic in main file)
// Step 2: Verify everything still works
// Step 3: Extract another component (keep all business logic in main file)
// Step 4: Verify everything still works
// ... continue incrementally
```

**Example of WRONG approach:**
```typescript
// WRONG: Rewrote 1266-line file into new components
// Result: Lost promo codes, engraving, auto-renew, PawRewards, etc.
```

## Bug-fix protocol

Prefer:

`evidence/reproduction -> regression test -> fix -> targeted verification -> surrounding verification`

If a regression test cannot reasonably be created, explain why and provide stronger manual or integration verification.

## Completion gate

Do not say "done", "fixed", "production-ready", or equivalent unless the verification actually supports that statement. Distinguish code completion from production validation.
