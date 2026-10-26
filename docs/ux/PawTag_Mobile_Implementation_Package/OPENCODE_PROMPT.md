# OpenCode Prompt — PawTag Shared Mobile Experience

You are the autonomous implementation agent working in the PawTag repository. Implement the customer and Finder mobile experience using the existing shared web application as the source of truth. Follow the attached `IMPLEMENTATION_PLAN.md` from Phase 0 through the final gate and consult `SCREEN_IMAGE_INDEX.md` and its individual images.

## Required behavior

Work continuously through the plan without asking me to approve every phase or asking whether to continue. Make reasonable UI implementation decisions from the repository evidence and this plan. Keep the phase/evidence log current as you progress. Stop only if a real external dependency, missing access, unsafe data migration, or a business/configuration decision makes the next step impossible; finish independent work first and report the precise blocker and affected phase.

## Non-negotiable scope

- `apps/web` is the only customer UI and route source. Improve the shared responsive pages so the same route works on desktop web and phone-sized web/app surfaces.
- Do not build duplicate customer or Finder screens in React Native. Do not expand `apps/mobile` with parallel business UI.
- Finder stays public and browser-based, without customer login or an app-install requirement. Admin, CSR and website-admin work remains desktop-focused.
- Do not modify configuration, environment values, signing, deployment, API contracts, backend services, database schemas, data migrations, pricing, tax, payment behavior, authentication/MFA policy, notification delivery, entitlements or business rules.
- You may change presentation code, responsive layout, accessible navigation and UI-level route composition needed to make a screen reachable. A UI route for Health Records must reuse existing data/API/entitlement behavior and must not change access rules.
- Preserve all current feature behavior and call the existing APIs. Do not invent or silently simplify a route, action, status or state.
- Inspect before editing. Never trust a status document or a previous “compliant” claim when current code and the owner’s feedback disagree.

## Source authority

1. Current application code, shared API contracts and observed behavior.
2. `AGENTS.md`, root `README.md`, active `docs/DESIGN.md` and the current execution pack.
3. This plan and the owner’s explicit priorities, especially the full redesign of Health Records, order cards/details and invoice cards/details.
4. Generated screen images, for visual composition only. Their copy, data, currencies, labels and navigation are not requirements.

## Execution method

1. Read repository instructions and the whole plan. Inventory routes, links, shared components and existing tests before editing.
2. Record a baseline of branch, working tree and feasible validation commands. Do not overwrite unrelated user work.
3. Implement every phase in order, but continue directly from one completed phase to the next. Do not stop for routine approvals or progress updates.
4. Keep changes focused on shared customer/Finder presentation. Reuse existing tokens and components; remove duplicated or obsolete UI only when the repository confirms it is safe and within scope.
5. Add or update meaningful tests for route reachability, accessible interactions, preservation of existing actions, responsive layout assumptions and the three priority redesigns. Avoid tests that merely repeat implementation details.
6. Run targeted tests, typecheck, lint and build gates available in the repository. Run responsive browser checks at the viewport sizes in the plan when browser dependencies and login fixtures allow. Clearly mark anything not run as UNVERIFIED; never turn source inspection into a claim of device validation.
7. Compare every route against the route/image inventory. Update the implementation evidence/status report with changes, checks, failures, remaining blockers and exact file paths.
8. Finish with a concise summary of delivered UI, tests/checks and any remaining external shell/store/device blocker. Do not claim a native app release or physical-device test unless actually completed.

## Priority sequence

1. Replace the Pet Health Records modal with a polished, accessible, responsive page and non-modal add/edit flow.
2. Redesign the customer Orders list cards and Order Details information hierarchy.
3. Redesign Invoice list cards and Invoice Details information hierarchy.
4. Audit and complete the rest of the shared customer screens in the route matrix.
5. Audit the public Finder mobile browser flow and its consent, loading, error and success states.
6. Run the complete validation and route-coverage gate.

Begin with Phase 0. Continue autonomously through the final gate.

