# Founder Guide — How to Run This Without Being a Developer

You do not need to translate these plans into engineering instructions. The pack is designed so you can give the coding agent one phase at a time.

## One-time setup

1. Put the updated `AGENTS.md` and `skills/` from `repo-overlay/` into the PawTag repository root.
2. Put the execution documents into `docs/execution/2026-10-06/`.
3. Commit those documentation/skill changes before implementation if possible.

## For every phase

Open `prompts/PHASE_EXECUTION_PROMPT.md`, replace `<PHASE_FILE>` with the next phase path, and give it to the coding agent.

Example first request:

```text
Execute only docs/execution/2026-10-06/phases/00_EVIDENCE_RESET_AND_BASELINE.md using the phase execution prompt. Follow AGENTS.md and relevant skills. Do not start Phase 01.
```

When it says it is done, give it `prompts/PHASE_REVIEW_PROMPT.md` before moving on. This gives you a second AI review of the work.

## What you should look for in the agent's answer

A good completion report contains:

- exact files changed;
- exact tests/commands run;
- pass/fail results;
- any manual/provider/device testing actually performed;
- anything still blocked;
- rollback procedure;
- next phase named, but not started.

Be cautious if the answer says only:

> implemented, all good, production ready

without evidence.

## When the agent is allowed to ask you something

Most implementation decisions should be made by the agent from source and these plans.

It should ask you only when it truly needs business/external input such as:

- NZ donation donee/tax/accounting/legal details;
- production credentials/access;
- Apple/Google account actions;
- a digital membership store-payment business decision;
- an irreversible production database cutover approval;
- a product policy not already defined that materially changes customer money/privacy.

## When to launch

There are separate gates:

1. **First controlled web customer:** after Phase 07 and `verification/FINAL_FIRST_CUSTOMER_GATE.md` is green.
2. **iOS/Android public app:** after Phase 10 and physical/store evidence is green.
3. **DynamoDB cutover:** domain-by-domain through Phases 11–13; do not wait for it unless it is a business launch requirement.
4. **Public Donations:** after Phases 14–17 and `verification/DONATION_RELEASE_MATRIX.md` is green.

## If something goes wrong

Give the agent `prompts/FAILURE_RECOVERY_PROMPT.md`. Do not tell it to skip the failing test or disable the security check.

## Your role

You remain the product/business owner. The AI acts as technical lead under the guardrails. You should decide business outcomes and external/legal inputs; you should not need to design database keys, retry algorithms, Stripe webhook state machines, or mobile token storage yourself.
