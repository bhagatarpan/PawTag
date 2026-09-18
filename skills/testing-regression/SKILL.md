---
name: testing-regression
description: Add, repair, or review PawTag automated tests and verification for bug fixes, features, and work packets. Use whenever implementation changes behavior or when deciding which unit, integration, browser E2E, mobile E2E, or manual tests are required. Optimize for protection of critical business behavior rather than test counts or superficial coverage percentages.
---

# Testing and Regression

Tests protect intended behavior, not the current implementation.

## Bug fixes

Prefer:

1. Establish evidence/reproduction.
2. Add a regression test where practical.
3. Confirm it fails for the intended reason.
4. Implement the fix.
5. Confirm the regression test passes.
6. Run affected surrounding tests.
7. Typecheck/build/lint where relevant.

Do not "fix" a failing test by changing its expectation to match incorrect new behavior.

## Choose the right layer

### Unit
Use for pure business rules, formatting, validation, state transitions, deterministic service behavior.

### Integration
Use for route + middleware + service + database contracts, auth boundaries, transaction behavior, webhook parsing, and persistence interactions.

### Browser E2E
Use when correctness crosses frontend/API/config boundaries. Critical PawTag E2E candidates include auth, pet/tag lifecycle, Finder recovery, cart/checkout/order, and enabled refund/cancellation paths.

### Mobile E2E / physical device
Use for native navigation flows; physical validation is required for QR camera, NFC, push delivery, background handling, and permissions where simulation is insufficient.

## Production-mode tests

When behavior branches on environment or provider configuration, include production-like test configuration. Development bypasses are not evidence of launch readiness.

## Coverage

Do not generate low-value tests merely to increase percentages. Prioritize critical paths, boundaries, failures, retries, concurrency, and regressions.

## Test isolation

Make fixtures deterministic. Avoid tests that depend on order, existing local data, wall-clock assumptions, external live services, or mutable shared state unless explicitly integration-tested with controlled infrastructure.
