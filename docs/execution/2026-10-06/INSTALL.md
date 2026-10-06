# Installation Instructions

## 1. Back up current agent guidance

Before replacing repository guidance, make a normal Git commit or copy of:

```text
AGENTS.md
skills/
```

Do not use destructive reset commands.

## 2. Install updated agent guidance

From this pack copy:

```text
repo-overlay/AGENTS.md
repo-overlay/skills/
```

into the PawTag repository root, replacing the existing `AGENTS.md` and merging/replacing the current `skills/` folder.

The supplied skills folder contains the current PawTag skills plus targeted updates and new skills for:

- web-first mobile shell / Capacitor;
- DynamoDB migration;
- donation domain;
- financial documents.

## 3. Install the execution documents

Recommended location:

```text
docs/execution/2026-10-06/
```

Copy these directories/files there:

```text
00_READ_ME_FIRST.md
01_SOURCE_OF_TRUTH_AND_PRECEDENCE.md
02_MASTER_DEPENDENCY_MAP.md
03_EXTERNAL_OWNER_ACTIONS.md
04_EXECUTION_STATUS_TEMPLATE.md
phases/
verification/
prompts/
```

You do not need to copy `reference-plans/` or `reference-inputs/` into the main repo unless you want an audit trail; they are included in the ZIP for your reference.

## 4. Keep `opencode.json`

The current repository already points OpenCode to `AGENTS.md` and `skills/`; no change is required unless the repository configuration has changed since this pack was produced.

## 5. Start the first phase

Give the agent `prompts/PHASE_EXECUTION_PROMPT.md` plus:

```text
phases/00_EVIDENCE_RESET_AND_BASELINE.md
```

After the phase reports green evidence, move to the next file.

## 6. Never hand over production root credentials

The coding agent should not receive:

- AWS root credentials;
- unrestricted production IAM credentials;
- Apple account owner credentials;
- Google Play owner credentials;
- Stripe account owner credentials;
- private signing keys unless the release workflow genuinely requires them and access is appropriately scoped.

Use least-privilege non-production credentials for implementation and automated validation.
