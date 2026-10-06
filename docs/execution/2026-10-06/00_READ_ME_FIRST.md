# PawTag Autonomous Execution Pack — Read Me First

**Prepared:** 6 October 2026  
**Audience:** PawTag founder/business owner + AI coding agent  
**Purpose:** one ordered, evidence-driven implementation program that consolidates the verified MVP audit, premium Cart/Checkout direction, web-first iOS/Android strategy, MongoDB→DynamoDB migration direction, donation-system specification, repository skills, and production launch gates.

## The single most important rule

**Source code and executed runtime evidence outrank documentation claims.**

`MVP_IMPLEMENTATION_STATUS.md`, prior master plans, old mobile plans, and historical docs are useful context but are not proof that a feature works. A checkbox means nothing unless the underlying code and required validation prove it.

## Product decisions locked into this pack

1. **Customer web is the primary customer UI source.** `apps/web` should serve browser customers and, after migration, the installed iOS/Android customer app through a thin Capacitor shell.
2. **No Finder native app.** `apps/finder` remains a browser-only public recovery experience. Finder links must never require installation or customer login.
3. **No Admin native app in the current MVP.** `apps/admin` remains desktop web.
4. **Do not build new duplicate customer screens in React Native.** Existing Expo code is reference/migration material until native-capability parity is proven.
5. **Premium Cart/Checkout is a product requirement.** Desktop uses an intentional ~70/30 (8/4 of 12 columns) composition with persistent sticky summary; mobile deliberately recomposes to one column.
6. **DynamoDB migration is incremental, not a rewrite.** Existing Mongo remains until each domain is explicitly migrated, validated, and cut over.
7. **Donation is a distinct financial domain.** It reuses PawTag identity/Stripe/document/email/audit primitives but must not be implemented as a simple product checkout button.
8. **First-customer readiness is evidence-based.** Tests, provider flows, staging rehearsal, rollback, and real-device validation must be executed—not merely documented.

## Installation

Copy the contents of `repo-overlay/` into the PawTag repository root:

```text
repo-overlay/AGENTS.md  -> PawTag/AGENTS.md
repo-overlay/skills/    -> PawTag/skills/
```

Do **not** copy the outer execution-pack directory over application source files.

Recommended: copy this whole pack to:

```text
docs/execution/2026-10-06/
```

so the agent can read the phase files from the repository.

`INSTALL.md` contains exact instructions.

## How to use this pack

Give the agent **one phase file at a time**.

Start with:

```text
phases/00_EVIDENCE_RESET_AND_BASELINE.md
```

Use `prompts/PHASE_EXECUTION_PROMPT.md` with each phase.

The agent must:

1. read `AGENTS.md`;
2. read the requested phase;
3. load relevant repository skills;
4. inspect current source before editing;
5. execute only that phase;
6. run required tests/validation;
7. update the phase status/evidence file;
8. stop.

Do not tell the agent to “do the whole plan” in one run.

## Default execution order

### Release Track A — First real customer foundation

00. Evidence reset and trustworthy baseline  
01. Production security/provider configuration  
02. Financial state integrity: checkout, inventory, rewards, shipping  
03. Email, invoices, notifications, auth/session completion  
04. Premium Cart + Checkout + customer web UX  
05. Finder **web** recovery + privacy  
06. Admin, workers, observability, deployment  
07. E2E, accessibility, performance, staging, first controlled web customer

### Release Track B — iOS/Android customer app without duplicate UI

08. Mobile-responsive shared web + app-aware UI foundation  
09. Capacitor shell + secure session + native bridges  
10. Real-device/store release gate + controlled retirement of Expo UI

### Platform Track C — Persistence modernization

11. DynamoDB discovery only  
12. Persistence boundary, AWS environments, low-risk migration  
13. High-risk/financial/job domains, validation, cutover, Mongo retirement gate

### Product Track D — Donation system

14. External legal/accounting gate + donation architecture audit  
15. Donation core domain + one-time payment  
16. Recurring donations + receipts + portals + admin  
17. Donation reconciliation/security/staging/public enablement

### Final program reconciliation

18. Final system-wide regression, documentation reconciliation, release evidence

## Important sequencing decision

**Do not make DynamoDB or Donations prerequisites for the first controlled PawTag customer unless the founder explicitly decides they are launch requirements.** Both are large risk surfaces. Stabilize and prove the current product first.

The DynamoDB discovery phase may begin after Track A if desired, but high-risk migration should not be mixed into unfinished payment/checkout hardening.

Donations should be implemented only after the financial platform is trustworthy and after the donation persistence strategy is explicit. If DynamoDB migration is not complete, donation business logic must still use repository interfaces so it can switch adapters later without a domain rewrite.

## Evidence vocabulary

Use these states instead of optimistic checkboxes:

- **PROVEN** — code + required automated/runtime/provider/manual evidence exists.
- **CODED_NOT_RUNTIME_VALIDATED** — implementation exists but required runtime proof is missing.
- **BLOCKED_EXTERNAL** — blocked by real external input/access such as Apple certificates, AWS non-prod credentials, NZ legal/tax confirmation.
- **FAILED** — validation ran and failed.
- **NOT_STARTED** — no evidence.

## Historical references

Files under `reference-plans/` and `reference-inputs/` are retained for context and traceability. They are **not** the active execution order unless a current phase explicitly points to them.

The old standalone React Native mobile plan is explicitly marked superseded. The target mobile architecture is the web-first Capacitor plan.
