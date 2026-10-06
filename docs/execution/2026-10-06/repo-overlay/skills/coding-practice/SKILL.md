---
name: coding-practice
description: Apply PawTag code-quality practices during implementation and review. Use for refactors, duplicated logic, TypeScript safety, React patterns, async code, naming, abstractions, dead code, comments, dependency choices, or when AI-generated code looks plausible but inconsistent. Favor maintainability and explicit domain rules without premature abstraction or unrelated cleanup.
---

# Coding Practice

`AGENTS.md` is the global authority.

## Optimize for clarity of domain behavior

Avoid duplicated **knowledge and business rules**. Small local duplication is acceptable when extracting an abstraction would increase coupling, obscure intent, or combine concepts that only look similar.

Do not create generic factories/providers/managers merely to satisfy DRY.

## Type safety

- Treat `any`, double assertions, and broad casts as boundary exceptions, not escape hatches.
- Fix incompatible contracts instead of hiding them with `as any`.
- Narrow unknown external data through validation.
- Handle nullable/optional states intentionally.

## Functions/components

- Split giant functions/components by cohesive responsibility when the touched behavior is hard to reason about or test.
- Do not split code into tiny wrappers that add no semantic value.
- Keep side effects visible.
- Prefer explicit state transitions over boolean combinations that can represent impossible states.

## Async/concurrency

- Await required work.
- Do not swallow promise rejections.
- Distinguish fire-and-forget analytics from required business state.
- Avoid read-modify-write for concurrency-sensitive operations.

## React

- Keep effects for synchronization/side effects, not derived state that can be computed during render.
- Check effect dependencies honestly.
- Avoid contexts that become global dumping grounds.
- Do not memoize reflexively without evidence.

## Comments

Comments explain non-obvious why/constraints. They must not assert facts contradicted by code. Treat comments that justify weakened safety as hypotheses to verify, not authority.

## Dependencies

Use existing dependencies when appropriate. Add a dependency only when it materially improves correctness/maintenance versus a small local implementation. Avoid framework migration as incidental work.

## AI-generated smell check

Actively look for duplicated implementations, almost-identical components, frontend-only enforcement, fake/demo production fallbacks, stale TODOs, over-defensive wrappers, giant files, inconsistent naming, happy-path-only behavior, and abstractions that do not reduce complexity.
