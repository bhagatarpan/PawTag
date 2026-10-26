# PawTag Mobile Experience — OpenCode Handoff

This package is a repo-specific implementation brief for the PawTag customer and Finder mobile experience. It contains the full implementation plan, a copy/paste OpenCode prompt, a screen-image index, and separate mobile screen concept images.

## Start here

1. Open the PawTag repository root in OpenCode.
2. Copy `OPENCODE_PROMPT.md` into OpenCode, or attach the package folder and paste the prompt text.
3. Let the agent read `AGENTS.md`, `README.md`, `docs/DESIGN.md`, the current route source and the phase plan before it changes UI.
4. The agent should work through the phases continuously, update its evidence/status log, and not pause after each phase to ask whether to continue.

## Product constraints

- `apps/web` remains the one customer UI and route source for desktop web, mobile web and the shared UI loaded by the mobile shell.
- Do not create duplicate React Native screens. `apps/mobile` remains migration/reference code unless the repository owner explicitly changes that decision.
- Finder remains a public browser flow. It must not require customer login or app installation.
- Admin, CSR and website administration remain desktop-first.
- Keep work to presentation, responsive behavior, accessibility and customer-facing route/navigation presentation. Do not change business rules, API contracts, persistence, payment behavior, entitlements, pricing, notification semantics, authentication policy or configuration.
- New screen code in a locally bundled Capacitor app may still require a new app build/release. Do not promise that newly coded web routes appear in an installed build without a release unless the actual delivery architecture proves it.

## Image guidance

Each PNG under `images/` is an individual screen concept, not a composite board. Treat it as guidance for hierarchy, spacing and visual tone only. Image generation can invent currency, sample values, labels, data, status and navigation. Use the repository’s routes, API data, business behavior and `docs/DESIGN.md` as the authority. If an image conflicts with those sources—or with the owner’s instruction that Orders, Invoices and Health Records need redesign—follow the source and this plan.

## Package files

- `IMPLEMENTATION_PLAN.md` — review findings, complete screen/route inventory, phased implementation scope, acceptance gates and constraints.
- `OPENCODE_PROMPT.md` — complete prompt to start autonomous implementation.
- `SCREEN_IMAGE_INDEX.md` — image-to-screen mapping and visual-reference caveats.
- `images/` — standalone concept images, one image per listed screen or state.

